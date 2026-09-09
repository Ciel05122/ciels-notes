import { loadState, saveState } from './private-store.mjs';

function runIdFromArgs(argv) {
  if (argv.length !== 2 || argv[0] !== '--run-id' || !argv[1]) {
    throw new Error('用法：node scripts/analysis/mark-success.mjs --run-id <run-id>');
  }
  return argv[1];
}

async function main() {
  const runId = runIdFromArgs(process.argv.slice(2));
  const state = await loadState();
  if (!state?.pendingRun) throw new Error('没有等待确认的分析批次。');
  if (state.pendingRun.id !== runId) throw new Error('批次编号不匹配，未推进分析游标。');

  await saveState({
    schemaVersion: 1,
    userId: state.userId,
    lastSuccessfulAt: state.pendingRun.through,
    lastSuccessfulRunId: state.pendingRun.id,
    lastSuccessfulNoteCount: state.pendingRun.noteCount,
    lastSuccessfulMarkedAt: Date.now(),
    pendingRun: null,
  });

  console.log(JSON.stringify({
    ok: true,
    runId,
    lastSuccessfulAt: state.pendingRun.through,
  }));
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
