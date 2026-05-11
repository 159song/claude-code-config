# {{change_id}}

## Why

{{解释这次变更要解决什么问题、为什么现在做、什么痛点被触发。
不写"怎么做"，只写"为什么要做"。2-5 句话。}}

## What Changes

{{用列表形式列出高层变更。这一节是给人类审阅者看的"一眼看懂"摘要，
对应的机器可读增量在 specs/<capability>/spec.md 的 delta 段。}}

- {{高层变更 1}}
- {{高层变更 2}}
- {{高层变更 3}}

## Capabilities

### New Capabilities

- `{{capability_name}}`: {{一句话描述}}

### Modified Capabilities

- `{{existing_capability}}`: {{此次变更对该 capability 的影响}}

### Removed Capabilities

- `{{deprecated_capability}}`: {{为什么移除}}

## Impact

{{简列预计会改动的文件/模块/测试。不必穷尽，列出关键面即可。}}

- `path/to/file.ext` -- {{一句话说明}}
- `path/to/other.ext` -- {{一句话说明}}
