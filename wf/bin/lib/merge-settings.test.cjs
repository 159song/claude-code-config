#!/usr/bin/env node
// merge-settings.test.cjs — merge-settings 合并逻辑单元测试
'use strict';

const assert = require('assert');
const { mergeSettings, mergeHookArray, mergePermissions, mergeEnv, mergeStatusLine } = require('./merge-settings.cjs');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (e) {
    failed++;
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`    ${e.message}`);
  }
}

// ─── mergeHookArray ──────────────────────────────

console.log('\nmergeHookArray:');

test('source 为空时返回 target', () => {
  const target = [{ hooks: [{ command: 'echo hi' }] }];
  const result = mergeHookArray(null, target);
  assert.deepStrictEqual(result, target);
});

test('target 为空时返回 source 副本', () => {
  const source = [{ hooks: [{ command: 'node wf-test.js' }] }];
  const result = mergeHookArray(source, null);
  assert.deepStrictEqual(result, source);
  assert.notStrictEqual(result, source); // 是副本
});

test('追加新的 WF hook 到已有数组', () => {
  const source = [{ matcher: 'Write', hooks: [{ command: 'node wf-guard.js' }] }];
  const target = [{ matcher: 'Write', hooks: [{ command: 'prettier --write' }] }];
  const result = mergeHookArray(source, target);
  assert.strictEqual(result.length, 2);
  assert.ok(result[0].hooks[0].command.includes('prettier'));
  assert.ok(result[1].hooks[0].command.includes('wf-guard'));
});

test('更新已有的 WF hook 而非重复追加', () => {
  const source = [{ matcher: 'Bash|Write', hooks: [{ command: 'node wf-monitor.js', timeout: 15 }] }];
  const target = [
    { matcher: 'Write', hooks: [{ command: 'prettier' }] },
    { matcher: 'Bash', hooks: [{ command: 'node wf-monitor.js', timeout: 10 }] },
  ];
  const result = mergeHookArray(source, target);
  assert.strictEqual(result.length, 2);
  // WF hook 被更新
  const wfHook = result.find(e => e.hooks[0].command.includes('wf-monitor'));
  assert.strictEqual(wfHook.matcher, 'Bash|Write');
  assert.strictEqual(wfHook.hooks[0].timeout, 15);
});

test('非 WF 条目直接追加', () => {
  const source = [{ hooks: [{ command: 'echo non-wf' }] }];
  const target = [{ hooks: [{ command: 'echo existing' }] }];
  const result = mergeHookArray(source, target);
  assert.strictEqual(result.length, 2);
});

// ─── mergePermissions ────────────────────────────

console.log('\nmergePermissions:');

test('source 为空时返回 target', () => {
  const target = { allow: ['Edit(*)'] };
  assert.deepStrictEqual(mergePermissions(null, target), target);
});

test('target 为空时返回 source 副本', () => {
  const source = { allow: ['Edit(*)'], deny: ['Bash(rm *)'] };
  const result = mergePermissions(source, null);
  assert.deepStrictEqual(result, source);
});

test('合并 allow 数组去重', () => {
  const source = { allow: ['Edit(*)', 'Write(*)', 'Bash(*)'] };
  const target = { allow: ['Edit(*)', 'Read(*)'] };
  const result = mergePermissions(source, target);
  assert.strictEqual(result.allow.length, 4); // Edit, Read, Write, Bash
  assert.ok(result.allow.includes('Read(*)')); // target 保留
  assert.ok(result.allow.includes('Write(*)')); // source 新增
});

test('合并 deny 数组去重', () => {
  const source = { deny: ['Bash(rm -rf *)'] };
  const target = { deny: ['Bash(rm -rf *)', 'Bash(mkfs *)'] };
  const result = mergePermissions(source, target);
  assert.strictEqual(result.deny.length, 2); // 不重复
});

test('保留 target 独有的 key', () => {
  const source = { allow: ['Edit(*)'] };
  const target = { allow: ['Read(*)'], ask: ['Bash(npm *)'] };
  const result = mergePermissions(source, target);
  assert.deepStrictEqual(result.ask, ['Bash(npm *)']);
});

// ─── mergeEnv ────────────────────────────────────

console.log('\nmergeEnv:');

test('target 值优先于 source', () => {
  const source = { MAX_THINKING_TOKENS: '10000', NEW_VAR: 'hello' };
  const target = { MAX_THINKING_TOKENS: '5000' };
  const result = mergeEnv(source, target);
  assert.strictEqual(result.MAX_THINKING_TOKENS, '5000'); // target 优先
  assert.strictEqual(result.NEW_VAR, 'hello'); // source 补充
});

test('source 为空返回 target', () => {
  const target = { FOO: 'bar' };
  assert.deepStrictEqual(mergeEnv(null, target), target);
});

// ─── mergeStatusLine ─────────────────────────────

console.log('\nmergeStatusLine:');

test('target 无 statusLine 时使用 source', () => {
  const source = { type: 'command', command: 'node wf-statusline.js' };
  assert.deepStrictEqual(mergeStatusLine(source, undefined), source);
});

test('target 有 WF statusLine 时更新', () => {
  const source = { type: 'command', command: 'node wf-statusline.js --new' };
  const target = { type: 'command', command: 'node wf-statusline.js --old' };
  const result = mergeStatusLine(source, target);
  assert.ok(result.command.includes('--new'));
});

test('target 有非 WF statusLine 时保留', () => {
  const source = { type: 'command', command: 'node wf-statusline.js' };
  const target = { type: 'command', command: 'node my-custom-status.js' };
  const result = mergeStatusLine(source, target);
  assert.ok(result.command.includes('my-custom-status'));
});

// ─── mergeSettings (集成) ────────────────────────

console.log('\nmergeSettings (集成):');

test('全新安装: 空 target 返回 source 所有内容', () => {
  const source = {
    hooks: { SessionStart: [{ hooks: [{ command: 'node wf-session.js' }] }] },
    statusLine: { command: 'node wf-statusline.js' },
    permissions: { allow: ['Edit(*)'] },
    env: { FOO: 'bar' },
    plansDirectory: './reports',
  };
  const result = mergeSettings(source, {});
  assert.deepStrictEqual(result.hooks, source.hooks);
  assert.deepStrictEqual(result.statusLine, source.statusLine);
  assert.strictEqual(result.plansDirectory, './reports');
});

test('升级: 保留用户配置, 更新 WF hooks', () => {
  const source = {
    hooks: {
      PostToolUse: [{ matcher: 'Bash|Edit', hooks: [{ command: 'node wf-monitor.js', timeout: 15 }] }],
    },
    statusLine: { command: 'node wf-statusline.js' },
    permissions: { allow: ['Edit(*)', 'Write(*)'] },
    env: { MAX_THINKING_TOKENS: '10000' },
    plansDirectory: './reports',
  };
  const target = {
    hooks: {
      PostToolUse: [
        { matcher: 'Write', hooks: [{ command: 'prettier --write "$FILE_PATH"' }] },
        { matcher: 'Bash', hooks: [{ command: 'node wf-monitor.js', timeout: 10 }] },
      ],
    },
    permissions: { allow: ['Edit(*)', 'Read(*)'] },
    env: { MAX_THINKING_TOKENS: '5000', CUSTOM: 'yes' },
    plansDirectory: './my-plans',
    outputStyle: 'Explanatory',
  };

  const result = mergeSettings(source, target);

  // hooks: user prettier 保留, wf-monitor 更新
  assert.strictEqual(result.hooks.PostToolUse.length, 2);
  const wfHook = result.hooks.PostToolUse.find(e => e.hooks[0].command.includes('wf-monitor'));
  assert.strictEqual(wfHook.hooks[0].timeout, 15); // 更新
  assert.strictEqual(wfHook.matcher, 'Bash|Edit'); // 更新

  // permissions: 并集
  assert.ok(result.permissions.allow.includes('Read(*)')); // target
  assert.ok(result.permissions.allow.includes('Write(*)')); // source

  // env: target 优先
  assert.strictEqual(result.env.MAX_THINKING_TOKENS, '5000');
  assert.strictEqual(result.env.CUSTOM, 'yes');

  // 其他: target 保留
  assert.strictEqual(result.plansDirectory, './my-plans');
  assert.strictEqual(result.outputStyle, 'Explanatory');
});

test('source 有新的 hook 事件类型时追加', () => {
  const source = {
    hooks: {
      SessionStart: [{ hooks: [{ command: 'node wf-session.js' }] }],
      PreToolUse: [{ matcher: 'Write', hooks: [{ command: 'node wf-guard.js' }] }],
    },
  };
  const target = {
    hooks: {
      PostToolUse: [{ matcher: 'Write', hooks: [{ command: 'prettier' }] }],
    },
  };
  const result = mergeSettings(source, target);
  assert.ok(result.hooks.SessionStart); // source 新增
  assert.ok(result.hooks.PreToolUse); // source 新增
  assert.ok(result.hooks.PostToolUse); // target 保留
});

test('target 有额外顶层字段时保留', () => {
  const source = { env: { A: '1' } };
  const target = { spinnerTipsEnabled: true, respectGitignore: true };
  const result = mergeSettings(source, target);
  assert.strictEqual(result.spinnerTipsEnabled, true);
  assert.strictEqual(result.respectGitignore, true);
});

// ─── 结果 ────────────────────────────────────────

console.log(`\n结果: ${passed} 通过, ${failed} 失败\n`);
process.exit(failed > 0 ? 1 : 0);
