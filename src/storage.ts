import type { Draft, Note } from './types';

// 文字类数据存 localStorage。以后接后端，只换这一层。
const NOTES_KEY = 'kb.notes.v1';
const DRAFT_KEY = 'kb.draft.v1';

export function loadNotes(): Note[] {
  try {
    const raw = localStorage.getItem(NOTES_KEY);
    if (!raw) return [];
    const notes = JSON.parse(raw) as Note[];
    if (!Array.isArray(notes)) return [];
    // 兼容旧数据：补齐新字段
    for (const n of notes) {
      n.tags ??= [];
      n.images ??= [];
      n.files ??= [];
    }
    return notes.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error('读取记录失败：', err);
    return [];
  }
}

export function saveNotes(notes: Note[]): void {
  try {
    localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  } catch (err) {
    console.error('保存记录失败：', err);
  }
}

// ——— 草稿（写入页自动保存）———
// 记题页用单独的草稿槽：拍到一半的题不会混进普通草稿，也不会把普通草稿冲掉。
export const PROBLEM_DRAFT_KEY = 'kb.draft.problem.v1';

export function loadDraft(key = DRAFT_KEY): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft, key = DRAFT_KEY): void {
  try {
    localStorage.setItem(key, JSON.stringify(draft));
  } catch (err) {
    console.error('保存草稿失败：', err);
  }
}

export function clearDraft(key = DRAFT_KEY): void {
  localStorage.removeItem(key);
}

// ——— 标签统计：用于历史标签自动补全 + 搜索页「常用标签」———
export interface TagStat {
  tag: string;
  count: number;
  lastUsedAt: number;
}

export function tagStats(notes: Note[], options: { since?: number } = {}): TagStat[] {
  const map = new Map<string, TagStat>();
  for (const n of notes) {
    if (options.since !== undefined && n.createdAt < options.since) continue;
    const uniqueTags = new Set(n.tags.map((tag) => tag.trim()).filter(Boolean));
    for (const tag of uniqueTags) {
      const current = map.get(tag);
      map.set(tag, {
        tag,
        count: (current?.count ?? 0) + 1,
        lastUsedAt: Math.max(current?.lastUsedAt ?? 0, n.createdAt),
      });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count || b.lastUsedAt - a.lastUsedAt || a.tag.localeCompare(b.tag, 'zh-CN'));
}

// ——— 搜索页：最近搜索 ———
const SEARCH_KEY = 'kb.search.history.v1';
const SEARCH_MAX = 8;

export function loadSearchHistory(): string[] {
  try {
    const raw = localStorage.getItem(SEARCH_KEY);
    const value: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(value)) return [];
    return value.filter((v): v is string => typeof v === 'string' && !!v.trim()).slice(0, SEARCH_MAX);
  } catch {
    return [];
  }
}

function saveSearchHistory(list: string[]): string[] {
  try {
    localStorage.setItem(SEARCH_KEY, JSON.stringify(list));
  } catch {
    // 隐私模式下写不进去，只影响历史记录，不影响搜索
  }
  return list;
}

// 边打字边搜索，所以「理」「理性」会连着进来。
// 把新词的前缀旧词丢掉，只留下打完的那个，历史才不会被半截词占满。
export function recordSearch(keyword: string): string[] {
  const kw = keyword.trim().replace(/\s+/g, ' ');
  if (kw.length < 2) return loadSearchHistory();
  const lower = kw.toLocaleLowerCase();
  const rest = loadSearchHistory().filter((item) => {
    const other = item.toLocaleLowerCase();
    return other !== lower && !lower.startsWith(other);
  });
  return saveSearchHistory([kw, ...rest].slice(0, SEARCH_MAX));
}

export function removeSearch(keyword: string): string[] {
  return saveSearchHistory(loadSearchHistory().filter((item) => item !== keyword));
}

export function clearSearchHistory(): string[] {
  return saveSearchHistory([]);
}

// ——— 搜索页：常用标签 ———
// 先按最近 30 天的使用次数排，不够再用全期热门补齐。
// 只看全期的话，早期高频标签会把位置永久占死，推荐就不会变了。
const SUGGEST_WINDOW = 30 * 24 * 60 * 60 * 1000;

export function suggestedTags(notes: Note[], limit = 8, now = Date.now()): TagStat[] {
  const picked = tagStats(notes, { since: now - SUGGEST_WINDOW }).slice(0, limit);
  const seen = new Set(picked.map((t) => t.tag));
  for (const stat of tagStats(notes)) {
    if (picked.length >= limit) break;
    if (seen.has(stat.tag)) continue;
    picked.push(stat);
    seen.add(stat.tag);
  }
  return picked;
}
