'use strict';

// lib/change.cjs -- WF 变更提议（change proposal）空间
// 借鉴 OpenSpec：.planning/changes/<id>/ 承载 proposal.md / tasks.md / design.md? / specs/<cap>/spec.md delta
// 生命周期：propose（LLM 产出）→ validate → apply（人工/executor 实现）→ archive（delta 合并进 specs/）
//
// 本模块负责：
//   - 结构解析：change 目录 → 结构化对象
//   - delta 语法：## ADDED/MODIFIED/REMOVED/RENAMED Requirements
//   - 合并算法：把 delta 写入主干 specs/<capability>/spec.md（archive 的核心）
//   - 冲突检测：fail-fast（目标不存在、ADDED 重名等）

const path = require('path');
const fs = require('fs');
const utils = require('./utils.cjs');
const spec = require('./spec.cjs');

const CHANGES_DIR = 'changes';
const ARCHIVE_DIR = 'archive';
const CHANGE_ID_PATTERN = /^[a-z][a-z0-9-]*$/;
const DELTA_SECTION_PATTERN = /^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/;

// 将 change_id 校验抽出
function validChangeId(id) {
  return typeof id === 'string' && CHANGE_ID_PATTERN.test(id) && id !== ARCHIVE_DIR;
}

// 把 markdown 里的 requirement 块拆分出来
// 输入一段 markdown（可能包含 ## header 和 ### Requirement: 块），
// 返回 { preamble, requirements: [{ name, block }] }
// block 包含 "### Requirement: X\n" 到下一个 ### Requirement 或 ## 或 EOF 之间的全部字符
function splitRequirements(markdown) {
  const lines = markdown.split('\n');
  const preamble = [];
  const requirements = [];
  let current = null;
  let section = 'preamble'; // 'preamble' | 'requirement'

  for (const line of lines) {
    // 任何 ## 开头的标题会结束当前 requirement（但 ## 本身不属于任何 requirement）
    if (/^##\s+/.test(line)) {
      if (current) {
        requirements.push(current);
        current = null;
      }
      if (section === 'preamble') preamble.push(line);
      else preamble.push(line); // 后续 ## section 也归入 preamble（如 ## Requirements 标题）
      section = 'preamble';
      continue;
    }

    if (line.startsWith('### Requirement:')) {
      if (current) requirements.push(current);
      const name = line.slice('### Requirement:'.length).trim();
      current = { name, lines: [line] };
      section = 'requirement';
      continue;
    }

    if (current) {
      current.lines.push(line);
    } else {
      preamble.push(line);
    }
  }

  if (current) requirements.push(current);

  // 把每个 requirement 的 lines 合成 block 文本（末尾保留换行语义由调用方处理）
  for (const req of requirements) {
    req.block = req.lines.join('\n');
    delete req.lines;
  }

  return {
    preamble: preamble.join('\n'),
    requirements
  };
}

// 解析 delta 文件 -> { added: [req], modified: [req], removed: [req], renamed: [{from, name, block}] }
// 其中 req = { name, block } （block 是原始 markdown，方便整块替换）
function parseDelta(content) {
  const sections = { ADDED: '', MODIFIED: '', REMOVED: '', RENAMED: '' };
  const lines = (content || '').split('\n');
  let current = null;
  let buffer = [];

  function flush() {
    if (current) sections[current] = buffer.join('\n');
    buffer = [];
  }

  for (const line of lines) {
    const m = line.match(DELTA_SECTION_PATTERN);
    if (m) {
      flush();
      current = m[1];
      continue;
    }
    if (current) buffer.push(line);
  }
  flush();

  const result = { added: [], modified: [], removed: [], renamed: [] };

  for (const op of ['ADDED', 'MODIFIED', 'REMOVED']) {
    const { requirements } = splitRequirements(sections[op]);
    const key = op.toLowerCase();
    result[key] = requirements.map(r => ({ name: r.name, block: r.block }));
  }

  // RENAMED：抽出 From 行，body 仅保留新内容（不含 header 行、不含 From 行）
  // 空 body 代表"仅改名，保留原 body"
  const renamedSplit = splitRequirements(sections.RENAMED);
  for (const r of renamedSplit.requirements) {
    const fromMatch = r.block.match(/^-\s+From:\s+(.+?)\s*$/m);
    const from = fromMatch ? fromMatch[1].trim() : null;
    const bodyLines = r.block.split('\n').slice(1); // 去掉 '### Requirement: ...' header 行
    const body = bodyLines
      .join('\n')
      .replace(/^-\s+From:\s+.+?\s*$/m, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    result.renamed.push({ name: r.name, from, body });
  }

  return result;
}

// 校验 delta 本身的语法合法性（独立于主 spec 是否存在对应 requirement）
function validateDelta(delta) {
  const issues = [];

  if (delta.added.length + delta.modified.length + delta.removed.length + delta.renamed.length === 0) {
    issues.push({ level: 'error', message: 'delta has no ADDED/MODIFIED/REMOVED/RENAMED Requirements section' });
  }

  for (const op of ['added', 'modified', 'removed', 'renamed']) {
    for (const req of delta[op]) {
      if (!req.name) {
        issues.push({ level: 'error', op, message: '### Requirement: has empty name' });
      }
    }
  }

  for (const r of delta.renamed) {
    if (!r.from) {
      issues.push({ level: 'error', op: 'renamed', requirement: r.name, message: 'RENAMED requirement missing From line (expected "- From: <old-name>")' });
    }
    if (r.from && r.from === r.name) {
      issues.push({ level: 'error', op: 'renamed', requirement: r.name, message: 'RENAMED From == new name (no-op)' });
    }
  }

  // 同一个 name 不能同时 ADDED 与 MODIFIED / REMOVED
  const addedNames = new Set(delta.added.map(r => r.name));
  const modifiedNames = new Set(delta.modified.map(r => r.name));
  const removedNames = new Set(delta.removed.map(r => r.name));
  for (const n of addedNames) {
    if (modifiedNames.has(n)) issues.push({ level: 'error', requirement: n, message: 'requirement appears in both ADDED and MODIFIED' });
    if (removedNames.has(n)) issues.push({ level: 'error', requirement: n, message: 'requirement appears in both ADDED and REMOVED' });
  }
  for (const n of modifiedNames) {
    if (removedNames.has(n)) issues.push({ level: 'error', requirement: n, message: 'requirement appears in both MODIFIED and REMOVED' });
  }

  return issues;
}

// 把 delta 应用到主 spec 文本上，返回新文本（纯函数）
// 失败时抛异常，调用方决定是否继续
function applyDeltaToSpec(masterContent, delta, context) {
  context = context || {};
  const allowCreate = context.allowCreate === true; // 允许从空主 spec 开始（新 capability）

  if (!masterContent && !allowCreate) {
    throw new Error('master spec not found and allowCreate=false');
  }

  let content = masterContent || `# ${context.capability || 'Capability'} Specification\n\n## Purpose\n\n{{Purpose to be written}}\n\n## Requirements\n`;

  // 先把 master 拆成 requirements 列表 + 记录 Requirements section 位置
  const split = splitRequirements(content);
  const existing = new Map(split.requirements.map(r => [r.name, r]));

  // === 校验阶段（fail-fast，确保任何一步都能成功） ===

  for (const r of delta.added) {
    if (existing.has(r.name)) {
      throw new Error(`ADDED '${r.name}' already exists in master spec`);
    }
  }
  for (const r of delta.modified) {
    if (!existing.has(r.name)) {
      throw new Error(`MODIFIED '${r.name}' not found in master spec`);
    }
  }
  for (const r of delta.removed) {
    if (!existing.has(r.name)) {
      throw new Error(`REMOVED '${r.name}' not found in master spec`);
    }
  }
  for (const r of delta.renamed) {
    if (!r.from) {
      throw new Error(`RENAMED '${r.name}' missing '- From:' line`);
    }
    if (!existing.has(r.from)) {
      throw new Error(`RENAMED From '${r.from}' not found in master spec`);
    }
    if (existing.has(r.name) && r.name !== r.from) {
      throw new Error(`RENAMED target '${r.name}' already exists in master spec`);
    }
  }

  // === 应用阶段 ===

  // 用一个有序数组来表示最终 requirements 列表
  const ordered = split.requirements.slice();

  // MODIFIED：按 name 替换整块
  for (const r of delta.modified) {
    const idx = ordered.findIndex(x => x.name === r.name);
    ordered[idx] = { name: r.name, block: r.block };
  }

  // REMOVED：按 name 删除
  for (const r of delta.removed) {
    const idx = ordered.findIndex(x => x.name === r.name);
    if (idx >= 0) ordered.splice(idx, 1);
  }

  // RENAMED：改 header 名；若 body 非空则替换 body，否则保留原 body
  for (const r of delta.renamed) {
    const idx = ordered.findIndex(x => x.name === r.from);
    if (idx < 0) continue;
    const newBlock = r.body
      ? `### Requirement: ${r.name}\n\n${r.body}`
      : ordered[idx].block.replace(/^### Requirement:.*$/m, `### Requirement: ${r.name}`);
    ordered[idx] = { name: r.name, block: newBlock };
  }

  // ADDED：追加到末尾
  for (const r of delta.added) {
    ordered.push({ name: r.name, block: r.block });
  }

  // 重建 markdown：preamble + requirements，用空行分隔，保证每个 block 之间有空行
  const parts = [];
  if (split.preamble) parts.push(split.preamble.replace(/\s+$/g, ''));
  for (const req of ordered) {
    parts.push(req.block.replace(/\s+$/g, ''));
  }
  return parts.join('\n\n') + '\n';
}

// 列出 changes/ 下的未归档 change 目录
function listChanges(cwd) {
  const changesRoot = path.join(cwd, '.planning', CHANGES_DIR);
  if (!fs.existsSync(changesRoot)) return { changes: [], archived: [] };

  const changes = [];
  const archived = [];

  for (const entry of fs.readdirSync(changesRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === ARCHIVE_DIR) continue;
    if (!validChangeId(entry.name)) continue;
    changes.push({
      id: entry.name,
      path: path.join(changesRoot, entry.name),
      has_proposal: fs.existsSync(path.join(changesRoot, entry.name, 'proposal.md')),
      has_tasks: fs.existsSync(path.join(changesRoot, entry.name, 'tasks.md')),
      has_design: fs.existsSync(path.join(changesRoot, entry.name, 'design.md')),
      deltas: listDeltaFiles(path.join(changesRoot, entry.name))
    });
  }

  const archiveRoot = path.join(changesRoot, ARCHIVE_DIR);
  if (fs.existsSync(archiveRoot)) {
    for (const entry of fs.readdirSync(archiveRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      archived.push({ id: entry.name, path: path.join(archiveRoot, entry.name) });
    }
  }

  changes.sort((a, b) => a.id.localeCompare(b.id));
  archived.sort((a, b) => a.id.localeCompare(b.id));
  return { changes, archived };
}

function listDeltaFiles(changeDir) {
  const specsDir = path.join(changeDir, 'specs');
  if (!fs.existsSync(specsDir)) return [];
  const out = [];
  for (const capEntry of fs.readdirSync(specsDir, { withFileTypes: true })) {
    if (!capEntry.isDirectory()) continue;
    if (!spec.CAPABILITY_PATTERN.test(capEntry.name)) continue;
    const specPath = path.join(specsDir, capEntry.name, 'spec.md');
    if (fs.existsSync(specPath)) {
      out.push({ capability: capEntry.name, path: specPath });
    }
  }
  return out;
}

function showChange(cwd, id) {
  if (!validChangeId(id)) return { error: 'invalid change id: ' + id };
  const changeDir = path.join(cwd, '.planning', CHANGES_DIR, id);
  if (!fs.existsSync(changeDir)) return { error: 'change not found: ' + changeDir };

  const proposal = utils.readFile(path.join(changeDir, 'proposal.md'));
  const tasks = utils.readFile(path.join(changeDir, 'tasks.md'));
  const design = utils.readFile(path.join(changeDir, 'design.md'));

  const deltas = [];
  for (const d of listDeltaFiles(changeDir)) {
    const content = utils.readFile(d.path);
    const parsed = parseDelta(content);
    deltas.push({
      capability: d.capability,
      path: d.path,
      added_count: parsed.added.length,
      modified_count: parsed.modified.length,
      removed_count: parsed.removed.length,
      renamed_count: parsed.renamed.length
    });
  }

  return { id, path: changeDir, has_proposal: proposal !== null, has_tasks: tasks !== null, has_design: design !== null, deltas };
}

function validateChange(cwd, id) {
  if (!validChangeId(id)) {
    return { valid: false, issues: [{ level: 'error', message: 'invalid change id (expected kebab-case)' }] };
  }
  const changeDir = path.join(cwd, '.planning', CHANGES_DIR, id);
  if (!fs.existsSync(changeDir)) {
    return { valid: false, issues: [{ level: 'error', message: 'change directory not found' }] };
  }

  const issues = [];

  if (!fs.existsSync(path.join(changeDir, 'proposal.md'))) {
    issues.push({ level: 'error', message: 'proposal.md missing' });
  }
  if (!fs.existsSync(path.join(changeDir, 'tasks.md'))) {
    issues.push({ level: 'error', message: 'tasks.md missing' });
  }

  const deltaFiles = listDeltaFiles(changeDir);
  if (deltaFiles.length === 0) {
    issues.push({ level: 'error', message: 'no delta spec files under specs/<capability>/spec.md' });
  }

  const specsRoot = path.join(cwd, '.planning', 'specs');

  for (const d of deltaFiles) {
    const content = utils.readFile(d.path);
    const delta = parseDelta(content);
    for (const it of validateDelta(delta)) {
      issues.push({ ...it, capability: d.capability });
    }

    // 语义校验：MODIFIED/REMOVED/RENAMED 的目标在主 spec 里必须存在
    // ADDED 在主 spec 里必须不存在
    const masterPath = path.join(specsRoot, d.capability, 'spec.md');
    const master = utils.readFile(masterPath);
    const masterSplit = master ? splitRequirements(master) : { requirements: [] };
    const masterNames = new Set(masterSplit.requirements.map(r => r.name));

    for (const r of delta.added) {
      if (masterNames.has(r.name)) {
        issues.push({ level: 'error', capability: d.capability, requirement: r.name, message: 'ADDED requirement already exists in master spec' });
      }
    }
    for (const r of delta.modified) {
      if (!masterNames.has(r.name)) {
        issues.push({ level: 'error', capability: d.capability, requirement: r.name, message: 'MODIFIED requirement not found in master spec' });
      }
    }
    for (const r of delta.removed) {
      if (!masterNames.has(r.name)) {
        issues.push({ level: 'error', capability: d.capability, requirement: r.name, message: 'REMOVED requirement not found in master spec' });
      }
    }
    for (const r of delta.renamed) {
      if (r.from && !masterNames.has(r.from)) {
        issues.push({ level: 'error', capability: d.capability, requirement: r.name, message: `RENAMED From '${r.from}' not found in master spec` });
      }
      if (masterNames.has(r.name) && r.name !== r.from) {
        issues.push({ level: 'error', capability: d.capability, requirement: r.name, message: 'RENAMED target name already exists in master spec' });
      }
    }
  }

  const hasError = issues.some(it => it.level === 'error');
  return { valid: !hasError, id, path: changeDir, deltas: deltaFiles.length, issues };
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// 把 change 合并到主 specs/，移动到 archive/YYYY-MM-DD-<id>/
function archiveChange(cwd, id, options) {
  options = options || {};
  const dryRun = options.dryRun === true;

  const validation = validateChange(cwd, id);
  if (!validation.valid) {
    return { ok: false, reason: 'validation failed', issues: validation.issues };
  }

  const changeDir = path.join(cwd, '.planning', CHANGES_DIR, id);
  const specsRoot = path.join(cwd, '.planning', 'specs');
  const deltaFiles = listDeltaFiles(changeDir);

  const applied = [];

  for (const d of deltaFiles) {
    const content = utils.readFile(d.path);
    const delta = parseDelta(content);
    const masterPath = path.join(specsRoot, d.capability, 'spec.md');
    const master = utils.readFile(masterPath);

    let newContent;
    try {
      newContent = applyDeltaToSpec(master, delta, {
        capability: d.capability,
        allowCreate: master === null
      });
    } catch (e) {
      return { ok: false, reason: 'merge conflict on ' + d.capability, error: e.message };
    }

    applied.push({ capability: d.capability, masterPath, newContent, created: master === null });
  }

  if (dryRun) {
    return { ok: true, dry_run: true, applied: applied.map(a => ({ capability: a.capability, created: a.created, masterPath: a.masterPath })) };
  }

  // 真正写入 specs/
  for (const a of applied) {
    utils.writeFile(a.masterPath, a.newContent);
  }

  // 移动到 archive/YYYY-MM-DD-<id>/
  const archiveDir = path.join(cwd, '.planning', CHANGES_DIR, ARCHIVE_DIR, `${todayStamp()}-${id}`);
  fs.mkdirSync(path.dirname(archiveDir), { recursive: true });
  fs.renameSync(changeDir, archiveDir);

  return {
    ok: true,
    archived_to: archiveDir,
    merged: applied.map(a => ({ capability: a.capability, created: a.created, path: a.masterPath }))
  };
}

// 命令分发
function run(cwd, args) {
  const sub = args[0];

  if (sub === 'list') {
    utils.output(listChanges(cwd));
    return;
  }

  if (sub === 'show') {
    const id = args[1];
    const result = showChange(cwd, id);
    if (result.error) { utils.error(result.error); process.exit(1); }
    utils.output(result);
    return;
  }

  if (sub === 'validate') {
    const id = args[1];
    if (!id) { utils.error('用法: wf-tools change validate <id>'); process.exit(1); }
    const result = validateChange(cwd, id);
    utils.output(result);
    process.exit(result.valid ? 0 : 1);
  }

  if (sub === 'archive') {
    const id = args[1];
    if (!id) { utils.error('用法: wf-tools change archive <id> [--dry-run]'); process.exit(1); }
    const result = archiveChange(cwd, id, { dryRun: args.includes('--dry-run') });
    utils.output(result);
    process.exit(result.ok ? 0 : 1);
  }

  utils.error('用法: wf-tools change [list|show <id>|validate <id>|archive <id> [--dry-run]]');
  process.exit(1);
}

module.exports = {
  parseDelta,
  validateDelta,
  splitRequirements,
  applyDeltaToSpec,
  listChanges,
  showChange,
  validateChange,
  archiveChange,
  run,
  CHANGE_ID_PATTERN
};
