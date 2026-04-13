#!/usr/bin/env node
'use strict';

// wf-tools.cjs — WF 工作流系统 CLI 工具（纯路由器）
// 将命令分发到 lib/ 模块，不含业务逻辑

const path = require('path');
const core = require('./lib/utils.cjs');
const state = require('./lib/state.cjs');
const roadmap = require('./lib/roadmap.cjs');
const phase = require('./lib/phase.cjs');
const progress = require('./lib/progress.cjs');
const git = require('./lib/git.cjs');
const config = require('./lib/config.cjs');
const init = require('./lib/init.cjs');
const validate = require('./lib/validate.cjs');
const session = require('./lib/session.cjs');

// 解析 --cwd 参数（D-12）
const args = process.argv.slice(2);
let cwd;
const cwdIdx = args.indexOf('--cwd');
if (cwdIdx !== -1 && args[cwdIdx + 1]) {
  cwd = path.resolve(args[cwdIdx + 1]);
  args.splice(cwdIdx, 2);
} else {
  cwd = core.findProjectRoot(process.cwd());
}

const command = args[0];
const subArgs = args.slice(1);

switch (command) {
  case 'init':
    init.run(cwd, args.slice(1));
    break;
  case 'state':
    state.run(cwd, subArgs);
    break;
  case 'roadmap':
    roadmap.run(cwd, subArgs);
    break;
  case 'phase':
    phase.run(cwd, subArgs);
    break;
  case 'progress':
    progress.run(cwd);
    break;
  case 'commit':
    git.run(cwd, subArgs);
    break;
  case 'config':
  case 'settings':
    config.run(cwd, subArgs);
    break;
  case 'validate':
    validate.run(cwd, subArgs);
    break;
  case 'session':
    session.run(cwd, subArgs);
    break;
  case 'phase-ops':
    roadmap.run(cwd, subArgs);
    break;
  default:
    process.stderr.write('WF Tools v1.0.0\n用法: wf-tools [--cwd <path>] <command>\n命令: init|state|roadmap|phase|phase-ops|progress|commit|config|settings|validate|session\n');
    process.exit(1);
}
