import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NOTE_COLUMNS } from './config.mjs';
import { buildAnalysisEnvelope, parseFetchArgs, resolveWindow } from './lib.mjs';
import {
  loadSession,
  loadState,
  loadTagAliases,
  loadTagHistoryIndex,
  saveState,
} from './private-store.mjs';
import { createReadOnlyClient, restoreSession } from './supabase-session.mjs';
import {
  buildAnalysisTagKnowledge,
  createEmptyAliasState,
} from './tag-knowledge.mjs';

async function loadFixture(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const parsed = JSON.parse(await readFile(absolutePath, 'utf8'));
  if (!Array.isArray(parsed)) throw new Error('夹具文件必须是数据库行数组。');
  return parsed;
}

async function fetchRows(client, window, limit) {
  const { data, error } = await client
    .from('notes')
    .select(NOTE_COLUMNS)
    .gte('updated_at', window.since)
    .lte('updated_at', window.through)
    .order('created_at', { ascending: true })
    .limit(limit + 1);

  if (error) throw new Error(`只读查询失败：${error.message}`);
  if ((data?.length ?? 0) > limit) {
    throw new Error(`本次变更超过 ${limit} 条，为避免不完整分析已经停止。请缩短时间范围或提高 --limit。`);
  }
  return data ?? [];
}

async function main() {
  const options = parseFetchArgs(process.argv.slice(2));

  if (options.fixture) {
    const rows = await loadFixture(options.fixture);
    const window = resolveWindow(options, undefined);
    const envelope = buildAnalysisEnvelope({ rows, window });
    envelope.tagKnowledge = buildAnalysisTagKnowledge(
      rows,
      createEmptyAliasState('fixture-user'),
      undefined,
    );
    envelope.checkpointCommand = null;
    console.log(JSON.stringify(envelope, null, 2));
    return;
  }

  const storedSession = await loadSession();
  if (!storedSession) throw new Error('尚未连接 Ciel\'s Notes，请先运行 npm run analysis:setup。');

  const client = createReadOnlyClient();
  const session = await restoreSession(client, storedSession);
  const savedState = await loadState();
  const state = savedState?.userId === session.userId ? savedState : undefined;
  const window = resolveWindow(options, state);
  const rows = await fetchRows(client, window, options.limit);
  const envelope = buildAnalysisEnvelope({ rows, window });
  const storedAliases = await loadTagAliases(session.userId);
  const aliases = storedAliases?.userId === session.userId
    ? storedAliases
    : createEmptyAliasState(session.userId);
  const storedIndex = await loadTagHistoryIndex(session.userId);
  const historyIndex = storedIndex?.userId === session.userId ? storedIndex : undefined;
  envelope.tagKnowledge = buildAnalysisTagKnowledge(rows, aliases, historyIndex);

  await saveState({
    ...(state ?? {}),
    schemaVersion: 1,
    userId: session.userId,
    pendingRun: {
      id: envelope.run.id,
      since: window.since,
      through: window.through,
      noteCount: rows.length,
      preparedAt: Date.now(),
    },
  });

  console.log(JSON.stringify(envelope, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    schemaVersion: 1,
    source: 'ciels-notes-supabase-read-only',
    error: error.message,
    recovery: '不要标记本次运行成功。需要登录时运行 npm run analysis:setup，随后重试。',
  }, null, 2));
  process.exitCode = 1;
});
