-- 给记录表加「计时」列（番茄钟/计时功能用）。
-- Supabase → SQL Editor → New query → 粘贴 → Run。只需一次。
alter table public.notes
  add column if not exists timer jsonb;
