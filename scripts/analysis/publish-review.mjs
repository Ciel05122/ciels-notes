import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { formatInTimeZone } from './lib.mjs';
import { loadSession } from './private-store.mjs';
import { createReadOnlyClient, restoreSession } from './supabase-session.mjs';

// 这是整套分析工具里唯一一个写云端的命令。
// 它只往 reviews 表 insert 一行，永远不碰 notes、storage 或任何已有数据。
// 主键是 r-{runId}，同一批次重复发布会因为主键冲突直接失败，不会产生重复报告。

const MAX_CONTENT_BYTES = 512 * 1024;

function parseArgs(argv) {
  const options = {};
  const numeric = new Set(['since', 'through', 'noteCount']);
  const names = {
    '--file': 'file',
    '--run-id': 'runId',
    '--since': 'since',
    '--through': 'through',
    '--note-count': 'noteCount',
    '--reason': 'reason',
  };

  for (let index = 0; index < argv.length; index += 2) {
    const key = names[argv[index]];
    const value = argv[index + 1];
    if (!key) throw new Error(`无法识别的参数：${argv[index]}`);
    if (value === undefined) throw new Error(`${argv[index]} 缺少值。`);
    if (numeric.has(key)) {
      const parsed = Number(value);
      if (!Number.isFinite(parsed)) throw new Error(`${argv[index]} 必须是数字。`);
      options[key] = parsed;
    } else {
      options[key] = value;
    }
  }

  for (const required of ['file', 'runId', 'since', 'through', 'noteCount']) {
    if (options[required] === undefined) {
      throw new Error('用法：node scripts/analysis/publish-review.mjs --file <报告路径> --run-id <批次> --since <毫秒> --through <毫秒> --note-count <条数> [--reason <触发原因>]');
    }
  }
  if (options.since >= options.through) throw new Error('--since 必须早于 --through。');

  return options;
}

// 报告文件开头的 --- 元信息块是给人在本机读文件时看的；
// 数据库里这些信息已经拆成独立字段，所以入库时去掉，避免正文顶部出现一堆重复元信息。
export function stripFrontMatter(markdown) {
  const text = String(markdown ?? '').replace(/^﻿/, '');
  if (!text.startsWith('---')) return text.trim();
  const end = text.indexOf('\n---', 3);
  if (end === -1) return text.trim();
  const lineEnd = text.indexOf('\n', end + 1);
  return (lineEnd === -1 ? '' : text.slice(lineEnd + 1)).trim();
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  const absolutePath = path.resolve(process.cwd(), options.file);
  const content = stripFrontMatter(await readFile(absolutePath, 'utf8'));
  if (!content) throw new Error('报告正文为空，已停止发布。');
  if (Buffer.byteLength(content, 'utf8') > MAX_CONTENT_BYTES) {
    throw new Error(`报告超过 ${MAX_CONTENT_BYTES / 1024} KB，已停止发布。`);
  }

  const storedSession = await loadSession();
  if (!storedSession) throw new Error('尚未连接 Ciel\'s Notes，请先运行 npm run analysis:setup。');

  const client = createReadOnlyClient();
  const session = await restoreSession(client, storedSession);
  const now = Date.now();

  const { error } = await client.from('reviews').insert({
    id: `r-${options.runId}`,
    user_id: session.userId,
    content,
    created_at: now,
    period_start: options.since,
    period_end: options.through,
    note_count: options.noteCount,
    trigger_reason: options.reason ?? null,
    run_id: options.runId,
  });

  if (error) {
    const duplicate = error.code === '23505';
    throw new Error(duplicate
      ? '这个批次的回顾已经发布过了，没有重复写入。'
      : `发布失败：${error.message}`);
  }

  console.log(JSON.stringify({
    ok: true,
    id: `r-${options.runId}`,
    publishedAtLocal: formatInTimeZone(now),
    noteCount: options.noteCount,
    contentChars: content.length,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
    recovery: '不要重复运行。报告文件仍在本机 reports/ 目录，可在排查后重试。',
  }, null, 2));
  process.exitCode = 1;
});
