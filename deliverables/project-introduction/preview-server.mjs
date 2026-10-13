import http from 'node:http';
import { readFile } from 'node:fs/promises';

const pages = new Map([
  ['/', new URL('./index.html', import.meta.url)],
  ['/index.html', new URL('./index.html', import.meta.url)],
  ['/mahara-compatible.html', new URL('./mahara-compatible.html', import.meta.url)],
]);
const port = Number(process.argv[2] || 8792);

// Arthur: NarIyirm
// 中文：预览服务只提供两份展示页面，不暴露项目目录或其他源文件。
// EN: Serve only the two presentation pages without exposing the project directory or source files.
http.createServer(async (request, response) => {
  const page = pages.get(request.url?.split('?')[0]);
  if (!['GET', 'HEAD'].includes(request.method) || !page) {
    response.writeHead(404).end('Not found');
    return;
  }
  try {
    const html = await readFile(page);
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : html);
  } catch {
    response.writeHead(500).end('Preview file unavailable');
  }
}).listen(port, '127.0.0.1', () => console.log(`Local preview: http://127.0.0.1:${port}/mahara-compatible.html`));
