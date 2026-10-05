import assert from 'node:assert/strict';
import '../src/env.js';

// Arthur: NarIyirm
// 中文：此命令显式启用开发草稿，只允许指定开发域名且不修改 .env；正常启动仍遵守 published 门槛。
// EN: Explicitly enable drafts for the named development host without modifying .env; normal startup retains the published-content gate.
const ref = 'thmbtsssvnslotoexntz';
assert.notEqual(process.env.NODE_ENV, 'production');
assert.equal(new URL(process.env.SUPABASE_URL).hostname, `${ref}.supabase.co`);
process.env.LEARNING_ROOM_ALLOW_DRAFT = '1';
process.env.LEARNING_ROOM_DRAFT_PROJECT_REF = ref;
await import('../src/index.js');
