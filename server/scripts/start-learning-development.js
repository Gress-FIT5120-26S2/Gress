import assert from 'node:assert/strict';
import '../src/env.js';

// Arthur: NarIyirm
// 中文：App 本地开发启动启用指定开发库的草稿，不修改 .env；server:start 和生产启动仍遵守 published 门槛。
// EN: App development startup enables drafts only for the named development database without editing .env; server:start and production retain the published gate.
const ref = 'thmbtsssvnslotoexntz';
assert.notEqual(process.env.NODE_ENV, 'production');
assert.equal(new URL(process.env.SUPABASE_URL).hostname, `${ref}.supabase.co`);
process.env.LEARNING_ROOM_ALLOW_DRAFT = '1';
process.env.LEARNING_ROOM_DRAFT_PROJECT_REF = ref;
await import('../src/index.js');
