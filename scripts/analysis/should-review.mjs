import path from 'node:path';

import { ANALYSIS_TIME_ZONE } from './config.mjs';
import { decideReview, formatInTimeZone, reviewCadence, reviewWindowSince } from './lib.mjs';
import { loadSession, loadState } from './private-store.mjs';
import { createReadOnlyClient, restoreSession } from './supabase-session.mjs';

// 定时任务每天调用这一个命令来决定「今天要不要播报」。
// 只做一次 count 查询：不读正文、不读标签，够不够条件都不会把私人内容拉下来。

function localDateStamp(timestamp) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYSIS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

async function countChangedNotes(client, since, through) {
  const { count, error } = await client
    .from('notes')
    .select('id', { count: 'exact', head: true })
    .gte('updated_at', since)
    .lte('updated_at', through);

  if (error) throw new Error(`只读计数失败：${error.message}`);
  return count ?? 0;
}

async function main() {
  const storedSession = await loadSession();
  if (!storedSession) throw new Error('尚未连接 Ciel\'s Notes，请先运行 npm run analysis:setup。');

  const client = createReadOnlyClient();
  const session = await restoreSession(client, storedSession);
  const savedState = await loadState();
  const state = savedState?.userId === session.userId ? savedState : undefined;

  const now = Date.now();
  const cadence = reviewCadence();
  const lastSuccessfulAt = state?.lastSuccessfulAt;
  const since = reviewWindowSince({ lastSuccessfulAt, now, cadence });
  const noteCount = await countChangedNotes(client, since, now);
  const decision = decideReview({ lastSuccessfulAt, noteCount, now, cadence });

  console.log(JSON.stringify({
    schemaVersion: 1,
    checkedAtLocal: formatInTimeZone(now),
    cadence,
    ...decision,
    sinceLocal: formatInTimeZone(since),
    fetchCommand: decision.shouldRun
      ? (decision.isFirstReview
          ? `node scripts/analysis/fetch-notes.mjs --lookback-days ${cadence.firstLookbackDays}`
          : 'node scripts/analysis/fetch-notes.mjs')
      : null,
    reportPath: decision.shouldRun
      ? path.join('reports', `回顾-${localDateStamp(now)}.md`)
      : null,
  }, null, 2));
}

main().catch((error) => {
  console.error(JSON.stringify({
    schemaVersion: 1,
    shouldRun: false,
    reason: 'error',
    error: error.message,
    recovery: '不要生成报告，也不要运行任何 mark-success 命令。需要登录时运行 npm run analysis:setup。',
  }, null, 2));
  process.exitCode = 1;
});
