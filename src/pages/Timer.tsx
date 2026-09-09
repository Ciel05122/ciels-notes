import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import {
  loadTimer, saveTimer, clearTimer, createTimerNote,
  formatClock, formatDuration, beep, type ActiveTimer,
} from '../timer';

const PRESETS = [25, 45, 90];

export function Timer() {
  const navigate = useNavigate();
  const { notes, addNote } = useStore();

  const [active, setActive] = useState<ActiveTimer | null>(() => loadTimer());
  const [done, setDone] = useState<{ task: string; seconds: number } | null>(null);
  const [task, setTask] = useState('');
  const [mode, setMode] = useState<'down' | 'up'>('down');
  const [minutes, setMinutes] = useState(25);
  const [now, setNow] = useState(Date.now());
  const finishedRef = useRef(false);

  // 历史任务名（最近 6 个），点一下直接填
  const suggestions = useMemo(() => {
    const seen: string[] = [];
    for (const n of notes) {
      const t = n.timer?.task;
      if (t && !seen.includes(t)) seen.push(t);
      if (seen.length >= 6) break;
    }
    return seen;
  }, [notes]);

  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(iv);
  }, []);

  const elapsed = active ? Math.floor((now - active.startedAt) / 1000) : 0;
  const remaining = active?.mode === 'down' && active.target ? active.target - elapsed : 0;

  function finish(seconds: number) {
    if (!active) return;
    const s = Math.max(1, Math.floor(seconds));
    addNote(createTimerNote(active.task, active.startedAt, s));
    clearTimer();
    setDone({ task: active.task, seconds: s });
    setActive(null);
  }

  // 倒计时到点：响铃 + 自动记录
  useEffect(() => {
    if (!active || active.mode !== 'down' || !active.target) return;
    if (remaining <= 0 && !finishedRef.current) {
      finishedRef.current = true;
      beep();
      finish(active.target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, active]);

  function start() {
    const t: ActiveTimer = {
      task: task.trim() || '专注',
      mode,
      target: mode === 'down' ? Math.max(1, minutes) * 60 : undefined,
      startedAt: Date.now(),
    };
    saveTimer(t);
    setActive(t);
    setDone(null);
    finishedRef.current = false;
  }

  function abandon() {
    if (!active) return;
    if (elapsed > 60 && !confirm('放弃这次计时？不会留下记录。')) return;
    clearTimer();
    setActive(null);
  }

  // —— 三种状态：完成 / 计时中 / 设置 ——

  if (done) {
    return (
      <div className="page timer-page">
        <div className="timer-done">
          <div className="done-check">✓</div>
          <p className="done-text">已记录到时间线</p>
          <p className="done-detail">{done.task} · {formatDuration(done.seconds)}</p>
          <div className="timer-actions">
            <button type="button" className="big-primary" onClick={() => navigate('/')}>回到时间线</button>
            <button type="button" className="ghost-btn" onClick={() => setDone(null)}>再来一轮</button>
          </div>
        </div>
      </div>
    );
  }

  if (active) {
    return (
      <div className="page timer-page">
        <header className="write-bar">
          <button className="text-btn" type="button" onClick={() => navigate('/')}>‹ 时间线</button>
          <span className="write-autosave">计时进行中，关掉页面也不影响</span>
          <span />
        </header>
        <div className="timer-running">
          <p className="timer-task-label">{active.task}</p>
          <div className="timer-display">
            {active.mode === 'down' ? formatClock(remaining) : formatClock(elapsed)}
          </div>
          <p className="timer-mode-label">
            {active.mode === 'down' ? `倒计时 ${formatDuration(active.target!)} · 剩余` : '正计时 · 已进行'}
          </p>
          <div className="timer-actions">
            <button
              type="button"
              className="big-primary"
              onClick={() => finish(active.mode === 'down' && active.target ? Math.min(elapsed, active.target) : elapsed)}
            >
              完成
            </button>
            <button type="button" className="ghost-btn" onClick={abandon}>放弃</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page timer-page">
      <header className="write-bar">
        <button className="text-btn" type="button" onClick={() => navigate('/')}>‹ 时间线</button>
        <span className="write-autosave">计时</span>
        <span />
      </header>

      <div className="timer-setup">
        <input
          className="timer-task-input"
          placeholder="在做什么？如：复习DSP"
          value={task}
          onChange={(e) => setTask(e.target.value)}
        />
        {suggestions.length > 0 && (
          <div className="task-suggest">
            {suggestions.map((s) => (
              <button key={s} type="button" className="common-tag" onClick={() => setTask(s)}>{s}</button>
            ))}
          </div>
        )}

        <div className="mode-row">
          {PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              className={`pick ${mode === 'down' && minutes === p ? 'on goal' : ''}`}
              onClick={() => { setMode('down'); setMinutes(p); }}
            >
              {p}分钟
            </button>
          ))}
          <span className={`custom-minutes ${mode === 'down' && !PRESETS.includes(minutes) ? 'on' : ''}`}>
            <input
              type="number"
              min={1}
              max={600}
              inputMode="numeric"
              value={minutes}
              onChange={(e) => { setMode('down'); setMinutes(Number(e.target.value) || 1); }}
            />
            分
          </span>
          <button
            type="button"
            className={`pick ${mode === 'up' ? 'on pin' : ''}`}
            onClick={() => setMode('up')}
          >
            正计时
          </button>
        </div>

        <button type="button" className="big-primary start-btn" onClick={start}>
          开始{mode === 'down' ? `（${minutes} 分钟）` : '（干到哪算哪）'}
        </button>
        <p className="timer-hint">结束后自动记到时间线 · iPhone 锁屏/后台时不会响铃，但时间照常记</p>
      </div>
    </div>
  );
}
