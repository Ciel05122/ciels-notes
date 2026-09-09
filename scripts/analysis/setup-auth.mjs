import { randomBytes } from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';

import { saveSession, SESSION_PATH } from './private-store.mjs';
import { createReadOnlyClient, serializeSession } from './supabase-session.mjs';

const HOST = '127.0.0.1';
const NONCE = randomBytes(24).toString('hex');
const MAX_BODY_BYTES = 16 * 1024;
const TIMEOUT_MS = 10 * 60 * 1000;

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function page({ message = '', error = false, success = false } = {}) {
  const notice = message
    ? `<p class="notice ${error ? 'error' : success ? 'success' : ''}" role="status">${escapeHtml(message)}</p>`
    : '';

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ciel's Notes · 分析助手登录</title>
  <style>
    :root { color-scheme: light; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #faf9f5; color: #26231f; }
    main { width: min(100%, 430px); padding: 30px; border: 1px solid #dedbd2; border-radius: 18px; background: #fffefa; box-shadow: 0 16px 45px rgba(61, 49, 37, .08); }
    h1 { margin: 0 0 8px; font: 600 26px/1.25 Georgia, "Noto Serif SC", serif; }
    p { margin: 0 0 22px; color: #716c64; line-height: 1.7; }
    label { display: block; margin: 16px 0 7px; font-size: 14px; color: #4d4841; }
    input { width: 100%; min-height: 46px; border: 1px solid #cbc6bc; border-radius: 10px; padding: 10px 12px; background: white; color: #26231f; font: inherit; }
    input:focus { outline: 2px solid #d97550; outline-offset: 2px; border-color: transparent; }
    button { width: 100%; min-height: 46px; margin-top: 22px; border: 0; border-radius: 10px; background: #cf6845; color: white; font: 600 16px/1 system-ui, sans-serif; cursor: pointer; }
    button:hover { background: #b95739; }
    .notice { margin: 0 0 18px; padding: 12px 14px; border-radius: 10px; background: #f1eee7; color: #544e46; }
    .notice.error { background: #fff0ec; color: #9a3e2b; }
    .notice.success { background: #edf7ed; color: #33663b; }
    .privacy { margin: 20px 0 0; font-size: 13px; color: #8b857c; }
  </style>
</head>
<body>
  <main>
    <h1>连接你的记录</h1>
    <p>使用 Ciel's Notes 的邮箱和密码登录一次。密码只发送到本机上的临时页面，不会保存。</p>
    ${notice}
    ${success ? '<p>现在可以关闭这个页面，返回 Codex。</p>' : `
    <form method="post" action="/login?nonce=${NONCE}">
      <label for="email">邮箱</label>
      <input id="email" name="email" type="email" autocomplete="username" required autofocus>
      <label for="password">密码</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required>
      <button type="submit">安全连接</button>
    </form>
    <p class="privacy">只读取文字、时间、标签、地点、目标、计时器和备注；不读取图片或附件，也不会修改数据库。</p>`}
  </main>
</body>
</html>`;
}

function sendHtml(response, status, body) {
  response.writeHead(status, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
  });
  response.end(body);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body, 'utf8') > MAX_BODY_BYTES) {
        reject(new Error('登录内容过大。'));
        request.destroy();
      }
    });
    request.on('end', () => resolve(body));
    request.on('error', reject);
  });
}

let server;
let finished = false;

async function handle(request, response) {
  const url = new URL(request.url ?? '/', `http://${HOST}`);
  if (url.searchParams.get('nonce') !== NONCE) {
    sendHtml(response, 403, page({ message: '这个登录链接无效或已经过期。', error: true }));
    return;
  }

  if (request.method === 'GET' && url.pathname === '/') {
    sendHtml(response, 200, page());
    return;
  }

  if (request.method !== 'POST' || url.pathname !== '/login') {
    sendHtml(response, 404, page({ message: '没有找到这个页面。', error: true }));
    return;
  }

  try {
    const form = new URLSearchParams(await readBody(request));
    const email = String(form.get('email') ?? '').trim();
    const password = String(form.get('password') ?? '');
    if (!email || !password) throw new Error('请输入邮箱和密码。');

    const client = createReadOnlyClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error || !data.session) throw new Error(error?.message || '没有收到有效登录会话。');

    const { error: readError } = await client.from('notes').select('id').limit(1);
    if (readError) throw new Error(`账号登录成功，但只读检查失败：${readError.message}`);

    await saveSession(serializeSession(data.session));
    finished = true;
    sendHtml(response, 200, page({ message: '连接成功。密码没有保存；本机已保存 Supabase 用户会话，分析工具只会执行只读查询。', success: true }));
    console.log(`\n连接成功。会话保存在：${SESSION_PATH}`);
    setTimeout(() => server.close(), 750).unref();
  } catch (error) {
    sendHtml(response, 401, page({ message: `连接失败：${error.message}`, error: true }));
  }
}

server = http.createServer((request, response) => {
  handle(request, response).catch((error) => {
    sendHtml(response, 500, page({ message: `本机登录页发生错误：${error.message}`, error: true }));
  });
});

server.listen(0, HOST, () => {
  const address = server.address();
  const url = `http://${HOST}:${address.port}/?nonce=${NONCE}`;
  console.log('请在浏览器中打开下面的本机地址，并使用 Ciel\'s Notes 账号登录：');
  console.log(url);
  console.log('\n此页面将在 10 分钟后自动关闭。');
});

setTimeout(() => {
  if (!finished) console.error('\n登录等待超时。请重新运行 npm run analysis:setup。');
  server.close();
}, TIMEOUT_MS).unref();
