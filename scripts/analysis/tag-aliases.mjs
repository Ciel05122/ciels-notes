import { loadSession, loadTagAliases } from './private-store.mjs';

const session = await loadSession();
if (!session?.userId) {
  console.error('尚未连接 Ciel\'s Notes，请先运行 npm run analysis:setup。');
  process.exitCode = 1;
} else {
  const aliases = await loadTagAliases(session.userId);
  console.log(JSON.stringify({
    aliasGroupCount: aliases?.groups?.length ?? 0,
    groups: aliases?.groups ?? [],
  }, null, 2));
}
