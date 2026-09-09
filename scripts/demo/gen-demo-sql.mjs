import { DEMO_NOTES, DEMO_REVIEW } from './demo-data.mjs';

// 生成演示账号的灌库 SQL。
// 用法：node scripts/demo/gen-demo-sql.mjs <演示账号的 user id> > supabase-demo-seed.sql
//
// 生成的 SQL 做两件事：
//   1. 把这个账号在数据库层锁成只读（能 select，不能 insert/update/delete）
//   2. 灌入虚构的演示记录
// 顺序上先灌数据再上锁，否则自己也写不进去。

const DAY = 24 * 60 * 60 * 1000;

function quote(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function jsonb(value) {
  return `${quote(JSON.stringify(value))}::jsonb`;
}

function timestampFor({ day, hour = 12, minute = 0 }) {
  // 以「今天的这个时刻」为基准往回推，让演示数据永远显得是最近写的
  const base = new Date();
  base.setHours(hour, minute, 0, 0);
  return base.getTime() - day * DAY;
}

function main() {
  const userId = process.argv[2];
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) {
    console.error('用法：node scripts/demo/gen-demo-sql.mjs <演示账号的 user id>');
    console.error('user id 在 Supabase 控制台 → Authentication → Users 里复制。');
    process.exitCode = 1;
    return;
  }

  const uid = quote(userId);
  const lines = [];

  lines.push('-- ============================================================');
  lines.push('-- 演示账号数据 + 只读锁定');
  lines.push('-- 由 scripts/demo/gen-demo-sql.mjs 生成，不要手工编辑。');
  lines.push('-- 用法：Supabase 控制台 → SQL Editor → New query → 粘贴 → Run');
  lines.push('-- ============================================================');
  lines.push('');
  lines.push('-- 1) 先清掉这个账号已有的演示数据，方便随时重灌恢复原状');
  lines.push(`delete from public.notes where user_id = ${uid};`);
  lines.push(`delete from public.reviews where user_id = ${uid};`);
  lines.push('');
  lines.push('-- 2) 灌入虚构演示记录');

  DEMO_NOTES.forEach((note, index) => {
    const createdAt = timestampFor(note);
    const comments = (note.comments ?? []).map((comment, i) => ({
      id: `demo-c-${index}-${i}`,
      text: comment.text,
      createdAt: createdAt + Math.round((comment.hoursAgo ?? 1) * 60 * 60 * 1000),
    }));

    lines.push(
      `insert into public.notes (id, user_id, text, created_at, updated_at, type, is_goal, goal_done, pinned, tags, location, images, files, comments, timer) values (`
      + `${quote(`demo-${index}`)}, ${uid}, ${quote(note.text)}, ${createdAt}, ${createdAt}, `
      + `${note.type ? quote(note.type) : 'null'}, ${!!note.isGoal}, ${!!note.goalDone}, ${!!note.pinned}, `
      + `${jsonb(note.tags ?? [])}, ${note.location ? quote(note.location) : 'null'}, `
      + `${jsonb([])}, ${jsonb([])}, ${jsonb(comments)}, ${note.timer ? jsonb(note.timer) : 'null'});`,
    );
  });

  const reviewCreatedAt = timestampFor({ day: DEMO_REVIEW.day, hour: 21, minute: 30 });
  lines.push('');
  lines.push('-- 3) 灌入一份演示用的回顾报告');
  lines.push(
    'insert into public.reviews (id, user_id, content, created_at, period_start, period_end, note_count, trigger_reason, run_id) values ('
    + `${quote('r-demo-1')}, ${uid}, ${quote(DEMO_REVIEW.content)}, ${reviewCreatedAt}, `
    + `${reviewCreatedAt - DEMO_REVIEW.periodDays * DAY}, ${reviewCreatedAt}, ${DEMO_REVIEW.noteCount}, `
    + `${quote(DEMO_REVIEW.reason)}, ${quote('demo')});`,
  );

  lines.push('');
  lines.push('-- 4) 把演示账号在数据库层锁成只读');
  lines.push('--    前端也会隐藏写入入口，但真正的保证在这里：');
  lines.push('--    即使有人绕过界面直接发请求，写操作一样会被拒绝。');
  for (const [table, ops] of [['notes', ['insert', 'update', 'delete']], ['reviews', ['insert', 'delete']]]) {
    for (const op of ops) {
      const policy = `${table}_${op}_own`;
      const clause = op === 'insert' ? 'with check' : 'using';
      const extra = op === 'update' ? ` with check (auth.uid() = user_id and auth.uid() <> ${uid})` : '';
      lines.push(`drop policy if exists "${policy}" on public.${table};`);
      lines.push(
        `create policy "${policy}" on public.${table}\n`
        + `  for ${op} ${clause} (auth.uid() = user_id and auth.uid() <> ${uid})${extra};`,
      );
    }
  }
  lines.push('');

  console.log(lines.join('\n'));
}

main();
