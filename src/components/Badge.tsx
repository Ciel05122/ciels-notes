import type { Note } from '../types';

// 徽章：固定身份。有「目标」就显示绿色目标徽章，否则按类型显示个人/专业。
export function Badge({ note }: { note: Note }) {
  if (note.isGoal) return <span className="badge badge-goal">目标</span>;
  if (note.type === 'personal') return <span className="badge badge-personal">个人</span>;
  if (note.type === 'professional') return <span className="badge badge-professional">专业</span>;
  return null;
}
