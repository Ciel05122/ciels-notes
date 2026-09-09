import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { dayKey } from '../date';
import { NoteCard } from '../components/NoteCard';

const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'];
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

export function Calendar() {
  const { notes } = useStore();
  const navigate = useNavigate();
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });
  const [selected, setSelected] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime());

  // 一条记录对应一个点，点数直接反映当天记录条数
  const dotMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const n of notes) {
      const k = dayKey(n.createdAt);
      map.set(k, (map.get(k) ?? 0) + 1);
    }
    return map;
  }, [notes]);

  // 生成 6 行 × 7 列的日期网格
  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const start = first.getDay(); // 当月 1 号是周几
    const startDate = new Date(view.y, view.m, 1 - start);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate() + i);
      return d;
    });
  }, [view]);

  const selDate = new Date(selected);
  const dayNotes = notes.filter((n) => dayKey(n.createdAt) === dayKey(selected));

  function shiftMonth(delta: number) {
    setView((v) => {
      const d = new Date(v.y, v.m + delta, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  }
  function goToday() {
    setView({ y: today.getFullYear(), m: today.getMonth() });
    setSelected(new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime());
  }

  const isSameDay = (a: Date, ts: number) => dayKey(a.getTime()) === dayKey(ts);
  const isToday = (a: Date) => dayKey(a.getTime()) === dayKey(today.getTime());

  return (
    <div className="page calendar-page">
      <header className="cal-bar">
        <button className="text-btn back" type="button" onClick={() => navigate('/')}>‹ 时间线</button>
        <button className="text-btn accent" type="button" onClick={goToday}>今天</button>
      </header>

      <div className="cal-month">
        <h2>{MONTHS[view.m]} <span className="cal-year">{view.y}</span></h2>
        <div className="cal-arrows">
          <button type="button" onClick={() => shiftMonth(-1)} aria-label="上个月">‹</button>
          <button type="button" onClick={() => shiftMonth(1)} aria-label="下个月">›</button>
        </div>
      </div>

      <div className="cal-week">
        {WEEK.map((w) => <span key={w}>{w}</span>)}
      </div>

      <div className="cal-grid">
        {cells.map((d, i) => {
          const inMonth = d.getMonth() === view.m;
          const dotCount = dotMap.get(dayKey(d.getTime())) ?? 0;
          return (
            <button
              key={i}
              type="button"
              className={`cal-day ${inMonth ? '' : 'other'} ${isToday(d) ? 'today' : ''} ${isSameDay(d, selected) ? 'sel' : ''}`}
              aria-label={`${d.getMonth() + 1}月${d.getDate()}日，${dotCount} 条记录`}
              onClick={() => setSelected(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime())}
            >
              <span className="cal-num">{d.getDate()}</span>
              {dotCount > 0 && (
                <span className="cal-dots" aria-hidden="true">
                  {Array.from({ length: dotCount }, (_, dotIndex) => (
                    <i key={dotIndex} className="dot dot-entry" />
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="cal-day-label">
        {selDate.getMonth() + 1}月{selDate.getDate()}日 · 周{WEEK[selDate.getDay()]}
        {isToday(selDate) && <span> · 今天</span>}
        <span> · {dayNotes.length} 条</span>
      </div>

      {dayNotes.length === 0 ? (
        <div className="empty"><p>这一天没有记录。</p></div>
      ) : (
        dayNotes.map((n) => <NoteCard key={n.id} note={n} />)
      )}
    </div>
  );
}
