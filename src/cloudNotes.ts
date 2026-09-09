import { supabase } from './supabase';
import type { Note } from './types';

const FETCH_PAGE_SIZE = 500;

// 前端 Note(驼峰) <-> 数据库行(下划线) 的互转

interface Row {
  id: string;
  user_id: string;
  text: string | null;
  created_at: number;
  updated_at: number;
  type: string | null;
  is_goal: boolean | null;
  goal_done: boolean | null;
  pinned: boolean | null;
  tags: string[] | null;
  location: string | null;
  images: Note['images'] | null;
  files: Note['files'] | null;
  comments: Note['comments'] | null;
  timer: Note['timer'] | null;
}

function rowToNote(r: Row): Note {
  return {
    id: r.id,
    text: r.text ?? '',
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
    type: (r.type as Note['type']) ?? undefined,
    isGoal: r.is_goal ?? false,
    goalDone: r.goal_done ?? false,
    pinned: r.pinned ?? false,
    tags: r.tags ?? [],
    location: r.location ?? undefined,
    images: r.images ?? [],
    files: r.files ?? [],
    comments: r.comments ?? [],
    timer: r.timer ?? undefined,
  };
}

function noteToRow(n: Note, userId: string): Row {
  return {
    id: n.id,
    user_id: userId,
    text: n.text,
    created_at: n.createdAt,
    updated_at: n.updatedAt,
    type: n.type ?? null,
    is_goal: !!n.isGoal,
    goal_done: !!n.goalDone,
    pinned: !!n.pinned,
    tags: n.tags ?? [],
    location: n.location ?? null,
    images: n.images ?? [],
    files: n.files ?? [],
    comments: n.comments ?? [],
    timer: n.timer ?? null,
  };
}

export async function cloudFetchNotes(): Promise<Note[]> {
  const rows: Row[] = [];

  for (let from = 0; ; from += FETCH_PAGE_SIZE) {
    const { data, error } = await supabase
      .from('notes')
      .select('*')
      .order('created_at', { ascending: false })
      .order('id', { ascending: true })
      .range(from, from + FETCH_PAGE_SIZE - 1);
    if (error) throw error;

    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < FETCH_PAGE_SIZE) break;
  }

  return rows.map(rowToNote);
}

export async function cloudUpsertNote(note: Note, userId: string): Promise<void> {
  const { error } = await supabase.from('notes').upsert(noteToRow(note, userId));
  if (error) throw error;
}

export async function cloudDeleteNote(id: string): Promise<void> {
  const { error } = await supabase.from('notes').delete().eq('id', id);
  if (error) throw error;
}
