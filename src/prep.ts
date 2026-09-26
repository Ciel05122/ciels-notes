import type { Note } from './types';

// 备考相关的约定全放这里，备考页、写入页、记录卡片共用一套规则。
//
// 问题卡不是新的数据类型，就是一条普通记录，靠标签表达身份和状态：
//   #备考 #数学 #待解决   → 待解决的问题
//   #备考 #数学 #已解决   → 解决了
// 不加数据库字段，搜索、标签云、AI 回顾读到的都是同一份数据。

export const PREP_TAG = '备考';
export const OPEN_TAG = '待解决';
export const DONE_TAG = '已解决';

// 考研常见的几门，打开记题页就能直接点，不用手打
export const DEFAULT_SUBJECTS = ['数学', '英语', '专业课', '政治'];

// 包含匹配：#备考、#备考-英语、#考研备考 都算
export function isPrepNote(note: Note): boolean {
  return note.tags.some((tag) => tag.includes(PREP_TAG));
}

export type ProblemStatus = 'open' | 'done';

export function problemStatus(note: Note): ProblemStatus | null {
  if (note.tags.includes(OPEN_TAG)) return 'open';
  if (note.tags.includes(DONE_TAG)) return 'done';
  return null;
}

export function withProblemStatus(tags: string[], status: ProblemStatus): string[] {
  const rest = tags.filter((t) => t !== OPEN_TAG && t !== DONE_TAG);
  return [...rest, status === 'open' ? OPEN_TAG : DONE_TAG];
}

// 问题卡上除了身份/状态标签以外的标签，就当作科目
const STRUCTURAL_TAGS = new Set([OPEN_TAG, DONE_TAG]);

export function problemSubjects(note: Note): string[] {
  return note.tags.filter((t) => !STRUCTURAL_TAGS.has(t) && !t.includes(PREP_TAG));
}

// 记题页的科目候选：常用四门在前，再补上以前问题卡里用过的其它科目
export function subjectOptions(notes: Note[]): string[] {
  const seen = new Set(DEFAULT_SUBJECTS);
  const extra: string[] = [];
  for (const n of notes) {
    if (!problemStatus(n)) continue;
    for (const s of problemSubjects(n)) {
      if (!seen.has(s)) {
        seen.add(s);
        extra.push(s);
      }
    }
  }
  return [...DEFAULT_SUBJECTS, ...extra.slice(0, 6)];
}
