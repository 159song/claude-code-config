'use strict';

// lib/spec.cjs -- WF 规格空间（specs/）解析与校验
// 借鉴 OpenSpec 的 Requirement/Scenario 模型：
//   .planning/specs/<capability>/spec.md 是主干真相
//   每个 spec 由 ## Purpose + ## Requirements + ### Requirement: + #### Scenario: 组成
// 与 change.cjs 共享解析核心，但本模块只处理主干 spec（不含 ADDED/MODIFIED/REMOVED delta 段）

const path = require('path');
const fs = require('fs');
const utils = require('./utils.cjs');

const SPECS_DIR = 'specs';
const CAPABILITY_PATTERN = /^[a-z][a-z0-9-]*$/;

// 解析 <capability>/spec.md -> 结构化对象
function parseSpec(content) {
  const result = { purpose: '', requirements: [] };
  if (!content) return result;

  const lines = content.split('\n');
  let i = 0;

  // 跳过 H1 标题（# ...）
  while (i < lines.length && !lines[i].startsWith('## ')) i++;

  let section = null;      // 'purpose' | 'requirements' | null
  let currentReq = null;   // 当前 requirement block
  let currentScenario = null;
  let buffer = [];         // 当前段落文本缓冲

  // 把 buffer 写入当前段落/requirement/scenario，然后清空 buffer
  function flushBuffer() {
    const text = buffer.join('\n').trim();
    if (text) {
      if (currentScenario) {
        currentScenario.body = text;
        currentScenario.steps = extractSteps(text);
      } else if (currentReq) {
        currentReq.body = text;
      } else if (section === 'purpose') {
        result.purpose = text;
      }
    }
    buffer = [];
  }

  for (; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('## ')) {
      flushBuffer();
      const heading = line.slice(3).trim().toLowerCase();
      if (heading === 'purpose') {
        section = 'purpose';
      } else if (heading === 'requirements') {
        section = 'requirements';
      } else {
        section = null;
      }
      currentReq = null;
      currentScenario = null;
      continue;
    }

    if (section === 'requirements' && line.startsWith('### Requirement:')) {
      flushBuffer();
      const name = line.slice('### Requirement:'.length).trim();
      currentReq = { name, body: '', scenarios: [] };
      result.requirements.push(currentReq);
      currentScenario = null;
      continue;
    }

    if (section === 'requirements' && line.startsWith('#### Scenario:')) {
      flushBuffer();
      const name = line.slice('#### Scenario:'.length).trim();
      currentScenario = { name, body: '', steps: [] };
      if (currentReq) {
        currentReq.scenarios.push(currentScenario);
      }
      continue;
    }

    buffer.push(line);
  }

  flushBuffer();

  return result;
}

// 从 scenario body 中提取步骤：- **WHEN** ... / - WHEN ... / - **THEN** ...
function extractSteps(body) {
  const steps = [];
  const stepPattern = /^\s*[-*]\s+(?:\*\*)?(GIVEN|WHEN|THEN|AND|BUT)(?:\*\*)?\s+(.+?)\s*$/i;
  for (const line of body.split('\n')) {
    const m = line.match(stepPattern);
    if (m) {
      steps.push({ keyword: m[1].toUpperCase(), text: m[2].trim() });
    }
  }
  return steps;
}

// 列出所有 capability（读目录，不解析全文）
function listSpecs(cwd) {
  const specsRoot = path.join(cwd, '.planning', SPECS_DIR);
  if (!fs.existsSync(specsRoot)) {
    return { capabilities: [] };
  }

  const capabilities = [];
  const entries = fs.readdirSync(specsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!CAPABILITY_PATTERN.test(entry.name)) continue;
    const specPath = path.join(specsRoot, entry.name, 'spec.md');
    if (!fs.existsSync(specPath)) continue;

    const content = utils.readFile(specPath);
    const parsed = parseSpec(content);
    capabilities.push({
      capability: entry.name,
      path: specPath,
      requirement_count: parsed.requirements.length,
      scenario_count: parsed.requirements.reduce((n, r) => n + r.scenarios.length, 0),
      purpose: parsed.purpose.split('\n')[0] || ''
    });
  }

  capabilities.sort((a, b) => a.capability.localeCompare(b.capability));
  return { capabilities };
}

// 读取并解析单个 capability
function showSpec(cwd, capability) {
  if (!capability) {
    return { error: 'capability name required' };
  }
  if (!CAPABILITY_PATTERN.test(capability)) {
    return { error: 'invalid capability name: ' + capability };
  }
  const specPath = path.join(cwd, '.planning', SPECS_DIR, capability, 'spec.md');
  const content = utils.readFile(specPath);
  if (content === null) {
    return { error: 'spec not found: ' + specPath };
  }
  const parsed = parseSpec(content);
  return { capability, path: specPath, ...parsed };
}

// 校验单个 spec 的结构
function validateOne(cwd, capability, options) {
  options = options || {};
  const requireScenarios = options.requireScenarios !== false;
  const issues = [];

  if (!CAPABILITY_PATTERN.test(capability)) {
    issues.push({ level: 'error', capability, message: 'invalid capability name (expected kebab-case)' });
    return { valid: false, issues };
  }

  const specPath = path.join(cwd, '.planning', SPECS_DIR, capability, 'spec.md');
  const content = utils.readFile(specPath);
  if (content === null) {
    issues.push({ level: 'error', capability, message: 'spec.md not found' });
    return { valid: false, issues };
  }

  const parsed = parseSpec(content);

  if (!parsed.purpose) {
    issues.push({ level: 'error', capability, message: 'missing ## Purpose section' });
  }

  if (parsed.requirements.length === 0) {
    issues.push({ level: 'error', capability, message: 'no ### Requirement: blocks found under ## Requirements' });
  }

  const seenReqNames = new Map();
  for (const req of parsed.requirements) {
    if (!req.name) {
      issues.push({ level: 'error', capability, message: '### Requirement: has empty name' });
      continue;
    }
    if (seenReqNames.has(req.name)) {
      issues.push({ level: 'error', capability, requirement: req.name, message: 'duplicate requirement name' });
    }
    seenReqNames.set(req.name, true);

    if (!req.body) {
      issues.push({ level: 'warn', capability, requirement: req.name, message: 'requirement has no descriptive body before scenarios' });
    }

    if (requireScenarios && req.scenarios.length === 0) {
      issues.push({ level: 'error', capability, requirement: req.name, message: 'requirement has no #### Scenario:' });
    }

    const seenScenarioNames = new Map();
    for (const sc of req.scenarios) {
      if (!sc.name) {
        issues.push({ level: 'error', capability, requirement: req.name, message: '#### Scenario: has empty name' });
        continue;
      }
      if (seenScenarioNames.has(sc.name)) {
        issues.push({ level: 'warn', capability, requirement: req.name, scenario: sc.name, message: 'duplicate scenario name' });
      }
      seenScenarioNames.set(sc.name, true);

      const hasWhen = sc.steps.some(s => s.keyword === 'WHEN');
      const hasThen = sc.steps.some(s => s.keyword === 'THEN');
      if (!hasWhen) {
        issues.push({ level: 'error', capability, requirement: req.name, scenario: sc.name, message: 'scenario missing WHEN step' });
      }
      if (!hasThen) {
        issues.push({ level: 'error', capability, requirement: req.name, scenario: sc.name, message: 'scenario missing THEN step' });
      }
    }
  }

  const hasError = issues.some(it => it.level === 'error');
  return {
    valid: !hasError,
    capability,
    path: specPath,
    requirement_count: parsed.requirements.length,
    scenario_count: parsed.requirements.reduce((n, r) => n + r.scenarios.length, 0),
    issues
  };
}

// 校验全部 specs
function validateAll(cwd, options) {
  const specsRoot = path.join(cwd, '.planning', SPECS_DIR);
  if (!fs.existsSync(specsRoot)) {
    return { valid: true, capabilities: [], issues: [], message: 'no specs/ directory' };
  }

  const results = [];
  const entries = fs.readdirSync(specsRoot, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (!CAPABILITY_PATTERN.test(entry.name)) {
      results.push({ valid: false, capability: entry.name, issues: [{ level: 'error', capability: entry.name, message: 'invalid capability name (expected kebab-case)' }] });
      continue;
    }
    const specPath = path.join(specsRoot, entry.name, 'spec.md');
    if (!fs.existsSync(specPath)) {
      results.push({ valid: false, capability: entry.name, issues: [{ level: 'error', capability: entry.name, message: 'spec.md missing' }] });
      continue;
    }
    results.push(validateOne(cwd, entry.name, options));
  }

  const allValid = results.every(r => r.valid);
  const totalIssues = results.reduce((n, r) => n + (r.issues ? r.issues.length : 0), 0);
  return { valid: allValid, total: results.length, total_issues: totalIssues, capabilities: results };
}

// 命令分发
function run(cwd, args) {
  const sub = args[0];

  if (sub === 'list') {
    utils.output(listSpecs(cwd));
    return;
  }

  if (sub === 'show') {
    const cap = args[1];
    const result = showSpec(cwd, cap);
    if (result.error) {
      utils.error(result.error);
      process.exit(1);
    }
    utils.output(result);
    return;
  }

  if (sub === 'validate') {
    const all = args.includes('--all');
    const cap = args.find((a, idx) => idx >= 1 && !a.startsWith('--'));
    const options = {}; // require_scenarios default true via validateOne
    if (all || !cap) {
      const result = validateAll(cwd, options);
      utils.output(result);
      process.exit(result.valid ? 0 : 1);
    }
    const result = validateOne(cwd, cap, options);
    utils.output(result);
    process.exit(result.valid ? 0 : 1);
  }

  utils.error('用法: wf-tools spec [list|show <capability>|validate [<capability>] [--all]]');
  process.exit(1);
}

module.exports = {
  parseSpec,
  extractSteps,
  listSpecs,
  showSpec,
  validateOne,
  validateAll,
  run,
  CAPABILITY_PATTERN
};
