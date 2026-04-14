#!/usr/bin/env node
'use strict';
// wf-session-state.js -- SessionStart hook: structured JSON session state
// Replaces wf-session-state.sh (per D-14)
// Outputs: human-readable Chinese summary + structured hookSpecificOutput JSON
// Also writes bridge file to /tmp/ for other hooks and /wf-resume (per D-15)

const fs = require('fs');
const path = require('path');
const os = require('os');

let input = '';
const stdinTimeout = setTimeout(() => process.exit(0), 15000);
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
  clearTimeout(stdinTimeout);
  try {
    main();
  } catch (e) {
    process.exit(0);
  }
});

/**
 * Inline minimal frontmatter parser (self-contained, avoid loading full state.cjs in hook context)
 * Supports 2-level nested YAML keys
 * @param {string} content - file content with --- delimited frontmatter
 * @returns {{ frontmatter: object, body: string }}
 */
function parseFm(content) {
  if (!content || !content.startsWith('---\n')) {
    return { frontmatter: {}, body: content || '' };
  }
  const endIdx = content.indexOf('\n---\n', 4);
  if (endIdx === -1) {
    return { frontmatter: {}, body: content };
  }

  const yamlBlock = content.slice(4, endIdx);
  const lines = yamlBlock.split('\n');
  const fm = {};
  let currentParent = null;

  for (const line of lines) {
    if (!line) continue;

    // Indented line = child key of currentParent
    const indentMatch = line.match(/^(\s+)([\w][\w_]*):\s*(.*)$/);
    if (indentMatch && currentParent) {
      if (typeof fm[currentParent] !== 'object' || fm[currentParent] === null) {
        fm[currentParent] = {};
      }
      fm[currentParent][indentMatch[2]] = parseVal(indentMatch[3].trim());
      continue;
    }

    // Top-level key
    const match = line.match(/^([\w][\w_]*):\s*(.*)$/);
    if (match) {
      const value = match[2].trim();
      if (value === '') {
        fm[match[1]] = null;
        currentParent = match[1];
      } else {
        fm[match[1]] = parseVal(value);
        currentParent = null;
      }
    }
  }

  return { frontmatter: fm, body: content.slice(endIdx + 5) };
}

/**
 * Parse simple YAML value
 * @param {string} v - raw value string
 * @returns {*}
 */
function parseVal(v) {
  if (v === undefined || v === null) return null;
  v = String(v).trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  if (/^\d+\.\d+$/.test(v)) return parseFloat(v);
  if (v === 'true') return true;
  if (v === 'false') return false;
  if (v === 'null' || v === '~' || v === '') return null;
  return v;
}

/**
 * Detect current workflow step by checking phase directory artifacts
 * @param {string} projectRoot - project root path
 * @param {number|null} phaseNum - current phase number
 * @returns {string} 'discuss'|'plan'|'execute'|'verify'|'done'|'unknown'
 */
function detectStep(projectRoot, phaseNum) {
  if (!phaseNum) return 'unknown';

  const phasesDir = path.join(projectRoot, '.planning', 'phases');
  if (!fs.existsSync(phasesDir)) return 'discuss';

  // Find phase directory (padded format: 01-name, 02-name, etc.)
  const padded = String(phaseNum).padStart(2, '0');
  let phaseDir = null;
  try {
    const dirs = fs.readdirSync(phasesDir).filter(d => d.startsWith(padded + '-'));
    if (dirs.length > 0) {
      phaseDir = path.join(phasesDir, dirs[0]);
    }
  } catch (e) {
    return 'discuss';
  }

  if (!phaseDir || !fs.existsSync(phaseDir)) return 'discuss';

  // Check for artifacts in reverse lifecycle order
  try {
    const files = fs.readdirSync(phaseDir);

    const hasVerification = files.some(f => f.includes('VERIFICATION'));
    const hasSummary = files.some(f => f.includes('SUMMARY'));
    const hasPlan = files.some(f => f.match(/\d+-\d+-PLAN/));
    const hasContext = files.some(f => f.includes('CONTEXT'));

    if (hasVerification) return 'done';
    if (hasSummary) return 'verify';
    if (hasPlan) return 'execute';
    if (hasContext) return 'plan';
    return 'discuss';
  } catch (e) {
    return 'discuss';
  }
}

function main() {
  const data = JSON.parse(input);
  const sessionId = data.session_id || '';

  // Exit silently if no session ID
  if (!sessionId) process.exit(0);

  // T-04-02: Validate session_id to prevent path traversal
  if (/[/\\]|\.\./.test(sessionId)) process.exit(0);

  const cwd = data.cwd || process.cwd();
  const homeDir = os.homedir();
  const libDir = path.join(homeDir, '.claude', 'wf', 'bin', 'lib');

  // Load utils module for file I/O helpers
  let utils;
  try {
    utils = require(path.join(libDir, 'utils.cjs'));
  } catch (e) {
    process.exit(0);
  }

  const projectRoot = utils.findProjectRoot(cwd);

  // Read STATE.md for basic info
  const stateContent = utils.readFile(path.join(projectRoot, '.planning', 'STATE.md'));
  if (!stateContent) {
    process.stdout.write('## 项目状态提醒\n\n没有检测到 .planning/ 目录 -- 建议运行 /wf-new-project 初始化项目。\n');
    process.exit(0);
  }

  // Parse frontmatter (inline lightweight parser)
  const { frontmatter } = parseFm(stateContent);

  // Extract phase number
  const phaseNum = (frontmatter.progress && frontmatter.progress.current_phase) || null;

  // Check for HANDOFF.json existence
  const handoffPath = path.join(projectRoot, '.planning', 'HANDOFF.json');
  const hasHandoff = fs.existsSync(handoffPath);

  // Read HANDOFF.json for resume_hint if present
  let resumeHint = null;
  if (hasHandoff) {
    const handoffData = utils.readJson(handoffPath);
    if (handoffData && handoffData.resume_command) {
      resumeHint = handoffData.resume_command;
    }
  }

  // Check for CONTINUATION.md (auto-compact recovery checkpoint)
  const continuationPath = path.join(projectRoot, '.planning', 'CONTINUATION.md');
  const hasContinuation = fs.existsSync(continuationPath);
  let continuationPhase = null;
  let continuationStep = null;
  if (hasContinuation) {
    try {
      const contContent = fs.readFileSync(continuationPath, 'utf8');
      const { frontmatter: contFm } = parseFm(contContent);
      continuationPhase = contFm.phase || null;
      continuationStep = contFm.step || null;
    } catch (e) {}
  }

  // D-13: Build structured session state JSON
  const sessionState = {
    milestone: frontmatter.milestone || null,
    phase: phaseNum,
    step: detectStep(projectRoot, phaseNum),
    status: frontmatter.status || 'unknown',
    progress_pct: (frontmatter.progress && frontmatter.progress.percent) || 0,
    has_handoff: hasHandoff,
    resume_hint: resumeHint,
    has_continuation: hasContinuation,
    continuation_phase: continuationPhase,
    continuation_step: continuationStep
  };

  // D-16: Build human-readable Chinese summary
  let humanReadable = '## 项目状态提醒\n\n';
  humanReadable += `阶段 ${sessionState.phase || '?'} | 步骤: ${sessionState.step} | 状态: ${sessionState.status} | 进度: ${sessionState.progress_pct}%\n`;
  if (sessionState.has_continuation) {
    humanReadable += `检测到自主模式检查点: Phase ${sessionState.continuation_phase} / ${sessionState.continuation_step}。运行 /wf-autonomous 自动从检查点恢复。\n`;
  } else if (sessionState.has_handoff) {
    humanReadable += '存在暂停检查点，运行 /wf-resume 恢复。\n';
  }

  // Append config mode if available
  const configContent = utils.readJson(path.join(projectRoot, '.planning', 'config.json'));
  if (configContent && configContent.mode) {
    humanReadable += `配置: mode=${configContent.mode}\n`;
  }

  // D-15 + D-16: Output human summary then structured JSON
  const hookOutput = {
    hookSpecificOutput: {
      hookEventName: 'SessionStart',
      additionalContext: JSON.stringify(sessionState)
    }
  };
  process.stdout.write(humanReadable + '\n' + JSON.stringify(hookOutput));

  // D-15: Write bridge file to /tmp/ for other hooks
  const bridgePath = path.join(os.tmpdir(), `wf-session-${sessionId}.json`);
  try {
    fs.writeFileSync(bridgePath, JSON.stringify(sessionState));
  } catch (e) {}
}
