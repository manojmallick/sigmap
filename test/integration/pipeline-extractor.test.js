'use strict';

/**
 * CI / pipeline extractor (#3, v8.50).
 *
 * The generic YAML scanner reduced a GitHub Actions workflow to four lines —
 * `keys: [name, on, jobs]` and one `job: <id>` each — with no triggers, no
 * runner, no steps, no secrets, and no line anchors. These tests pin the
 * semantic replacement: what each platform must surface, that routing happens
 * by PATH ahead of the extension map, and that malformed input degrades to
 * fewer signatures rather than throwing mid-build.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const pipeline = require(path.join(ROOT, 'src/extractors/pipeline'));
const dispatch = require(path.join(ROOT, 'src/extractors/dispatch'));
const yamlExtractor = require(path.join(ROOT, 'src/extractors/yaml'));

let passed = 0;
let failed = 0;
function test(name, fn) {
  try { fn(); console.log(`  PASS  ${name}`); passed++; }
  catch (e) { console.log(`  FAIL  ${name}\n        ${e.message}`); failed++; }
}

const joined = (sigs) => sigs.join('\n');
function hasLine(sigs, substr) {
  assert.ok(sigs.some((s) => s.includes(substr)),
    `expected a signature containing "${substr}"\n--- got ---\n${joined(sigs)}`);
}
function noLine(sigs, substr) {
  assert.ok(!sigs.some((s) => s.includes(substr)),
    `did NOT expect a signature containing "${substr}"\n--- got ---\n${joined(sigs)}`);
}
/** Every signature carries a well-formed `  :start-end` anchor. */
function allAnchored(sigs) {
  for (const s of sigs) {
    const m = /\s{2}:(\d+)-(\d+)$/.exec(s);
    assert.ok(m, `signature has no line anchor: ${s}`);
    assert.ok(parseInt(m[1], 10) >= 1, `anchor start must be 1-based: ${s}`);
    assert.ok(parseInt(m[2], 10) >= parseInt(m[1], 10), `anchor end before start: ${s}`);
  }
}

// ───────────────────────────── routing ─────────────────────────────

test('platformFor routes every supported pipeline location', () => {
  const cases = {
    '.github/workflows/ci.yml': 'github',
    'repo/.github/workflows/release.yaml': 'github',
    '.gitea/workflows/build.yml': 'github',
    'action.yml': 'action',
    '.gitlab-ci.yml': 'gitlab',
    '.circleci/config.yml': 'circleci',
    'azure-pipelines.yml': 'azure',
    'bitbucket-pipelines.yml': 'bitbucket',
    '.drone.yml': 'drone',
    'Jenkinsfile': 'jenkins',
    'Jenkinsfile.release': 'jenkins',
    'docker-compose.yml': 'compose',
    'compose.yaml': 'compose',
  };
  for (const [p, expected] of Object.entries(cases)) {
    assert.strictEqual(pipeline.platformFor(p), expected, `${p} → ${pipeline.platformFor(p)}`);
  }
});

test('platformFor ignores ordinary YAML and source files', () => {
  for (const p of ['config/app.yml', 'k8s/deployment.yaml', 'src/index.ts', 'README.md', '']) {
    assert.strictEqual(pipeline.platformFor(p), null, `${p} should not route to a pipeline`);
  }
});

test('windows-style separators route identically', () => {
  assert.strictEqual(pipeline.platformFor('.github\\workflows\\ci.yml'), 'github');
});

test('dispatch resolves pipeline files ahead of the extension map', () => {
  assert.strictEqual(dispatch.langFor('.github/workflows/ci.yml'), 'pipeline');
  assert.strictEqual(dispatch.langFor('Jenkinsfile'), 'pipeline');
  // A plain .yml must still reach the generic YAML extractor.
  assert.strictEqual(dispatch.langFor('config/app.yml'), 'yaml');
  // And the extension map itself is untouched.
  assert.strictEqual(dispatch.EXT_MAP['.yml'], 'yaml');
});

// ───────────────────────── GitHub Actions ─────────────────────────

const GHA = `name: Release
on:
  push:
    tags: ['v*']
  pull_request:
    branches: [main]
    paths: ['src/**']
  workflow_dispatch:
  schedule:
    - cron: '0 3 * * 1'
permissions:
  contents: write
  id-token: write

jobs:
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - name: Install
        run: npm ci
      - name: Test
        run: |
          npm test
          npm run lint

  publish:
    runs-on: ubuntu-latest
    needs: test
    if: github.ref_type == 'tag'
    environment: production
    steps:
      - name: Publish
        run: npm publish
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;

test('github: workflow header carries name, triggers, permissions', () => {
  const sigs = pipeline.extract(GHA, '.github/workflows/release.yml');
  hasLine(sigs, 'workflow: Release');
  hasLine(sigs, 'push[v*]');
  hasLine(sigs, 'workflow_dispatch');
  hasLine(sigs, "schedule[0 3 * * 1]");
  hasLine(sigs, 'permissions: contents:write id-token:write');
});

test('github: multiple trigger filters are labelled, single ones are bare', () => {
  const sigs = pipeline.extract(GHA, '.github/workflows/release.yml');
  // pull_request has both branches and paths → labelled
  hasLine(sigs, 'pull_request[branches:main paths:src/**]');
  // push has only tags → bare
  hasLine(sigs, 'push[v*]');
});

test('github: jobs carry runner, matrix, needs, if, environment', () => {
  const sigs = pipeline.extract(GHA, '.github/workflows/release.yml');
  hasLine(sigs, 'job: test  runs-on: ubuntu-latest  matrix: node[18,20,22]');
  hasLine(sigs, 'job: publish');
  hasLine(sigs, 'needs: test');
  hasLine(sigs, "if: github.ref_type == 'tag'");
  hasLine(sigs, 'environment: production');
});

test('github: steps resolve to real commands, including block scalars', () => {
  const sigs = pipeline.extract(GHA, '.github/workflows/release.yml');
  hasLine(sigs, 'uses: actions/checkout@v4');
  hasLine(sigs, 'run: npm ci');
  // `run: |` must show the first command and the remaining line count,
  // never the bare block indicator.
  hasLine(sigs, 'run: npm test (+1 line)');
  noLine(sigs, 'run: |');
});

test('github: referenced secrets are surfaced on the owning job', () => {
  const sigs = pipeline.extract(GHA, '.github/workflows/release.yml');
  const publish = sigs.find((s) => s.startsWith('job: publish'));
  assert.ok(publish.includes('secrets: NPM_TOKEN'), `publish job missing secret: ${publish}`);
  // The secret belongs to publish only — test must not inherit it.
  const testJob = sigs.find((s) => s.startsWith('job: test'));
  assert.ok(!testJob.includes('secrets:'), `test job wrongly claims a secret: ${testJob}`);
});

test('github: a step-level `if` is never reported as the job condition', () => {
  const src = `name: X
on: push
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Maybe
        if: failure()
        run: echo hi
`;
  const sigs = pipeline.extract(src, '.github/workflows/x.yml');
  const job = sigs.find((s) => s.startsWith('job: build'));
  assert.ok(!job.includes('if:'), `job wrongly inherited a step condition: ${job}`);
  hasLine(sigs, 'run: echo hi  if: failure()');
});

test('github: every signature is anchored to real lines', () => {
  const sigs = pipeline.extract(GHA, '.github/workflows/release.yml');
  allAnchored(sigs);
  const lineCount = GHA.split('\n').length;
  for (const s of sigs) {
    const end = parseInt(/-(\d+)$/.exec(s)[1], 10);
    assert.ok(end <= lineCount, `anchor past end of file: ${s}`);
  }
});

test('github: anchors point at the line they claim', () => {
  const lines = GHA.split('\n');
  const sigs = pipeline.extract(GHA, '.github/workflows/release.yml');
  const publish = sigs.find((s) => s.startsWith('job: publish'));
  const start = parseInt(/\s{2}:(\d+)-/.exec(publish)[1], 10);
  assert.match(lines[start - 1], /^\s*publish:/, `line ${start} is "${lines[start - 1]}"`);
});

test('github: reusable workflow jobs surface their `uses` target', () => {
  const src = `name: Caller
on: push
jobs:
  call:
    uses: ./.github/workflows/reusable.yml
`;
  const sigs = pipeline.extract(src, '.github/workflows/caller.yml');
  hasLine(sigs, 'job: call  uses: ./.github/workflows/reusable.yml');
});

test('action.yml surfaces runtime, inputs and outputs', () => {
  const src = `name: My Action
description: does a thing
inputs:
  token:
    required: true
    description: a token
  level:
    default: info
outputs:
  result:
    description: the result
runs:
  using: node20
  main: dist/index.js
`;
  const sigs = pipeline.extract(src, 'action.yml');
  hasLine(sigs, 'action: My Action');
  hasLine(sigs, 'using: node20');
  hasLine(sigs, 'input: token (required)');
  hasLine(sigs, 'input: level  default: info');
  hasLine(sigs, 'output: result');
});

// ───────────────────────────── GitLab ─────────────────────────────

test('gitlab: stages, jobs, images, needs and scripts', () => {
  const src = `stages: [build, test, deploy]
variables:
  NODE_ENV: test

.base:
  image: node:20

build-app:
  stage: build
  image: node:20
  script:
    - npm ci
    - npm run build

deploy-prod:
  stage: deploy
  extends: .base
  needs: [build-app]
  when: manual
  environment:
    name: production
  script:
    - ./deploy.sh
`;
  const sigs = pipeline.extract(src, '.gitlab-ci.yml');
  hasLine(sigs, 'stages: build → test → deploy');
  hasLine(sigs, 'job: build-app  stage: build  image: node:20');
  hasLine(sigs, 'run: npm ci');
  hasLine(sigs, 'run: npm run build');
  hasLine(sigs, 'job: deploy-prod');
  hasLine(sigs, 'needs: build-app');
  hasLine(sigs, 'when: manual');
  hasLine(sigs, 'environment: production');
  hasLine(sigs, 'template: .base');
  // `variables` is reserved config, not a job.
  noLine(sigs, 'job: variables');
});

// ──────────────────────────── CircleCI ────────────────────────────

test('circleci: jobs, docker image, steps and workflow ordering', () => {
  const src = `version: 2.1
jobs:
  build:
    docker:
      - image: cimg/node:20.0
    steps:
      - checkout
      - run:
          name: Install
          command: npm ci
  deploy:
    docker:
      - image: cimg/base:stable
    steps:
      - run: ./deploy.sh
workflows:
  main:
    jobs:
      - build
      - deploy:
          requires: [build]
`;
  const sigs = pipeline.extract(src, '.circleci/config.yml');
  hasLine(sigs, 'job: build  docker: cimg/node:20.0');
  hasLine(sigs, 'run: npm ci');
  hasLine(sigs, 'job: deploy');
  hasLine(sigs, 'run: ./deploy.sh');
  hasLine(sigs, 'workflow: main');
  hasLine(sigs, 'runs: deploy  requires: build');
});

// ───────────────────────────── Azure ──────────────────────────────

test('azure: triggers, pool, jobs and steps', () => {
  const src = `trigger:
  branches:
    include: [main]
pr: none
pool:
  vmImage: ubuntu-latest
jobs:
  - job: Build
    displayName: Build the app
    steps:
      - script: npm ci
        displayName: Install
      - task: PublishBuildArtifacts@1
  - job: Deploy
    dependsOn: Build
    condition: succeeded()
    steps:
      - script: ./deploy.sh
`;
  const sigs = pipeline.extract(src, 'azure-pipelines.yml');
  hasLine(sigs, 'pipeline: azure');
  hasLine(sigs, 'pool: ubuntu-latest');
  hasLine(sigs, 'job: Build');
  hasLine(sigs, 'run: npm ci');
  hasLine(sigs, 'job: Deploy');
  hasLine(sigs, 'dependsOn: Build');
  hasLine(sigs, 'condition: succeeded()');
});

// ─────────────────────────── Bitbucket ────────────────────────────

test('bitbucket: triggers, steps and deployments', () => {
  const src = `image: node:20
pipelines:
  default:
    - step:
        name: Build
        script:
          - npm ci
  branches:
    main:
      - step:
          name: Deploy
          deployment: production
          script:
            - ./deploy.sh
`;
  const sigs = pipeline.extract(src, 'bitbucket-pipelines.yml');
  hasLine(sigs, 'pipeline: bitbucket  image: node:20');
  hasLine(sigs, 'trigger: default');
  hasLine(sigs, 'step: Build');
  hasLine(sigs, 'step: Deploy');
  hasLine(sigs, 'deployment: production');
});

// ───────────────────────────── Drone ──────────────────────────────

test('drone: pipeline kind and steps with images', () => {
  const src = `kind: pipeline
name: default
steps:
  - name: test
    image: node:20
    commands:
      - npm test
  - name: publish
    image: plugins/npm
    depends_on: [test]
`;
  const sigs = pipeline.extract(src, '.drone.yml');
  hasLine(sigs, 'pipeline: default  kind: pipeline');
  hasLine(sigs, 'step: test  image: node:20');
  hasLine(sigs, 'step: publish  image: plugins/npm  depends_on: test');
});

// ──────────────────────────── Compose ─────────────────────────────

test('compose: services carry image, ports and depends_on', () => {
  const src = `services:
  web:
    image: nginx:alpine
    ports:
      - "8080:80"
    depends_on: [api]
  api:
    build:
      context: ./api
    command: node server.js
    ports: ["3000:3000"]
`;
  const sigs = pipeline.extract(src, 'docker-compose.yml');
  hasLine(sigs, 'service: web  image: nginx:alpine  ports: 8080:80  depends_on: api');
  hasLine(sigs, 'service: api  build: ./api');
  hasLine(sigs, 'command: node server.js');
});

// ──────────────────────────── Jenkins ─────────────────────────────

test('jenkins: agent, stages and shell steps', () => {
  const src = `pipeline {
  agent any
  stages {
    stage('Build') {
      steps {
        sh 'npm ci'
      }
    }
    stage('Deploy') {
      steps {
        sh './deploy.sh'
      }
    }
  }
}
`;
  const sigs = pipeline.extract(src, 'Jenkinsfile');
  hasLine(sigs, 'pipeline: jenkins  agent: any');
  hasLine(sigs, 'stage: Build');
  hasLine(sigs, 'run: npm ci');
  hasLine(sigs, 'stage: Deploy');
  hasLine(sigs, 'run: ./deploy.sh');
});

// ─────────────────────────── robustness ───────────────────────────

test('comments are stripped, but `#` inside a quoted value survives', () => {
  const src = `name: X   # trailing comment
on: push
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: echo "id=#123"
`;
  const sigs = pipeline.extract(src, '.github/workflows/x.yml');
  hasLine(sigs, 'workflow: X');
  noLine(sigs, 'trailing comment');
  hasLine(sigs, 'echo "id=#123"');
});

test('a shell body inside a block scalar never parses as structure', () => {
  const src = `name: X
on: push
jobs:
  a:
    runs-on: ubuntu-latest
    steps:
      - run: |
          echo "not: a key"
          fake_job: still not a key
`;
  const sigs = pipeline.extract(src, '.github/workflows/x.yml');
  noLine(sigs, 'fake_job');
  assert.strictEqual(sigs.filter((s) => s.startsWith('job: ')).length, 1,
    `block-scalar body leaked into structure:\n${joined(sigs)}`);
});

test('tabs are tolerated as indentation', () => {
  const src = 'name: X\non: push\njobs:\n\ta:\n\t\truns-on: ubuntu-latest\n';
  const sigs = pipeline.extract(src, '.github/workflows/x.yml');
  hasLine(sigs, 'job: a');
});

test('malformed and empty input degrade to no signatures, never a throw', () => {
  for (const bad of ['', '   ', ':::::', 'not yaml at all', '\u0000\u0001']) {
    assert.doesNotThrow(() => pipeline.extract(bad, '.github/workflows/x.yml'));
    assert.ok(Array.isArray(pipeline.extract(bad, '.github/workflows/x.yml')));
  }
  assert.deepStrictEqual(pipeline.extract(null, '.github/workflows/x.yml'), []);
  assert.deepStrictEqual(pipeline.extract('name: x', 'src/index.ts'), []);
});

test('extraction is deterministic across repeated runs', () => {
  const a = pipeline.extract(GHA, '.github/workflows/release.yml');
  const b = pipeline.extract(GHA, '.github/workflows/release.yml');
  assert.deepStrictEqual(a, b);
});

test('output is capped and discloses the omission', () => {
  let src = 'name: Big\non: push\njobs:\n  a:\n    runs-on: ubuntu-latest\n    steps:\n';
  for (let i = 0; i < 60; i++) src += `      - run: echo ${i}\n`;
  const sigs = pipeline.extract(src, '.github/workflows/big.yml');
  assert.ok(sigs.length < 60, `expected steps to be capped, got ${sigs.length}`);
  hasLine(sigs, 'more steps');
});

// ───────────────────── integration with yaml.js ───────────────────

test('yaml.js sniffs a workflow that sits outside .github/workflows', () => {
  const sigs = yamlExtractor.extract(GHA);
  hasLine(sigs, 'workflow: Release');
  hasLine(sigs, 'job: publish');
  noLine(sigs, 'keys: [');
});

test('yaml.js still key-scans ordinary config', () => {
  const sigs = yamlExtractor.extract('server:\n  host: localhost\n  port: 8080\nlogging:\n  level: info\n');
  hasLine(sigs, 'keys: [server, logging]');
});


// ───────────── reachability through the generate pipeline ─────────────
//
// v8.50.0 shipped the extractor but not its wiring: `.github/workflows/` is a
// root dotdir, never in srcDirs and never auto-detected, so generate never
// handed a workflow to the extractor. Every test above passed while the
// feature was unreachable in real use — these close that gap by driving the
// CLI end to end instead of calling the extractor directly.

const CLI = path.join(ROOT, 'gen-context.js');

function withGeneratedRepo(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sigmap-reach-'));
  try {
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    }
    execFileSync('node', [CLI], { cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

const REACH_REPO = {
  'src/app.js': '/** App entry. */\nfunction startServer(port) { return port; }\nmodule.exports = { startServer };\n',
  '.github/workflows/ci.yml': [
    'name: CI', 'on:', '  push:', '    branches: [main]', 'jobs:', '  deploy:',
    '    runs-on: ubuntu-latest', '    steps:', '      - name: Deploy', '        run: ./deploy.sh', '',
  ].join('\n'),
  '.gitlab-ci.yml': 'stages: [build]\nbuild-app:\n  stage: build\n  script:\n    - npm run build\n',
};

const indexOf = (dir) => JSON.parse(fs.readFileSync(path.join(dir, '.context', 'sig-index.json'), 'utf8')).files;

test('generate indexes CI files that live outside srcDirs', () => {
  withGeneratedRepo(REACH_REPO, (dir) => {
    const files = Object.keys(indexOf(dir));
    assert.ok(files.some((f) => f.endsWith('.github/workflows/ci.yml')),
      `workflow not indexed — the extractor is unreachable through generate:\n${files.join('\n')}`);
    assert.ok(files.some((f) => f.endsWith('.gitlab-ci.yml')),
      `root-level CI file not indexed:\n${files.join('\n')}`);
    // The ordinary source file must still be there.
    assert.ok(files.some((f) => f.endsWith('src/app.js')), files.join('\n'));
  });
});

test('generate extracts real job semantics, not a bare key list', () => {
  withGeneratedRepo(REACH_REPO, (dir) => {
    const idx = indexOf(dir);
    const wf = idx[Object.keys(idx).find((f) => f.endsWith('.github/workflows/ci.yml'))];
    const joinedSigs = wf.join('\n');
    assert.ok(/workflow: CI/.test(joinedSigs), joinedSigs);
    assert.ok(/job: deploy/.test(joinedSigs), joinedSigs);
    assert.ok(/run: \.\/deploy\.sh/.test(joinedSigs), joinedSigs);
    assert.ok(!/keys: \[/.test(joinedSigs), `fell back to the generic key scan:\n${joinedSigs}`);
  });
});

test('`sigmap ask` answers "where does deploy happen" from a real repo', () => {
  // The exact question the feature was justified with. It returned nothing in
  // v8.50.0 despite 29 passing extractor tests.
  withGeneratedRepo(REACH_REPO, (dir) => {
    execFileSync('node', [CLI, 'ask', 'where does deploy happen'], {
      cwd: dir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    const qc = fs.readFileSync(path.join(dir, '.context', 'query-context.md'), 'utf8');
    assert.ok(/job: deploy/.test(qc), `ask did not surface the deploy job:\n${qc}`);
    assert.ok(/run: \.\/deploy\.sh/.test(qc), `ask did not surface the deploy command:\n${qc}`);
  });
});

test('CI files are indexed but NOT rendered into the prompt artifact', () => {
  // Same contract as test files: reachable by `ask`, without changing the
  // generated context file for users who did not ask for this.
  withGeneratedRepo(REACH_REPO, (dir) => {
    const ctx = fs.readFileSync(path.join(dir, '.github', 'copilot-instructions.md'), 'utf8');
    assert.ok(!/job: deploy/.test(ctx),
      `CI signatures leaked into the always-on prompt artifact:\n${ctx}`);
  });
});

test('a repo with no CI files generates cleanly', () => {
  withGeneratedRepo({ 'src/app.js': 'function f(a) { return a; }\n' }, (dir) => {
    const files = Object.keys(indexOf(dir));
    assert.deepStrictEqual(files.filter((f) => /workflows|gitlab-ci/.test(f)), []);
    assert.ok(files.some((f) => f.endsWith('src/app.js')));
  });
});

console.log('');
console.log(`pipeline-extractor: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
