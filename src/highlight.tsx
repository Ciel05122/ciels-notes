import type { ReactNode } from 'react';

// 把文本里命中关键词的部分用 <mark> 高亮（搜索态用）。大小写不敏感。
export function highlight(text: string, keyword: string): ReactNode {
  const kw = keyword.trim();
  if (!kw) return text;
  const parts: ReactNode[] = [];
  const lower = text.toLowerCase();
  const target = kw.toLowerCase();
  let from = 0;
  let idx = lower.indexOf(target, from);
  let k = 0;
  while (idx !== -1) {
    if (idx > from) parts.push(text.slice(from, idx));
    parts.push(
      <mark key={k++} className="hl">
        {text.slice(idx, idx + kw.length)}
      </mark>,
    );
    from = idx + kw.length;
    idx = lower.indexOf(target, from);
  }
  if (from < text.length) parts.push(text.slice(from));
  return parts;
}
