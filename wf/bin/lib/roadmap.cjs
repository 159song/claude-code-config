'use strict';

// lib/roadmap.cjs — WF 路线图分析模块
// 解析 ROADMAP.md，支持 H2 和 H3 格式的阶段头（修复 Pitfall 2）

const path = require('path');
const fs = require('fs');
const utils = require('./utils.cjs');

// 同时匹配 ## Phase N: 和 ### Phase N: 格式（H2 和 H3），支持小数点阶段号
const PHASE_PATTERN = /^#{2,3}\s+Phase\s+(\d[\d.]*?):\s*(.+)$/gm;

/**
 * 分析路线图文件，返回所有阶段信息
 * @param {string} cwd - 项目根目录
 * @returns {object} 路线图分析结果
 */
function roadmapAnalyze(cwd) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const content = utils.readFile(roadmapPath);
  if (!content) {
    utils.error('错误: ROADMAP.md 不存在');
    process.exit(1);
  }

  const phases = [];
  // 重置 lastIndex 防止全局 regex 状态残留
  PHASE_PATTERN.lastIndex = 0;
  let match;

  while ((match = PHASE_PATTERN.exec(content)) !== null) {
    const numStr = match[1];
    const num = parseFloat(numStr);
    const name = match[2].trim();

    // 支持两种目录命名约定（Pitfall 3）
    const planningDir = path.join(cwd, '.planning');
    let phaseDir = null;

    // 1. 先查 phases/NN-slug/ (GSD 风格)
    const phasesRoot = path.join(planningDir, 'phases');
    if (fs.existsSync(phasesRoot)) {
      const entries = fs.readdirSync(phasesRoot);
      const matching = entries.find(e => new RegExp(`^0*${Math.floor(num)}-`).test(e));
      if (matching) {
        phaseDir = path.join(phasesRoot, matching);
      }
    }

    // 2. 再查 phase-N/ (WF 风格)
    if (!phaseDir) {
      const wfStyle = path.join(planningDir, `phase-${Math.floor(num)}`);
      if (fs.existsSync(wfStyle)) {
        phaseDir = wfStyle;
      }
    }

    let hasContext = false;
    let hasPlans = false;
    let hasSummary = false;
    let hasVerification = false;
    let verificationPassed = false;

    if (phaseDir && fs.existsSync(phaseDir)) {
      const files = fs.readdirSync(phaseDir);
      hasContext = files.some(f => f.toUpperCase().includes('CONTEXT'));
      hasPlans = files.some(f => f.toUpperCase().includes('PLAN'));
      hasSummary = files.some(f => f.toUpperCase().includes('SUMMARY'));
      hasVerification = files.some(f => f.toUpperCase().includes('VERIFICATION'));

      // 读取 VERIFICATION.md 内容判断实际 PASS/FAIL 状态（不只是文件存在）
      if (hasVerification) {
        const verFile = files.find(f => f.toUpperCase().includes('VERIFICATION'));
        const verContent = utils.readFile(path.join(phaseDir, verFile));
        verificationPassed = verContent ? /\bPASS\b/i.test(verContent) : false;
      }
    }

    let status = 'pending';
    if (verificationPassed) status = 'verified';
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

  return result;
}

/**
 * 添加新阶段到 ROADMAP 末尾（在 Progress 区段之前）
 * @param {string} cwd - 项目根目录
 * @param {string} name - 阶段名称
 * @param {string} goal - 阶段目标
 * @returns {object} 操作结果
 */
function addPhase(cwd, name, goal) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const content = utils.readFile(roadmapPath);
  if (!content) {
    return { success: false, error: 'ROADMAP.md not found' };
  }

  const analysis = roadmapAnalyze(cwd);
  const maxInt = analysis.phases.reduce(
    (max, p) => Math.max(max, Math.floor(p.num)),
    0
  );
  const nextNum = maxInt + 1;

  const phaseBlock = [
    '',
    `### Phase ${nextNum}: ${name}`,
    `**Goal:** ${goal}`,
    `**Depends on**: TBD`,
    `**Requirements**: TBD`,
    `**Plans**: TBD`,
    '',
  ].join('\n');

  // Insert before ## Progress section, or append at end
  const progressMatch = content.match(/^## Progress/m);
  let updated;
  if (progressMatch) {
    const idx = content.indexOf(progressMatch[0]);
    updated = content.slice(0, idx) + phaseBlock + '\n' + content.slice(idx);
  } else {
    updated = content + phaseBlock;
  }

  utils.writeFile(roadmapPath, updated);

  // Re-validate
  const recheck = roadmapAnalyze(cwd);
  const found = recheck.phases.find(p => p.num === nextNum);
  if (!found) {
    return { success: false, error: 'Phase not found after write' };
  }

  return { success: true, phase_number: nextNum, name };
}

/**
 * 在指定阶段之后插入小数编号的新阶段
 * @param {string} cwd - 项目根目录
 * @param {number} afterPhase - 在此阶段之后插入
 * @param {string} name - 阶段名称
 * @param {string} goal - 阶段目标
 * @returns {object} 操作结果
 */
function insertPhase(cwd, afterPhase, name, goal) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const content = utils.readFile(roadmapPath);
  if (!content) {
    return { success: false, error: 'ROADMAP.md not found' };
  }

  const analysis = roadmapAnalyze(cwd);
  const afterNum = parseFloat(afterPhase);
  const existing = analysis.phases.find(p => p.num === afterNum);
  if (!existing) {
    return { success: false, error: `Phase ${afterPhase} not found` };
  }

  // Calculate decimal number, avoiding collisions
  const existingNums = new Set(analysis.phases.map(p => p.num));
  let decimal = afterNum + 0.5;
  let step = 0.25;
  while (existingNums.has(decimal)) {
    decimal = afterNum + step;
    step = step / 2;
  }

  const phaseBlock = [
    '',
    `### Phase ${decimal}: ${name} **INSERTED**`,
    `**Goal:** ${goal}`,
    `**Depends on**: Phase ${afterNum}`,
    `**Requirements**: TBD`,
    `**Plans**: TBD`,
    '',
  ].join('\n');

  // Find end of afterPhase block in the content.
  // The end is the line before the next ### Phase heading or ## Progress or EOF.
  const lines = content.split('\n');
  const afterPhasePattern = new RegExp(`^#{2,3}\\s+Phase\\s+${String(afterNum).replace('.', '\\.')}:\\s`);
  let insertLineIdx = -1;

  let inAfterPhase = false;
  for (let i = 0; i < lines.length; i++) {
    if (afterPhasePattern.test(lines[i])) {
      inAfterPhase = true;
      continue;
    }
    if (inAfterPhase) {
      // Check if this line starts a new phase heading or ## Progress
      if (/^#{2,3}\s+Phase\s+\d/.test(lines[i]) || /^## Progress/.test(lines[i])) {
        insertLineIdx = i;
        break;
      }
    }
  }

  let updated;
  if (insertLineIdx === -1) {
    // Append at end
    updated = content + phaseBlock;
  } else {
    const before = lines.slice(0, insertLineIdx).join('\n');
    const after = lines.slice(insertLineIdx).join('\n');
    updated = before + phaseBlock + '\n' + after;
  }

  utils.writeFile(roadmapPath, updated);

  // Re-validate
  const recheck = roadmapAnalyze(cwd);
  const found = recheck.phases.find(p => p.num === decimal);
  if (!found) {
    return { success: false, error: 'Inserted phase not found after write' };
  }

  return { success: true, phase_number: decimal, name };
}

/**
 * 移除阶段：在 ROADMAP 中标记 REMOVED，并将目录归档
 * @param {string} cwd - 项目根目录
 * @param {number} phaseNum - 要移除的阶段编号
 * @returns {object} 操作结果
 */
function removePhase(cwd, phaseNum) {
  const roadmapPath = path.join(cwd, '.planning', 'ROADMAP.md');
  const content = utils.readFile(roadmapPath);
  if (!content) {
    return { success: false, error: 'ROADMAP.md not found' };
  }

  const num = parseFloat(phaseNum);
  const analysis = roadmapAnalyze(cwd);
  const existing = analysis.phases.find(p => p.num === num);
  if (!existing) {
    return { success: false, error: `Phase ${phaseNum} not found` };
  }

  // Mark the phase heading with **REMOVED**
  const numPattern = String(num).replace('.', '\\.');
  const headingRegex = new RegExp(`(^#{2,3}\\s+Phase\\s+${numPattern}:\\s*.+?)$`, 'm');
  const updated = content.replace(headingRegex, '$1 **REMOVED**');

  utils.writeFile(roadmapPath, updated);

  // Find and archive the phase directory
  const planningDir = path.join(cwd, '.planning');
  let phaseDir = null;
  let dirName = null;

  // Check phases/NN-slug/ (GSD style)
  const phasesRoot = path.join(planningDir, 'phases');
  if (fs.existsSync(phasesRoot)) {
    const entries = fs.readdirSync(phasesRoot);
    const intNum = Math.floor(num);
    const matching = entries.find(e => new RegExp(`^0*${intNum}-`).test(e));
    if (matching) {
      phaseDir = path.join(phasesRoot, matching);
      dirName = matching;
    }
  }

  // Check phase-N/ (WF style)
  if (!phaseDir) {
    const wfStyle = path.join(planningDir, `phase-${Math.floor(num)}`);
    if (fs.existsSync(wfStyle)) {
      phaseDir = wfStyle;
      dirName = `phase-${Math.floor(num)}`;
    }
  }

  let archivedTo = null;
  if (phaseDir && fs.existsSync(phaseDir)) {
    const archiveBase = path.join(planningDir, 'archive');
    fs.mkdirSync(archiveBase, { recursive: true });
    archivedTo = path.join(archiveBase, dirName);
    fs.renameSync(phaseDir, archivedTo);
  }

  return { success: true, phase_number: num, archived_to: archivedTo };
}

/**
 * 命令分发入口
 * @param {string} cwd - 项目根目录
 * @param {string[]} args - 子命令参数
 */
function run(cwd, args) {
  const sub = args[0];
  switch (sub) {
    case 'analyze': {
      const result = roadmapAnalyze(cwd);
      utils.output(result);
      break;
    }
    case 'add': {
      // wf-tools roadmap add <name> <goal>
      const name = args[1];
      const goal = args[2];
      if (!name || !goal) {
        utils.error('用法: wf-tools roadmap add <name> <goal>');
        process.exit(1);
      }
      const result = addPhase(cwd, name, goal);
      utils.output(result);
      break;
    }
    case 'insert': {
      // wf-tools roadmap insert <afterPhase> <name> <goal>
      const afterPhase = parseFloat(args[1]);
      const name = args[2];
      const goal = args[3];
      if (isNaN(afterPhase) || !name || !goal) {
        utils.error('用法: wf-tools roadmap insert <afterPhase> <name> <goal>');
        process.exit(1);
      }
      const result = insertPhase(cwd, afterPhase, name, goal);
      utils.output(result);
      break;
    }
    case 'remove': {
      // wf-tools roadmap remove <phaseNum>
      const phaseNum = parseFloat(args[1]);
      if (isNaN(phaseNum)) {
        utils.error('用法: wf-tools roadmap remove <phaseNum>');
        process.exit(1);
      }
      const result = removePhase(cwd, phaseNum);
      utils.output(result);
      break;
    }
    default:
      utils.error('用法: wf-tools roadmap <analyze|add|insert|remove>');
      process.exit(1);
  }
}

module.exports = { roadmapAnalyze, addPhase, insertPhase, removePhase, run };
