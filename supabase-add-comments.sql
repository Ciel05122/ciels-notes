-- 给记录表加「备注」列（评论功能用）。
-- Supabase → SQL Editor → New query → 粘贴 → Run。只需一次。
alter table public.notes
  add column if not exists comments jsonb default '[]'::jsonb;
