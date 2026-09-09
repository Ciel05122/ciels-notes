-- ============================================================
-- 「回顾」表：AI 定期回顾报告
-- 用法：Supabase 控制台 → 左侧 SQL Editor → New query → 全部粘贴 → Run
-- 只需运行一次。这段脚本不会碰 notes 表、storage 或任何已有数据。
-- ============================================================

-- 1) 回顾报告表
create table if not exists public.reviews (
  id             text primary key,      -- r-{runId}，重复发布会因主键冲突而失败，防止同一批次发两次
  user_id        uuid not null references auth.users(id) on delete cascade,
  content        text not null,         -- 报告正文（Markdown，已去掉文件头部的元信息块）
  created_at     bigint not null,       -- 毫秒时间戳，和 notes 表保持一致
  period_start   bigint not null,       -- 本次回顾覆盖的起始时间
  period_end     bigint not null,       -- 本次回顾覆盖的结束时间
  note_count     integer not null default 0,
  trigger_reason text,                  -- first-review / threshold / fallback
  run_id         text                   -- 对应本机分析游标的批次编号，便于排查
);

create index if not exists reviews_user_created_idx
  on public.reviews (user_id, created_at desc);

-- 2) 行级权限：只能看到、写入、删除自己的回顾
alter table public.reviews enable row level security;

drop policy if exists "reviews_select_own" on public.reviews;
drop policy if exists "reviews_insert_own" on public.reviews;
drop policy if exists "reviews_delete_own" on public.reviews;

create policy "reviews_select_own" on public.reviews
  for select using (auth.uid() = user_id);
create policy "reviews_insert_own" on public.reviews
  for insert with check (auth.uid() = user_id);
create policy "reviews_delete_own" on public.reviews
  for delete using (auth.uid() = user_id);

-- 注意：故意没有 update 权限。
-- 回顾是某个时间点生成的记录，不应该被改写；发现内容不对就删掉重发。
