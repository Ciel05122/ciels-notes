import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store';
import { NoteCard } from '../components/NoteCard';
import {
  clearSearchHistory,
  loadSearchHistory,
  recordSearch,
  removeSearch,
  suggestedTags,
} from '../storage';

const RECORD_DELAY = 1200;
const URL_SYNC_DELAY = 400;

export function Search() {
  const { notes } = useStore();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [q, setQ] = useState(() => params.get('q') ?? '');
  const [history, setHistory] = useState<string[]>(() => loadSearchHistory());
  const inputRef = useRef<HTMLInputElement>(null);
  const selfSetRef = useRef<string | null>(null);
  const [focused, setFocused] = useState(false);

  // 把关键词同步进 URL（replace，不堆历史记录）。
  // 关键：编辑页保存后走的是 navigate(-1)，退回的是历史里那条 /search。
  // 关键词只留在组件 state 里的话，退回来就是一个空搜索页——所以必须写进 URL。
  const syncQueryToUrl = useCallback((keyword: string) => {
    const next = new URLSearchParams(params);
    if (keyword) next.set('q', keyword);
    else next.delete('q');
    selfSetRef.current = keyword;
    setParams(next, { replace: true });
  }, [params, setParams]);

  useEffect(() => {
    if (q === (params.get('q') ?? '')) return;
    const timer = setTimeout(() => syncQueryToUrl(q), URL_SYNC_DELAY);
    return () => clearTimeout(timer);
  }, [q, params, syncQueryToUrl]);

  // URL 变化（气泡跳入 / 点搜索 tab 回到裸 /search / 从编辑页退回）时同步输入框与焦点。
  // 自己刚同步上去的那次要跳过，否则会把用户这期间新打的字回灌覆盖掉。
  useEffect(() => {
    const p = params.get('q') ?? '';
    if (selfSetRef.current === p) return;
    selfSetRef.current = null;
    setQ(p);
    if (!p) inputRef.current?.focus();
  }, [params]);

  const kw = q.trim().toLowerCase();

  const results = useMemo(() => {
    if (!kw) return [];
    return notes.filter((n) => {
      const hay = [n.text, n.location ?? '', ...n.tags].join(' ').toLowerCase();
      return hay.includes(kw);
    });
  }, [notes, kw]);

  // 边打字边搜索，所以不能每次按键都记。停手一会儿、且真的搜到东西了才算一次搜索。
  useEffect(() => {
    if (!kw || results.length === 0) return;
    const timer = setTimeout(() => setHistory(recordSearch(q)), RECORD_DELAY);
    return () => clearTimeout(timer);
  }, [kw, q, results.length]);

  const commonTags = useMemo(() => suggestedTags(notes), [notes]);

  // 点得比 400ms 防抖还快时，这里补一次同步兜底。
  function openDetail(noteId: string, focusReply = false) {
    if (q !== (params.get('q') ?? '')) syncQueryToUrl(q);
    setHistory(recordSearch(q));
    navigate(`/note/${encodeURIComponent(noteId)}`, { state: { fromApp: true, focusReply } });
  }

  // 搜索是底栏三个 tab 之一，是个独立页面，「取消」只清空输入并收起键盘，不跳走。
  function cancel() {
    setQ('');
    setFocused(false);
    inputRef.current?.blur();
  }

  function pick(keyword: string) {
    setQ(keyword);
    inputRef.current?.focus();
  }

  return (
    <div className="page search-page">
      <header className="search-bar-row">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            ref={inputRef}
            className="search-input"
            placeholder="搜索任意一条想法、影评、报告…"
            value={q}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results.length > 0) setHistory(recordSearch(q));
            }}
          />
          {q && <button type="button" className="clear-btn" onClick={() => setQ('')}>×</button>}
        </div>
        {(focused || q) && (
          <button
            type="button"
            className="text-btn"
            // 先于 blur 阻止失焦，否则按钮会在 click 之前被卸载
            onMouseDown={(e) => e.preventDefault()}
            onClick={cancel}
          >
            取消
          </button>
        )}
      </header>

      {!kw ? (
        <div className="search-idle">
          {history.length > 0 && (
            <>
              <div className="section-label section-label-row">
                <span>最近搜索</span>
                <button type="button" className="text-btn subtle" onClick={() => setHistory(clearSearchHistory())}>
                  清除
                </button>
              </div>
              <div className="common-tags">
                {history.map((item) => (
                  <span key={item} className="common-tag recent-search">
                    <button type="button" className="recent-search-text" onClick={() => pick(item)}>
                      {item}
                    </button>
                    <button
                      type="button"
                      className="recent-search-del"
                      aria-label={`删除搜索记录 ${item}`}
                      onClick={() => setHistory(removeSearch(item))}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </>
          )}

          {commonTags.length > 0 && (
            <>
              <div className="section-label">常用标签</div>
              <div className="common-tags">
                {commonTags.map((t) => (
                  <button key={t.tag} type="button" className="common-tag" onClick={() => pick(t.tag)}>
                    #{t.tag}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="section-label">命中 {results.length} 条 · 按时间倒序</div>
          {results.length === 0 ? (
            <div className="empty"><p>没有找到「{q}」相关的记录。</p></div>
          ) : (
            results.map((n) => (
              <NoteCard
                key={n.id}
                note={n}
                timeMode="date"
                keyword={q}
                onOpenDetail={(o) => openDetail(n.id, o?.focusReply)}
              />
            ))
          )}
        </>
      )}
    </div>
  );
}
