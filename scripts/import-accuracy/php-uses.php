<?php
// Reference helper for the PHP import accuracy benchmark (#980).
//
//   php php-uses.php <tree> <files.json>
//
// For each file listed, PHP's own tokenizer finds the top-level `use` statements of
// classes, interfaces, traits and enums, and Composer's own autoloader (generated beforehand
// with `composer dump-autoload --classmap-authoritative` in <tree>) says which file defines
// each name. Prints one JSON object: { "<rel file>": ["<rel file it imports>", ...], ... }.
// A file the tokenizer cannot parse is listed under "__failed__".
//
// Dev-only. Nothing here ships in the npm package.

if ($argc < 3) { fwrite(STDERR, "usage: php php-uses.php <tree> <files.json>\n"); exit(2); }
$tree = rtrim(realpath($argv[1]), '/');
$files = json_decode(file_get_contents($argv[2]), true);
require $tree . '/vendor/autoload.php';
$loaders = Composer\Autoload\ClassLoader::getRegisteredLoaders();
$loader = reset($loaders);

function uses_of(string $source): array {
    $tokens = token_get_all($source);
    $out = [];
    $depth = 0;          // brace depth: a `use` inside a class body or a closure is not an import
    $nsDepth = null;     // depth inside a braced `namespace X { }`
    $n = count($tokens);
    $nameTokens = [T_STRING, T_NS_SEPARATOR, T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED, T_NAME_RELATIVE];
    for ($i = 0; $i < $n; $i++) {
        $t = $tokens[$i];
        if (!is_array($t)) {
            if ($t === '{') $depth++;
            elseif ($t === '}') { $depth--; if ($nsDepth !== null && $depth < $nsDepth) $nsDepth = null; }
            continue;
        }
        if ($t[0] === T_CURLY_OPEN || $t[0] === T_DOLLAR_OPEN_CURLY_BRACES) { $depth++; continue; }
        if ($t[0] === T_NAMESPACE) {
            // `namespace X {` opens a block whose body is top level; `namespace X;` does not
            for ($j = $i + 1; $j < $n; $j++) {
                if ($tokens[$j] === ';') break;
                if ($tokens[$j] === '{') { $nsDepth = $depth + 1; break; }
            }
            continue;
        }
        if ($t[0] !== T_USE) continue;
        $top = $nsDepth === null ? $depth === 0 : $depth === $nsDepth;
        if (!$top) continue;
        // read the clause up to its `;`
        $clause = [];
        for ($j = $i + 1; $j < $n; $j++) {
            if ($tokens[$j] === ';') break;
            $clause[] = $tokens[$j];
        }
        $i = $j;
        $kind = null;
        $names = [];
        $cur = '';
        $prefix = '';
        $inGroup = false;
        $skipAlias = false;
        foreach ($clause as $c) {
            if (is_array($c)) {
                if ($c[0] === T_WHITESPACE || $c[0] === T_COMMENT || $c[0] === T_DOC_COMMENT) continue;
                if ($c[0] === T_FUNCTION) { $kind = 'function'; continue; }
                if ($c[0] === T_CONST) { $kind = 'const'; continue; }
                if ($c[0] === T_AS) { $skipAlias = true; continue; }
                if (in_array($c[0], $nameTokens, true)) {
                    if ($skipAlias) { $skipAlias = false; continue; }   // the alias name
                    $cur .= $c[1];
                }
            } else {
                if ($c === '{') { $prefix = $cur; $cur = ''; $inGroup = true; }
                elseif ($c === ',' || $c === '}') {
                    if ($cur !== '') $names[] = $prefix . $cur;
                    $cur = '';
                    if ($c === '}') { $inGroup = false; $prefix = ''; }
                }
            }
        }
        if ($cur !== '') $names[] = $prefix . $cur;
        if ($kind !== null) continue;       // use function / use const: not a class
        foreach ($names as $name) $out[] = ltrim($name, '\\');
    }
    return $out;
}

$result = [];
$failed = [];
foreach ($files as $rel) {
    $abs = $tree . '/' . $rel;
    $src = @file_get_contents($abs);
    if ($src === false) { $failed[] = $rel; continue; }
    try { $names = uses_of($src); } catch (Throwable $e) { $failed[] = $rel; continue; }
    $deps = [];
    foreach (array_unique($names) as $name) {
        $file = $loader->findFile($name);
        if ($file === false) continue;
        $real = realpath($file);
        if ($real === false || strpos($real, $tree . '/') !== 0) continue;
        if (strpos($real, $tree . '/vendor/') === 0) continue;
        $dep = substr($real, strlen($tree) + 1);
        if ($dep !== $rel) $deps[$dep] = true;
    }
    $result[$rel] = array_keys($deps);
}
$result['__failed__'] = $failed;
echo json_encode($result);
