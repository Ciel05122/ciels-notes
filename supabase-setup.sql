-- ============================================================
-- 「我的记录」云端建表脚本
-- 用法：Supabase 控制台 → 左侧 SQL Editor → New query → 全部粘贴 → 点 Run
-- 只需运行一次。
-- ============================================================

-- 1) 记录表
create table if not exists public.notes (
  id          text primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  text        text default '',
  created_at  bigint not null,      -- 毫秒时间戳，和前端一致
  updated_at  bigint not null,
  type        text,                 -- 'personal' | 'professional' | null
  is_goal     boolean default false,
  goal_done   boolean default false,
  pinned      boolean default false,
  tags        jsonb default '[]'::jsonb,
  location    text,
  images      jsonb default '[]'::jsonb,
  files       jsonb default '[]'::jsonb
);

-- 2) 打开行级权限：每个人只能碰自己的数据
alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
drop policy if exists "notes_insert_own" on public.notes;
drop policy if exists "notes_update_own" on public.notes;
drop policy if exists "notes_delete_own" on public.notes;

create policy "notes_select_own" on public.notes
  for select using (auth.uid() = user_id);
create policy "notes_insert_own" on public.notes
  for insert with check (auth.uid() = user_id);
create policy "notes_update_own" on public.notes
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "notes_delete_own" on public.notes
  for delete using (auth.uid() = user_id);

-- 3) 图片/附件存储桶
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- 4) 存储权限：文件放在 用户ID/ 文件夹下，只有本人能传/删；读公开（路径不可猜）
drop policy if exists "media_read" on storage.objects;
drop policy if exists "media_insert_own" on storage.objects;
drop policy if exists "media_delete_own" on storage.objects;

create policy "media_read" on storage.objects
  for select using (bucket_id = 'media');
create policy "media_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
  );
create policy "media_delete_own" on storage.objects
  for delete using (
    bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text
  );
