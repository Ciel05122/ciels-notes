import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { dayKey, dayHeader } from '../date';
import { NoteCard } from '../components/NoteCard';
import type { Note, NoteType } from '../types';
import { loadTimer, clearTimer, createTimerNote, formatClock } from '../timer';
import { fetchLatestReviewAt } from '../cloudReviews';
import { loadReviewsSeenAt } from '../reviewsSeen';

const PAGE_SIZE = 18;
const TIMELINE_VIEW_KEY = 'kb.timeline.view.v1';
const TIMELINE_VIEW_TTL = 6 * 60 * 60 * 1000;

type Filter = 'all' | NoteType;
type TimelineViewState = {
  filter: Filter;
  visibleCount: number;
  scrollY: number;
  savedAt: number;
};

function clearTimelineView() {
  try {
    sessionStorage.removeItem(TIMELINE_VIEW_KEY);
  } catch {
    // 某些隐私模式禁用 sessionStorage，不影响正常浏览
  }
}

function readTimelineView(): TimelineViewState | null {
  try {
    const raw = sessionStorage.getItem(TIMELINE_VIEW_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<TimelineViewState>;
    const validFilter = value.filter === 'all' || value.filter === 'personal' || value.filter === 'professional';
    const fresh = typeof value.savedAt === 'number' && Date.now() - value.savedAt < TIMELINE_VIEW_TTL;
    if (!validFilter || !fresh || !Number.isFinite(value.visibleCount) || !Number.isFinite(value.scrollY)) {
      clearTimelineView();
      return null;
    }
    return {
      filter: value.filter as Filter,
      visibleCount: Math.max(PAGE_SIZE, Number(value.visibleCount)),
      scrollY: Math.max(0, Number(value.scrollY)),
      savedAt: Number(value.savedAt),
    };
  } catch {
    clearTimelineView();
    return null;
  }
}

export function Timeline() {
  const { notes, syncing, user, readOnly, signOut } = useStore();
  const navigate = useNavigate();
  const [initialView] = useState<TimelineViewState | null>(() => readTimelineView());
  const [filter, setFilter] = useState<Filter>(initialView?.filter ?? 'all');
  const [visibleCount, setVisibleCount] = useState(initialView?.visibleCount ?? PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const restoredViewRef = useRef(false);
  const filterReadyRef = useRef(false);
  const [reviewUnread, setReviewUnread] = useState(false);

  // 只取最新一份回顾的时间，用来决定要不要显示小红点。读不到就当没有，不打扰浏览。
  useEffect(() => {
    let alive = true;
    fetchLatestReviewAt()
      .then((ts) => {
        if (alive && ts) setReviewUnread(ts > loadReviewsSeenAt());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(
    () => (filter === 'all' ? notes : notes.filter((n) => n.type === filter)),
    [notes, filter],
  );

  const visible = filtered.slice(0, visibleCount);

  const groups = useMemo(() => {
    const map = new Map<string, typeof visible>();
    for (const n of visible) {
      const key = dayKey(n.createdAt);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(n);
    }
    return Array.from(map.entries());
  }, [visible]);

  // 无限滚动
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0].isIntersecting) {
          setVisibleCount((c) => (c < filtered.length ? c + PAGE_SIZE : c));
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  // 切换筛选时回到第一屏；从详情页返回时保留原来的已加载条数
  useEffect(() => {
    if (!filterReadyRef.current) {
      filterReadyRef.current = true;
      return;
    }
    setVisibleCount(PAGE_SIZE);
  }, [filter]);

  // 从详情页返回后，等时间轴内容恢复再精确回到原来的位置
  useLayoutEffect(() => {
    if (!initialView || restoredViewRef.current) return;
    if (initialView.scrollY > 0 && notes.length === 0) return;

    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => {
        window.scrollTo({ top: initialView.scrollY, behavior: 'auto' });
        restoredViewRef.current = true;
        clearTimelineView();
      });
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
    };
  }, [initialView, notes.length]);

  function openNoteDetail(note: Note, options?: { focusReply?: boolean }) {
    const view: TimelineViewState = {
      filter,
      visibleCount,
      scrollY: window.scrollY,
      savedAt: Date.now(),
    };
    try {
      sessionStorage.setItem(TIMELINE_VIEW_KEY, JSON.stringify(view));
    } catch {
      // 存储不可用时仍然允许进入详情，只放弃返回位置恢复
    }
    navigate(`/note/${encodeURIComponent(note.id)}`, {
      state: { fromApp: true, focusReply: !!options?.focusReply },
    });
  }

  return (
    <div className="page timeline-page">
      <header className="page-topbar">
        <span className="timeline-kicker">生活时间轴</span>
        <div className="header-icons">
          <button
            className="account-btn"
            type="button"
            aria-label={reviewUnread ? '回顾（有新报告）' : '回顾'}
            onClick={() => navigate('/reviews')}
          >
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z" />
              <path d="M14.5 3.5V8h4.5" />
              <line x1="8.5" y1="12.5" x2="15" y2="12.5" />
              <line x1="8.5" y1="16" x2="13" y2="16" />
            </svg>
            {reviewUnread && <span className="unread-dot" aria-hidden="true" />}
          </button>
          {!readOnly && (
          <button className="account-btn" type="button" aria-label="计时" onClick={() => navigate('/timer')}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="12" cy="13.5" r="7.5" />
              <line x1="12" y1="13.5" x2="12" y2="9.5" />
              <line x1="9.5" y1="2.5" x2="14.5" y2="2.5" />
              <line x1="12" y1="2.5" x2="12" y2="5" />
            </svg>
          </button>
          )}
          <button className="account-btn" type="button" aria-label="日历总览" onClick={() => navigate('/calendar')}>
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
              <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
              <line x1="3" y1="9" x2="21" y2="9" />
              <line x1="8" y1="2.5" x2="8" y2="6" strokeLinecap="round" />
              <line x1="16" y1="2.5" x2="16" y2="6" strokeLinecap="round" />
              <circle cx="8" cy="13" r="1" fill="currentColor" stroke="none" />
              <circle cx="12" cy="13" r="1" fill="currentColor" stroke="none" />
              <circle cx="16" cy="13" r="1" fill="currentColor" stroke="none" />
            </svg>
          </button>
        </div>
      </header>

      <TimerBanner />

      {/* 搜索栏：点一下进搜索页 */}
      <button className="search-trigger" type="button" onClick={() => navigate('/search')}>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
        </svg>
        <span>搜索任意一条想法、影评、报告…</span>
      </button>

      {/* 输入框：点一下进全屏写字页 */}
      {readOnly ? (
        <div className="demo-banner">
          <strong>只读演示</strong>
          <span>数据为虚构示例，可以随意浏览；写入功能在数据库层已关闭。</span>
        </div>
      ) : (
      <button className="composer-trigger" type="button" onClick={() => navigate('/write')}>
        <span className="composer-placeholder">此刻在想什么…</span>
        <div className="composer-foot">
          <span className="composer-icons">
            <IconPaperclip /><IconImage /><IconTag />
          </span>
          <span className="composer-hint">无需标题 · 无需分类</span>
        </div>
      </button>
      )}

      {/* 筛选条 */}
      <div className="filter-row">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>全部</Chip>
        <Chip active={filter === 'personal'} onClick={() => setFilter('personal')}>个人</Chip>
        <Chip active={filter === 'professional'} onClick={() => setFilter('professional')}>专业</Chip>
      </div>

      {/* 时间线 */}
      {filtered.length === 0 ? (
        <div className="empty">
          <p>{filter === 'all' ? '还没有任何记录。' : '这个分类下还没有记录。'}</p>
          <p className="empty-sub">点上面的输入框，写下第一条吧。</p>
        </div>
      ) : (
        <div className="timeline-feed">
          {groups.map(([key, dayNotes]) => (
            <section key={key} className="day-group">
              <DateAnchor timestamp={dayNotes[0].createdAt} />
              <div className="timeline-day-notes">
                {dayNotes.map((n) => (
                  <NoteCard
                    key={n.id}
                    note={n}
                    variant="timeline"
                    onOpenDetail={(options) => openNoteDetail(n, options)}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
      <div ref={sentinelRef} className="sentinel" />

      <footer className="tl-footer">
        <span>{syncing ? '云端同步中…' : '已云端同步'}{user?.email ? ` · ${user.email}` : ''}</span>
        <button type="button" className="signout-btn" onClick={() => signOut()}>退出登录</button>
      </footer>
    </div>
  );
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function DateAnchor({ timestamp }: { timestamp: number }) {
  const date = new Date(timestamp);
  const fullLabel = dayHeader(timestamp);
  const relative = fullLabel.startsWith('今天')
    ? '今天'
    : fullLabel.startsWith('昨天')
      ? '昨天'
      : fullLabel.startsWith('前天')
        ? '前天'
        : WEEKDAYS[date.getDay()];
  const showYear = date.getFullYear() !== new Date().getFullYear();

  return (
    <div
      className="timeline-date"
      aria-label={fullLabel}
      title={fullLabel}
    >
      <span className="timeline-month" lang="en">{MONTHS[date.getMonth()]}</span>
      <strong className="timeline-day">{date.getDate()}</strong>
      <span className="timeline-weekday">{relative}</span>
      {showYear && <span className="timeline-year">{date.getFullYear()}</span>}
    </div>
  );
}

// 计时进行中：首页顶部细横条，点击回到计时页；倒计时早已到点则自动补记
function TimerBanner() {
  const { addNote } = useStore();
  const navigate = useNavigate();
  const [t, setT] = useState(loadTimer());
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const iv = setInterval(() => {
      const cur = loadTimer();
      // 没有计时且上次也没有 → 什么都不做，别让首页每秒白白重渲染
      setT((prev) => (JSON.stringify(prev) === JSON.stringify(cur) ? prev : cur));
      if (cur) setNow(Date.now());
    }, 1000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (t?.mode === 'down' && t.target) {
      const elapsed = Math.floor((now - t.startedAt) / 1000);
      if (elapsed >= t.target) {
        addNote(createTimerNote(t.task, t.startedAt, t.target));
        clearTimer();
        setT(null);
      }
    }
  }, [t, now, addNote]);

  if (!t) return null;
  const elapsed = Math.floor((now - t.startedAt) / 1000);
  const label = t.mode === 'down' && t.target
    ? `还剩 ${formatClock(t.target - elapsed)}`
    : `已计 ${formatClock(elapsed)}`;

  return (
    <button type="button" className="timer-banner" onClick={() => navigate('/timer')}>
      ⏱ {t.task} · {label}
    </button>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button className={`filter-chip ${active ? 'active' : ''}`} onClick={onClick} type="button">
      {children}
    </button>
  );
}

function IconPaperclip() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11l-8.5 8.5a4 4 0 01-6-6L14 5a3 3 0 014 4l-8.5 8.5a1.5 1.5 0 01-2-2L13 8" />
    </svg>
  );
}
function IconImage() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.5" /><path d="M21 16l-5-5L5 20" />
    </svg>
  );
}
function IconTag() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M3 12l8-8h7a2 2 0 012 2v7l-8 8z" /><circle cx="15" cy="9" r="1.4" fill="currentColor" stroke="none" />
    </svg>
  );
}
