import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Arthur: NarIyirm
// 中文：环境标记只传给独立 Metro 子进程，不修改 .env 或正常启动配置，也不启动 Express。
// EN: Pass the preview flag only to the separate Metro process; do not modify .env, normal startup settings or start Express.
const child = spawn(process.execPath, [path.join(root, 'node_modules/expo/bin/cli'), 'start', '--localhost', ...process.argv.slice(2)], {
  cwd: root, stdio: 'inherit', env: { ...process.env, EXPO_PUBLIC_LEARNING_PREVIEW: '1', BROWSER: 'none' },
});
child.on('exit', (code) => { process.exitCode = code ?? 1; });
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
