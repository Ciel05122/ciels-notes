import { newId, type Note } from './types';

// 正在进行的计时。存 localStorage，靠 startedAt 时间戳算时长——
// 关掉 App / 锁屏都不影响准确性，回来接着算。
export interface ActiveTimer {
  task: string;
  mode: 'down' | 'up'; // 倒计时 / 正计时
  target?: number; // 倒计时目标秒数
  startedAt: number;
}

const KEY = 'kb.timer.v1';

export function loadTimer(): ActiveTimer | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as ActiveTimer) : null;
  } catch {
    return null;
  }
}

export function saveTimer(t: ActiveTimer): void {
  localStorage.setItem(KEY, JSON.stringify(t));
}

export function clearTimer(): void {
  localStorage.removeItem(KEY);
}

// 计时结束 → 生成一条时间线记录（挂在开始计时的时间点上）
export function createTimerNote(task: string, startedAt: number, seconds: number): Note {
  return {
    id: newId('n-'),
    text: task,
    createdAt: startedAt,
    updatedAt: Date.now(),
    tags: [],
    images: [],
    files: [],
    comments: [],
    timer: { task, seconds },
  };
}

// 25:00 / 1:05:00 这种表盘格式
export function formatClock(s: number): string {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${p(m)}:${p(sec)}` : `${p(m)}:${p(sec)}`;
}

// 45分钟 / 1小时30分 这种人话格式
export function formatDuration(s: number): string {
  if (s < 60) return `${Math.max(1, Math.floor(s))}秒`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}分钟`;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return mm ? `${h}小时${mm}分` : `${h}小时`;
}

// 到点提示音 + 震动（仅 App 在前台时有效）
export function beep(): void {
  try {
    const ctx = new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g);
    g.connect(ctx.destination);
    o.type = 'sine';
    o.frequency.value = 880;
    g.gain.value = 0.25;
    o.start();
    o.stop(ctx.currentTime + 0.9);
  } catch {
    /* 某些浏览器需要用户手势后才允许出声，失败就静默 */
  }
  (navigator as Navigator & { vibrate?: (ms: number) => void }).vibrate?.(400);
}
