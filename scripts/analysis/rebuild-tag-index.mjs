import { NOTE_COLUMNS } from './config.mjs';
import {
  loadSession,
  loadTagAliases,
  saveTagAliases,
  saveTagHistoryIndex,
} from './private-store.mjs';
import { createReadOnlyClient, restoreSession } from './supabase-session.mjs';
import { buildHistoryIndex, createEmptyAliasState } from './tag-knowledge.mjs';

const PAGE_SIZE = 500;

async function fetchAllRows(client) {
  const rows = [];

  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await client
      .from('notes')
      .select(NOTE_COLUMNS)
      .order('created_at', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`完整历史读取失败：${error.message}`);
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return rows;
}

async function main() {
  const storedSession = await loadSession();
  if (!storedSession) throw new Error('尚未连接 Ciel\'s Notes，请先运行 npm run analysis:setup。');

  const client = createReadOnlyClient();
  const session = await restoreSession(client, storedSession);
  const storedAliases = await loadTagAliases(session.userId);
  const aliases = storedAliases?.userId === session.userId
    ? storedAliases
    : createEmptyAliasState(session.userId);
  if (!storedAliases) await saveTagAliases(session.userId, aliases);

  const rows = await fetchAllRows(client);
  const index = buildHistoryIndex(rows, aliases, session.userId);
  await saveTagHistoryIndex(session.userId, index);

  console.log(JSON.stringify({
    ok: true,
    indexedNoteCount: index.noteCount,
    indexedTagCount: index.tags.length,
    aliasGroupCount: aliases.groups.length,
    pagesRead: Math.max(1, Math.ceil(rows.length / PAGE_SIZE)),
    builtAt: index.builtAt,
    excludedFields: ['images', 'files'],
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    ok: false,
    error: error.message,
    recovery: '需要登录时运行 npm run analysis:setup，随后重新运行 npm run analysis:index-tags。',
  }, null, 2));
  process.exitCode = 1;
});
