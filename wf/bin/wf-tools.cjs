#!/usr/bin/env node
// wf-tools.cjs — WF 工作流系统 CLI 工具
// 提供状态管理、路线图分析、模板渲染等功能
//
// 用法:
//   node wf-tools.cjs <command> [args]
//
// 命令:
//   init <type>          初始化工作流上下文
//   state get <key>      读取状态值
//   state set <key> <v>  设置状态值
//   state json           输出完整状态为 JSON
//   roadmap analyze      分析路线图，输出阶段信息
//   phase info <N>       获取阶段 N 的详细信息
//   progress             计算并输出整体进度

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const PLANNING_DIR = '.planning';

// ─── 工具函数 ────────────────────────────────

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function readJson(filePath) {
  const content = readFile(filePath);
  if (!content) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function writeFile(filePath, content) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(filePath, content, 'utf8');
}

function ensurePlanningDir() {
  if (!fs.existsSync(PLANNING_DIR)) {
    fs.mkdirSync(PLANNING_DIR, { recursive: true });
  }
}

// ─── STATE 管理 ──────────────────────────────

function parseStateMd() {
  const content = readFile(path.join(PLANNING_DIR, 'STATE.md'));
  if (!content) return {};

  const state = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const match = line.match(/^-\s+\*\*(.+?):\*\*\s+(.+)$/);
    if (match) {
      const key = match[1].toLowerCase().replace(/\s+/g, '_');
      state[key] = match[2].trim();
    }
  }

  return state;
}

function stateGet(key) {
  const state = parseStateMd();
  const value = state[key] || state[key.replace(/-/g, '_')];
  if (value) {
    process.stdout.write(value);
  }
}

function stateSet(key, value) {
  const statePath = path.join(PLANNING_DIR, 'STATE.md');
  let content = readFile(statePath);

  if (!content) {
    content = `# 项目状态\n\n## 当前状态\n\n- **${key}:** ${value}\n`;
    writeFile(statePath, content);
    return;
  }

  const keyPattern = new RegExp(`^(- \\*\\*${key}:\\*\\*\\s+)(.+)$`, 'mi');
  if (keyPattern.test(content)) {
    content = content.replace(keyPattern, `$1${value}`);
  } else {
    content = content.replace(
      /^(## 当前状态\n\n)/m,
      `$1- **${key}:** ${value}\n`
    );
  }

  writeFile(statePath, content);
}

function stateJson() {
  const state = parseStateMd();
  process.stdout.write(JSON.stringify(state, null, 2));
}

// ─── ROADMAP 分析 ─────────────────────────────

function roadmapAnalyze() {
  const content = readFile(path.join(PLANNING_DIR, 'ROADMAP.md'));
  if (!content) {
    process.stderr.write('错误: ROADMAP.md 不存在\n');
    process.exit(1);
  }

  const phases = [];
  const phasePattern = /^##\s+Phase\s+(\d+):\s*(.+)$/gm;
  let match;

  while ((match = phasePattern.exec(content)) !== null) {
    const num = parseInt(match[1]);
    const name = match[2].trim();

    const phaseDir = path.join(PLANNING_DIR, `phase-${num}`);
    const hasContext = fs.existsSync(path.join(phaseDir, 'CONTEXT.md'));
    const hasPlans = fs.existsSync(phaseDir) &&
      fs.readdirSync(phaseDir).some(f => f.startsWith('PLAN'));
    const hasSummary = fs.existsSync(phaseDir) &&
      fs.readdirSync(phaseDir).some(f => f.startsWith('SUMMARY'));
    const hasVerification = fs.existsSync(path.join(phaseDir, 'VERIFICATION.md'));

    let status = 'pending';
    if (hasVerification) status = 'verified';
    else if (hasSummary) status = 'executed';
    else if (hasPlans) status = 'planned';
    else if (hasContext) status = 'discussed';

    phases.push({ num, name, status, hasContext, hasPlans, hasSummary, hasVerification });
  }

  const result = {
    total_phases: phases.length,
    phases,
    current_phase: phases.find(p => p.status !== 'verified')?.num || null,
    completed_phases: phases.filter(p => p.status === 'verified').length,
  };

  process.stdout.write(JSON.stringify(result, null, 2));
}

// ─── PHASE INFO ──────────────────────────────

function phaseInfo(phaseNum) {
  const phaseDir = path.join(PLANNING_DIR, `phase-${phaseNum}`);

  const info = {
    phase: phaseNum,
    directory: phaseDir,
    exists: fs.existsSync(phaseDir),
    files: {},
  };

  if (info.exists) {
    const files = fs.readdirSync(phaseDir);
    info.files = {
      context: files.find(f => f === 'CONTEXT.md') || null,
      plans: files.filter(f => f.startsWith('PLAN')),
      summaries: files.filter(f => f.startsWith('SUMMARY')),
      verification: files.find(f => f === 'VERIFICATION.md') || null,
      research: files.find(f => f === 'RESEARCH.md') || null,
      threat_model: files.find(f => f === 'THREAT-MODEL.md') || null,
    };
  }

  const roadmap = readFile(path.join(PLANNING_DIR, 'ROADMAP.md'));
  if (roadmap) {
    const pattern = new RegExp(
      `## Phase ${phaseNum}:\\s*(.+?)\\n\\n\\*\\*目标:\\*\\*\\s*(.+?)\\n`,
      's'
    );
    const rmMatch = roadmap.match(pattern);
    if (rmMatch) {
      info.name = rmMatch[1].trim();
      info.goal = rmMatch[2].trim();
    }
  }

  process.stdout.write(JSON.stringify(info, null, 2));
}

// ─── PROGRESS 计算 ────────────────────────────

function calculateProgress() {
  const roadmap = readFile(path.join(PLANNING_DIR, 'ROADMAP.md'));
  if (!roadmap) {
    process.stdout.write(JSON.stringify({ progress: 0, phases: [] }));
    return;
  }

  const phasePattern = /^##\s+Phase\s+(\d+):/gm;
  const phaseNums = [];
  let match;
  while ((match = phasePattern.exec(roadmap)) !== null) {
    phaseNums.push(parseInt(match[1]));
  }

  const phases = phaseNums.map(num => {
    const phaseDir = path.join(PLANNING_DIR, `phase-${num}`);
    let steps = 0;
    const total = 4;

    if (fs.existsSync(path.join(phaseDir, 'CONTEXT.md'))) steps++;
    if (fs.existsSync(phaseDir) &&
      fs.readdirSync(phaseDir).some(f => f.startsWith('PLAN'))) steps++;
    if (fs.existsSync(phaseDir) &&
      fs.readdirSync(phaseDir).some(f => f.startsWith('SUMMARY'))) steps++;
    if (fs.existsSync(path.join(phaseDir, 'VERIFICATION.md'))) steps++;

    return { phase: num, progress: Math.round((steps / total) * 100) };
  });

  const overall = phases.length > 0
    ? Math.round(phases.reduce((sum, p) => sum + p.progress, 0) / phases.length)
    : 0;

  process.stdout.write(JSON.stringify({ progress: overall, phases }));
}

// ─── GIT 操作 ─────────────────────────────────

function gitCommitPlanning(message) {
  try {
    execFileSync('git', ['add', '.planning/'], { stdio: 'pipe' });
    execFileSync('git', ['commit', '-m', message], { stdio: 'pipe' });
    process.stdout.write('提交成功');
  } catch (e) {
    process.stderr.write(`提交失败: ${e.message}\n`);
    process.exit(1);
  }
}

// ─── INIT ────────────────────────────────────

function init(type) {
  ensurePlanningDir();

  switch (type) {
    case 'new-project':
      process.stdout.write(JSON.stringify({
        planning_dir: PLANNING_DIR,
        has_project: fs.existsSync(path.join(PLANNING_DIR, 'PROJECT.md')),
        has_config: fs.existsSync(path.join(PLANNING_DIR, 'config.json')),
        has_roadmap: fs.existsSync(path.join(PLANNING_DIR, 'ROADMAP.md')),
      }));
      break;

    case 'execute-phase':
    case 'plan-phase':
    case 'discuss-phase': {
      const config = readJson(path.join(PLANNING_DIR, 'config.json')) || {};
      const state = parseStateMd();
      process.stdout.write(JSON.stringify({
        config,
        state,
        planning_dir: PLANNING_DIR,
      }));
      break;
    }

    default:
      process.stdout.write(JSON.stringify({ planning_dir: PLANNING_DIR }));
  }
}

// ─── 主入口 ──────────────────────────────────

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'init':
    init(args[1]);
    break;
  case 'state':
    if (args[1] === 'get') stateGet(args[2]);
    else if (args[1] === 'set') stateSet(args[2], args.slice(3).join(' '));
    else if (args[1] === 'json') stateJson();
    else { process.stderr.write('用法: wf-tools state [get|set|json]\n'); process.exit(1); }
    break;
  case 'roadmap':
    if (args[1] === 'analyze') roadmapAnalyze();
    else { process.stderr.write('用法: wf-tools roadmap analyze\n'); process.exit(1); }
    break;
  case 'phase':
    if (args[1] === 'info') phaseInfo(parseInt(args[2]));
    else { process.stderr.write('用法: wf-tools phase info <N>\n'); process.exit(1); }
    break;
  case 'progress':
    calculateProgress();
    break;
  case 'commit':
    gitCommitPlanning(args.slice(1).join(' '));
    break;
  default:
    process.stderr.write(
      'WF Tools v1.0.0\n\n' +
      '命令:\n' +
      '  init <type>          初始化工作流上下文\n' +
      '  state get <key>      读取状态值\n' +
      '  state set <key> <v>  设置状态值\n' +
      '  state json           输出完整状态 JSON\n' +
      '  roadmap analyze      分析路线图\n' +
      '  phase info <N>       获取阶段信息\n' +
      '  progress             计算整体进度\n' +
      '  commit <message>     提交 planning 文件\n'
    );
    process.exit(1);
}
