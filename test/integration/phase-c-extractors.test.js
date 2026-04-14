'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '../..');
const { analyzeFiles } = require(path.join(ROOT, 'src', 'eval', 'analyzer'));

let passed = 0;
let failed = 0;
let skipped = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  PASS  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  FAIL  ${name}: ${err.message}`);
    failed++;
  }
}

function skip(name, reason) {
  console.log(`  SKIP  ${name}: ${reason}`);
  skipped++;
}

function withTempDir(fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-phase-c-'));
  try {
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

function maybeRunExtractorCase(name, ext, source, expectations) {
  const extractorPath = path.join(ROOT, 'src', 'extractors', `${name}.js`);
  if (!fs.existsSync(extractorPath)) {
    skip(`${name} extractor readiness`, 'extractor not implemented yet');
    return;
  }

  const extractor = require(extractorPath);
  test(`${name} extractor returns signatures and is analyzable via ${ext}`, () => {
    const sigs = extractor.extract(source);
    assert.ok(Array.isArray(sigs), 'extract() must return an array');
    assert.ok(sigs.length > 0, 'expected at least one signature');

    const text = sigs.join('\n');
    for (const re of expectations) {
      assert.ok(re.test(text), `expected ${re} in signatures, got: ${text}`);
    }

    withTempDir((dir) => {
      const filePath = path.join(dir, `fixture${ext}`);
      fs.writeFileSync(filePath, source, 'utf8');
      const rows = analyzeFiles([filePath], dir);
      assert.strictEqual(rows.length, 1, 'analyzeFiles should recognize the new extension');
      assert.ok(rows[0].sigs > 0, 'analyzeFiles should report non-zero signatures');
    });
  });
}

// Phase C: React component extractor
maybeRunExtractorCase(
  'typescript_react',
  '.tsx',
  `import React, { useState } from 'react';

interface UserProps {
  name: string;
  age: number;
}

export const UserProfile: React.FC<UserProps> = ({ name, age }) => {
  const [edited, setEdited] = useState(false);
  
  const handleClick = () => setEdited(true);
  
  return <div onClick={handleClick}>{name} - {age}</div>;
};`,
  [/component UserProfile|UserProfile|component/i, /hook useState|useState/i, /props UserProps/i],
);

// Phase C: Vue SFC extractor
maybeRunExtractorCase(
  'vue_sfc',
  '.vue',
  `<template>
  <div :class="{ active: isOpen }">
    <slot name="header">Default Header</slot>
    <button @click="toggle">Toggle</button>
    <slot>Default content</slot>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';

interface Props {
  modelValue?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{ update: [value: boolean] }>();
const isOpen = ref(false);

const toggle = () => {
  isOpen.value = !isOpen.value;
  emit('update', isOpen.value);
};
</script>`,
  [/props composition-api|defineProps/i, /emit update|defineEmits|emits/i, /slot header/i],
);

// Phase C: Python dataclass extractor
maybeRunExtractorCase(
  'python_dataclass',
  '.py',
  `from dataclasses import dataclass
from typing import Optional
from pydantic import BaseModel, field_validator

@dataclass
class Address:
  street: str
  city: str
  zipcode: str

class User(BaseModel):
  id: int
  name: str
  email: str
  age: Optional[int] = None
  
  @field_validator('email')
  def validate_email(cls, v):
    assert '@' in v
    return v`,
  [/dataclass Address/i, /model User|BaseModel/i, /field id|field name|pydantic/i],
);

console.log('');
console.log(`phase-c-extractors: ${passed} passed, ${failed} failed, ${skipped} skipped`);
if (failed > 0) process.exit(1);
