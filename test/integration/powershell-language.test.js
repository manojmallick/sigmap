'use strict';

/**
 * PowerShell Tier 2 extractor integration tests (#840).
 *
 * Verifies:
 *   - maskPs length and newline preservation invariants
 *   - nested block comments, here-strings, quote escapes
 *   - function, filter, and workflow extraction
 *   - param(...) block balanced parsing, parameter name extraction
 *   - [CmdletBinding()] and [OutputType] detection
 *   - .SYNOPSIS doc hints
 *   - PS5 classes, constructors, methods, hidden method filtering
 *   - class member cap disclosure (120 limit)
 *   - enums, Export-ModuleMember, .psd1 manifest metadata
 *   - public vs internal export conventions
 *   - non-throwing contract on empty/bad input
 */

const assert = require('assert');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const { extract, maskPs } = require(path.join(ROOT, 'src/extractors/powershell'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name}\n        ${e.message}`);
    failed++;
  }
}

// ── 1. maskPs Scanner Invariants ──────────────────────────────────────────

test('maskPs preserves exact string length and newline count', () => {
  const sample = [
    '# Comment at start',
    'function Test-One {',
    '    <#',
    '       Multi-line block comment',
    '       <# Nested comment #>',
    '    #>',
    '    $hereString = @"',
    'Line with # comment character',
    '<# block comment syntax inside here-string #>',
    '"@',
    '    $singleHere = @\'',
    'single here string with # and <# #>',
    '\'@',
    '    $path = "C:\\Windows\\System32\\"',
    '    $escaped = "Quote: `" and comment-like: # not a comment"',
    '    $single = \'Single with \'\' escaped quote and # not a comment\'',
    '    return $true',
    '}',
  ].join('\n');

  const masked = maskPs(sample);

  assert.strictEqual(masked.length, sample.length, 'masked length must equal source length');

  const srcNewlines = (sample.match(/\n/g) || []).length;
  const maskedNewlines = (masked.match(/\n/g) || []).length;
  assert.strictEqual(maskedNewlines, srcNewlines, 'newline count must be preserved exactly');

  // Verify non-comment code is visible on masked surface
  assert.ok(masked.includes('function Test-One'), 'function declaration must not be blanked');
  assert.ok(masked.includes('return $true'), 'statements outside strings must not be blanked');

  // Verify comments and string contents are blanked
  assert.ok(!masked.includes('Multi-line block comment'), 'block comment text must be blanked');
  assert.ok(!masked.includes('Line with # comment character'), 'here-string content must be blanked');
  assert.ok(!masked.includes('not a comment'), 'string contents must be blanked');
});

test('maskPs handles nested block comments correctly', () => {
  const code = 'function A { }\n<# level 1 <# level 2 <# level 3 #> back to 2 #> back to 1 #>\nfunction B { }';
  const masked = maskPs(code);
  assert.strictEqual(masked.length, code.length);
  assert.ok(masked.includes('function A'));
  assert.ok(masked.includes('function B'));
  assert.ok(!masked.includes('back to 1'));
});

test('maskPs treats backtick as escape in double quotes, not backslash', () => {
  const code = '$a = "C:\\path\\"\nfunction Get-Foo { }';
  const masked = maskPs(code);
  assert.strictEqual(masked.length, code.length);
  assert.ok(masked.includes('function Get-Foo'), 'closing quote after backslash must terminate string');
});

// ── 2. Extractor Contract & Edge Cases ─────────────────────────────────────

test('extract returns empty array on empty or non-string input', () => {
  assert.deepStrictEqual(extract(''), []);
  assert.deepStrictEqual(extract(null), []);
  assert.deepStrictEqual(extract(undefined), []);
  assert.deepStrictEqual(extract(123), []);
});

test('extracts basic functions, filters, and workflows with original casing', () => {
  const src = [
    'Function Get-UserData {',
    '    param($Id, $Name)',
    '    Write-Output $Id',
    '}',
    'filter Filter-ActiveUsers {',
    '    param([bool]$Active = $true)',
    '}',
    'workflow Start-DeploymentWorkflow {',
    '    param([string]$TargetServer)',
    '}',
  ].join('\n');

  const sigs = extract(src);
  assert.ok(sigs.some((s) => s.startsWith('function Get-UserData(Id, Name)')), `function missing: ${sigs}`);
  assert.ok(sigs.some((s) => s.startsWith('filter Filter-ActiveUsers(Active)')), `filter missing: ${sigs}`);
  assert.ok(sigs.some((s) => s.startsWith('workflow Start-DeploymentWorkflow(TargetServer)')), `workflow missing: ${sigs}`);
});

test('extracts inline parameters and balanced param() blocks with defaults containing calls', () => {
  const src = [
    'function Test-Inline($a, [string]$b = "default", [int]$c = (1 + 2)) { }',
    'function Test-Advanced {',
    '    [CmdletBinding()]',
    '    [OutputType([System.IO.FileInfo])]',
    '    param(',
    '        [Parameter(Mandatory = $true)]',
    '        [ValidateNotNullOrEmpty()]',
    '        [string]$FilePath,',
    '',
    '        [Parameter(ValueFromPipeline = $true)]',
    '        [int]$RetryCount = (Get-Random -Minimum 1 -Maximum 10),',
    '',
    '        [string[]]$Tags = @(\'prod\', \'web\')',
    '    )',
    '    # Function body',
    '    Write-Host "Doing work"',
    '}',
  ].join('\n');

  const sigs = extract(src);
  assert.ok(sigs.some((s) => s.startsWith('function Test-Inline(a, b, c)')), 'inline parameters not parsed properly');
  const adv = sigs.find((s) => s.includes('Test-Advanced'));
  assert.ok(adv, 'Test-Advanced signature missing');
  assert.ok(adv.includes('Test-Advanced(FilePath, RetryCount, Tags)'), `params not cleaned: ${adv}`);
  assert.ok(adv.includes('[CmdletBinding]'), `CmdletBinding missing: ${adv}`);
  assert.ok(adv.includes('→ System.IO.FileInfo'), `OutputType missing: ${adv}`);
});

test('extracts comment-based help .SYNOPSIS as doc hint', () => {
  const src = [
    '<#',
    '.SYNOPSIS',
    'Retrieves system diagnostic metrics.',
    '.DESCRIPTION',
    'Long description here.',
    '#>',
    'function Get-SystemMetrics {',
    '    param($Node)',
    '}',
  ].join('\n');

  const sigs = extract(src);
  const sig = sigs.find((s) => s.includes('Get-SystemMetrics'));
  assert.ok(sig, 'Get-SystemMetrics missing');
  assert.ok(sig.includes('# Retrieves system diagnostic metrics'), `doc hint missing: ${sig}`);
});

test('extracts PS5 classes, constructors, methods, properties, and skips hidden members', () => {
  const src = [
    'class UserManager {',
    '    [string]$DatabaseUrl',
    '    static [int]$InstanceCount = 0',
    '    hidden [string]$SecretKey',
    '    $UntypedProp',
    '',
    '    UserManager([string]$url) {',
    '        $this.DatabaseUrl = $url',
    '    }',
    '',
    '    [User] GetUser([string]$id) {',
    '        return ($this.DatabaseUrl + $id)',
    '    }',
    '',
    '    static [void] ClearCache() {',
    '        throw ("cannot clear")',
    '    }',
    '',
    '    hidden [void] InternalSecretMethod() {',
    '    }',
    '}',
  ].join('\n');

  const sigs = extract(src);
  assert.ok(sigs.some((s) => s.startsWith('class UserManager')), 'class UserManager missing');
  assert.ok(sigs.some((s) => s.startsWith('  [string] $DatabaseUrl')), 'DatabaseUrl property missing');
  assert.ok(sigs.some((s) => s.startsWith('  static [int] $InstanceCount')), 'static InstanceCount property missing');
  assert.ok(sigs.some((s) => s.startsWith('  $UntypedProp')), 'UntypedProp missing');
  assert.ok(!sigs.some((s) => s.includes('SecretKey')), 'hidden property must be skipped');
  assert.ok(sigs.some((s) => s.startsWith('  UserManager(url)')), 'constructor missing');
  assert.ok(sigs.some((s) => s.startsWith('  [User] GetUser(id)')), 'GetUser method missing');
  assert.ok(sigs.some((s) => s.startsWith('  static [void] ClearCache()')), 'static ClearCache missing');
  assert.ok(!sigs.some((s) => s.includes('InternalSecretMethod')), 'hidden method must be skipped');
  // Statements inside method bodies must not be extracted as phantom members
  assert.ok(!sigs.some((s) => s.includes('return(')), 'return statement must not be extracted as method');
  assert.ok(!sigs.some((s) => s.includes('throw(')), 'throw statement must not be extracted as method');
});

test('discloses member cap when class exceeds 120 members', () => {
  const methods = [];
  for (let i = 1; i <= 130; i++) {
    methods.push(`    [void] Method${i}() { }`);
  }
  const src = `class BigClass {\n${methods.join('\n')}\n}`;
  const sigs = extract(src);

  assert.ok(sigs.some((s) => s.startsWith('class BigClass')));
  assert.ok(sigs.some((s) => s.includes('… +10 more methods')), `cap notice missing: ${sigs[sigs.length - 1]}`);
});

test('extracts enums and Export-ModuleMember with idiomatic Verb-Noun names', () => {
  const src = [
    'enum Environment {',
    '    Development',
    '    Staging',
    '    Production',
    '}',
    '',
    'function Get-Report { }',
    'function Invoke-Thing { }',
    'function Write-InternalLog { }',
    '',
    'Export-ModuleMember -Function Get-Report, Invoke-Thing',
  ].join('\n');

  const sigs = extract(src);
  assert.ok(sigs.some((s) => s.startsWith('enum Environment')), 'enum Environment missing');
  assert.ok(sigs.some((s) => s.startsWith('Export-ModuleMember Get-Report, Invoke-Thing')), 'Export-ModuleMember missing');
  assert.ok(sigs.some((s) => s.includes('Get-Report')), 'Get-Report missing');
  assert.ok(sigs.some((s) => s.includes('Invoke-Thing')), 'Invoke-Thing missing');
  // Internal convention: unexported functions skipped when export list present
  assert.ok(!sigs.some((s) => s.includes('Write-InternalLog')), 'Write-InternalLog must be omitted because export list exists');
});

test('Export-ModuleMember strips trailing flags like -Alias correctly without truncating Verb-Noun names', () => {
  const src = [
    'function Get-Report { }',
    'function Invoke-Thing { }',
    'Export-ModuleMember -Function Get-Report, Invoke-Thing -Alias gr, it',
  ].join('\n');

  const sigs = extract(src);
  assert.ok(sigs.some((s) => s.startsWith('Export-ModuleMember Get-Report, Invoke-Thing')), 'Export-ModuleMember should strip -Alias');
  assert.ok(sigs.some((s) => s.includes('Get-Report')), 'Get-Report must be retained');
  assert.ok(sigs.some((s) => s.includes('Invoke-Thing')), 'Invoke-Thing must be retained');
});

test('function attributes [CmdletBinding] and [OutputType] do not bleed into subsequent functions', () => {
  const src = [
    'function Get-Alpha {',
    '    [CmdletBinding()]',
    '    [OutputType([string])]',
    '    param([string]$Name)',
    '    $Name',
    '}',
    '',
    'function Get-Beta {',
    '    param([int]$Id)',
    '    $Id',
    '}',
  ].join('\n');

  const sigs = extract(src);
  const alphaSig = sigs.find((s) => s.includes('Get-Alpha'));
  const betaSig = sigs.find((s) => s.includes('Get-Beta'));

  assert.ok(alphaSig, 'Get-Alpha missing');
  assert.ok(betaSig, 'Get-Beta missing');
  assert.ok(alphaSig.includes('[CmdletBinding]'), 'Get-Alpha should have [CmdletBinding]');
  assert.ok(alphaSig.includes('→ string'), 'Get-Alpha should have → string');
  assert.ok(!betaSig.includes('[CmdletBinding]'), 'Get-Beta must NOT inherit [CmdletBinding]');
  assert.ok(!betaSig.includes('→ string'), 'Get-Beta must NOT inherit → string');
});

test('extracts .psd1 manifest metadata', () => {
  const src = [
    '@{\n',
    '    RootModule = \'MyModule.psm1\'\n',
    '    ModuleVersion = \'2.4.0\'\n',
    '    Author = \'Team\'\n',
    '    FunctionsToExport = @(\'Get-Data\', \'Set-Data\')\n',
    '}',
  ].join('\n');

  const sigs = extract(src, 'MyModule.psd1');
  assert.ok(sigs.some((s) => s.startsWith('RootModule = \'MyModule.psm1\'')), 'RootModule missing');
  assert.ok(sigs.some((s) => s.startsWith('ModuleVersion = \'2.4.0\'')), 'ModuleVersion missing');
  assert.ok(sigs.some((s) => s.startsWith('FunctionsToExport = @(\'Get-Data\', \'Set-Data\')')), 'FunctionsToExport missing');
  assert.ok(!sigs.some((s) => s.includes('Author')), 'untracked manifest key Author must be ignored');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
