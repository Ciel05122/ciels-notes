// 时间线按「天」分组用的工具。

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();

// 取某个时间戳所在「当天」的 key，用于分组
export function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

// 相对天数：0=今天 1=昨天 ...
function diffDays(ts: number): number {
  return Math.round((startOfDay(new Date()) - startOfDay(new Date(ts))) / 86400000);
}

// 「6月27日」或跨年「2025年6月27日」
export function dateLabel(ts: number): string {
  const d = new Date(ts);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return sameYear
    ? `${d.getMonth() + 1}月${d.getDate()}日`
    : `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

// 日期分组头：近三天用「今天 · 7月20日」，更早用「7月18日 · 周六」
export function dayHeader(ts: number): string {
  const n = diffDays(ts);
  if (n === 0) return `今天 · ${dateLabel(ts)}`;
  if (n === 1) return `昨天 · ${dateLabel(ts)}`;
  if (n === 2) return `前天 · ${dateLabel(ts)}`;
  return `${dateLabel(ts)} · ${WEEKDAYS[new Date(ts).getDay()]}`;
}

// 14:32
export function timeLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// 时间戳 → <input type="datetime-local"> 需要的本地时间字符串 'YYYY-MM-DDTHH:mm'
export function toDatetimeLocal(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

// 'YYYY-MM-DDTHH:mm'（本地时间）→ 时间戳
export function fromDatetimeLocal(s: string): number {
  return new Date(s).getTime();
}

// 写入页「时间」行的友好显示：6月28日 14:32 · 今天
export function whenLabel(ts: number): string {
  return `${dateLabel(ts)} ${timeLabel(ts)}`;
}
