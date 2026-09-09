import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Vite 会自动加载 .env.local，但这些分析脚本是直接用 node 跑的，不经过 Vite。
// 这里做一个最小的读取器，让脚本和前端共用同一份配置，不必两处各配一遍。
// 已经存在的真实环境变量优先，方便 CI 或临时覆盖。

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function parse(text) {
  const result = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (key) result[key] = value;
  }
  return result;
}

export function loadEnvFile(fileName = '.env.local') {
  let fromFile = {};
  try {
    fromFile = parse(readFileSync(path.join(ROOT, fileName), 'utf8'));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
  return { ...fromFile, ...process.env };
}
