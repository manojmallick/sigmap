'use strict';

/**
 * JetBrains plugin integration tests (structure validation only, no JVM execution).
 * Tests plugin.xml validity, Gradle config, README presence, and file structure.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

const PLUGIN_DIR = path.join(__dirname, '../../jetbrains-plugin');

function test_plugin_directory_exists() {
  assert.ok(fs.existsSync(PLUGIN_DIR), 'jetbrains-plugin/ directory must exist');
}

function test_build_gradle_exists() {
  const gradlePath = path.join(PLUGIN_DIR, 'build.gradle.kts');
  assert.ok(fs.existsSync(gradlePath), 'build.gradle.kts must exist');
}

function test_build_gradle_has_correct_version() {
  const gradlePath = path.join(PLUGIN_DIR, 'build.gradle.kts');
  const content = fs.readFileSync(gradlePath, 'utf8');
  
  // Read root package.json version
  const rootPkg = JSON.parse(fs.readFileSync(path.join(__dirname, '../../package.json'), 'utf8'));
  const expectedVersion = rootPkg.version;
  
  assert.ok(
    content.includes(`version = "${expectedVersion}"`),
    `build.gradle.kts must declare version matching package.json (${expectedVersion})`
  );
}

function test_plugin_xml_exists() {
  const xmlPath = path.join(PLUGIN_DIR, 'src/main/resources/META-INF/plugin.xml');
  assert.ok(fs.existsSync(xmlPath), 'plugin.xml must exist');
}

function test_plugin_xml_is_valid_xml() {
  const xmlPath = path.join(PLUGIN_DIR, 'src/main/resources/META-INF/plugin.xml');
  const content = fs.readFileSync(xmlPath, 'utf8');
  
  // Basic XML validation (check opening/closing tags)
  assert.ok(content.includes('<idea-plugin>'), 'plugin.xml must have <idea-plugin> opening tag');
  assert.ok(content.includes('</idea-plugin>'), 'plugin.xml must have </idea-plugin> closing tag');
}

function test_plugin_xml_has_required_ids() {
  const xmlPath = path.join(PLUGIN_DIR, 'src/main/resources/META-INF/plugin.xml');
  const content = fs.readFileSync(xmlPath, 'utf8');
  
  // Required elements
  assert.ok(  content.includes('<id>com.sigmap.plugin</id>'),
    'plugin.xml must have plugin ID: com.sigmap.plugin'
  );
  assert.ok(content.includes('<name>SigMap'), 'plugin.xml must have <name> element');
  assert.ok(content.includes('<vendor'), 'plugin.xml must have <vendor> element');
}

function test_plugin_xml_has_all_action_ids() {
  const xmlPath = path.join(PLUGIN_DIR, 'src/main/resources/META-INF/plugin.xml');
  const content = fs.readFileSync(xmlPath, 'utf8');
  
  const requiredActions = [
    'SigMap.RegenerateContext',
    'SigMap.OpenContextFile',
    'SigMap.ViewRoadmap'
  ];
  
  for (const actionId of requiredActions) {
    assert.ok(
      content.includes(`id="${actionId}"`),
      `plugin.xml must declare action: ${actionId}`
    );
  }
}

function test_kotlin_source_files_exist() {
  const requiredFiles = [
    'src/main/kotlin/com/sigmap/plugin/RegenerateAction.kt',
    'src/main/kotlin/com/sigmap/plugin/OpenContextFileAction.kt',
    'src/main/kotlin/com/sigmap/plugin/ViewRoadmapAction.kt',
    'src/main/kotlin/com/sigmap/plugin/HealthStatusBar.kt',
    'src/main/kotlin/com/sigmap/plugin/HealthStatusBarFactory.kt'
  ];
  
  for (const file of requiredFiles) {
    const filePath = path.join(PLUGIN_DIR, file);
    assert.ok(fs.existsSync(filePath), `Kotlin source file must exist: ${file}`);
  }
}

function test_plugin_readme_exists() {
  const readmePath = path.join(PLUGIN_DIR, 'README.md');
  assert.ok(fs.existsSync(readmePath), 'jetbrains-plugin/README.md must exist');
}

function test_plugin_readme_has_install_steps() {
  const readmePath = path.join(PLUGIN_DIR, 'README.md');
  const content = fs.readFileSync(readmePath, 'utf8');
  
  assert.ok(content.includes('## Installation'), 'README must have Installation section');
  assert.ok(
    content.includes('Marketplace') || content.includes('marketplace'),
    'README must mention JetBrains Marketplace'
  );
  assert.ok(
    content.includes('Manual') || content.includes('ZIP'),
    'README must mention manual ZIP install'
  );
}

function test_jetbrains_setup_doc_exists() {
  const docPath = path.join(__dirname, '../../docs/JETBRAINS_SETUP.md');
  assert.ok(fs.existsSync(docPath), 'docs/JETBRAINS_SETUP.md must exist');
}

// -----------------------------------------------------------------------------
// Test runner
// -----------------------------------------------------------------------------

const tests = [
  test_plugin_directory_exists,
  test_build_gradle_exists,
  test_build_gradle_has_correct_version,
  test_plugin_xml_exists,
  test_plugin_xml_is_valid_xml,
  test_plugin_xml_has_required_ids,
  test_plugin_xml_has_all_action_ids,
  test_kotlin_source_files_exist,
  test_plugin_readme_exists,
  test_plugin_readme_has_install_steps,
  test_jetbrains_setup_doc_exists
];

let passed = 0;
let failed = 0;

for (const test of tests) {
  try {
    test();
    console.log(`✓ ${test.name}`);
    passed++;
  } catch (err) {
    console.error(`✗ ${test.name}`);
    console.error(`  ${err.message}`);
    failed++;
  }
}

console.log('');
console.log(`Results: ${passed}/${tests.length} passed`);

if (failed > 0) {
  process.exit(1);
}
