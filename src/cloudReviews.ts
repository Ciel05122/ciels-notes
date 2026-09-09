import { supabase } from './supabase';

// 「回顾」是本机分析任务定期生成、写入 reviews 表的报告。
// 网页只读和删除，从不生成也不修改；生成永远发生在电脑上的分析任务里。

export interface ReviewMeta {
  id: string;
  createdAt: number;
  periodStart: number;
  periodEnd: number;
  noteCount: number;
  reason?: string;
}

export interface Review extends ReviewMeta {
  content: string;
}

interface Row {
  id: string;
  content?: string | null;
  created_at: number;
  period_start: number;
  period_end: number;
  note_count: number | null;
  trigger_reason: string | null;
}

function rowToMeta(r: Row): ReviewMeta {
  return {
    id: r.id,
    createdAt: Number(r.created_at),
    periodStart: Number(r.period_start),
    periodEnd: Number(r.period_end),
    noteCount: Number(r.note_count ?? 0),
    reason: r.trigger_reason ?? undefined,
  };
}

// 列表不取 content：一份报告一两万字，列表页没必要为了显示日期把全文都下载下来。
export async function fetchReviewList(): Promise<ReviewMeta[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,created_at,period_start,period_end,note_count,trigger_reason')
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => rowToMeta(r as Row));
}

export async function fetchReview(id: string): Promise<Review | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id,content,created_at,period_start,period_end,note_count,trigger_reason')
    .eq('id', id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as Row;
  return { ...rowToMeta(row), content: row.content ?? '' };
}

// 首页用它判断要不要显示小红点：只取一行，代价可以忽略。
export async function fetchLatestReviewAt(): Promise<number | null> {
  const { data, error } = await supabase
    .from('reviews')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw new Error(error.message);
  const first = data?.[0] as { created_at: number } | undefined;
  return first ? Number(first.created_at) : null;
}

export async function deleteReview(id: string): Promise<void> {
  const { error } = await supabase.from('reviews').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
