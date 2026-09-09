import {
  loadSession,
  loadTagAliases,
  loadTagHistoryIndex,
  saveTagAliases,
  saveTagHistoryIndex,
} from './private-store.mjs';
import { createReadOnlyClient, restoreSession } from './supabase-session.mjs';
import {
  addConfirmedAlias,
  buildHistoryIndex,
  createEmptyAliasState,
} from './tag-knowledge.mjs';

function parseArgs(argv) {
  let canonical;
  let alias;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--canonical' && argv[index + 1]) {
      canonical = argv[index + 1];
      index += 1;
    } else if (argv[index] === '--alias' && argv[index + 1]) {
      alias = argv[index + 1];
      index += 1;
    } else {
      throw new Error('用法：npm run analysis:tag-alias -- --canonical "聊天总结" --alias "聊天经验"');
    }
  }
  if (!canonical || !alias) {
    throw new Error('必须同时提供 --canonical 和 --alias。');
  }
  return { canonical, alias };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const storedSession = await loadSession();
  if (!storedSession) throw new Error('尚未连接 Ciel\'s Notes，请先运行 npm run analysis:setup。');

  const client = createReadOnlyClient();
  const session = await restoreSession(client, storedSession);
  const storedAliases = await loadTagAliases(session.userId);
  const current = storedAliases?.userId === session.userId
    ? storedAliases
    : createEmptyAliasState(session.userId);
  const aliases = addConfirmedAlias(current, options.canonical, options.alias);
  await saveTagAliases(session.userId, aliases);

  const existingIndex = await loadTagHistoryIndex(session.userId);
  let indexedNoteCount = 0;
  if (existingIndex?.userId === session.userId && Array.isArray(existingIndex.notes)) {
    const rebuilt = buildHistoryIndex(existingIndex.notes, aliases, session.userId);
    await saveTagHistoryIndex(session.userId, rebuilt);
    indexedNoteCount = rebuilt.noteCount;
  }

  console.log(JSON.stringify({
    ok: true,
    canonical: options.canonical,
    alias: options.alias,
    aliasGroupCount: aliases.groups.length,
    indexRebuiltLocally: indexedNoteCount > 0,
    indexedNoteCount,
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
