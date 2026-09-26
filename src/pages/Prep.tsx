import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { NoteCard } from '../components/NoteCard';
import { PREP_TAG, isPrepNote, problemStatus, problemSubjects, withProblemStatus } from '../prep';
import type { Note } from '../types';

const WEEK = 7 * 24 * 60 * 60 * 1000;

// 「数学 2 · 英语 1」：一眼看出哪科堆的问题最多
function subjectBreakdown(problems: Note[]): string {
  const counts = new Map<string, number>();
  for (const n of problems) {
    const subject = problemSubjects(n)[0] ?? '未分科';
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([subject, count]) => `${subject} ${count}`)
    .join(' · ');
}

export function Prep() {
  const { notes, readOnly, updateNote } = useStore();
  const navigate = useNavigate();
  const [showDone, setShowDone] = useState(false);

  const prep = useMemo(() => notes.filter(isPrepNote), [notes]);
  const open = useMemo(() => prep.filter((n) => problemStatus(n) === 'open'), [prep]);
  const others = useMemo(() => prep.filter((n) => !problemStatus(n)), [prep]);
  // 已解决按「最近解决」排：刚搞定的在最上面
  const done = useMemo(
    () => prep.filter((n) => problemStatus(n) === 'done').sort((a, b) => b.updatedAt - a.updatedAt),
    [prep],
  );
  const thisWeek = useMemo(() => {
    const since = Date.now() - WEEK;
    return prep.filter((n) => n.createdAt >= since).length;
  }, [prep]);

  const setStatus = (n: Note, status: 'open' | 'done') =>
    updateNote(n.id, { tags: withProblemStatus(n.tags, status) });

  return (
    <div className="page prep-page">
      <header className="page-topbar">
        <span className="eyebrow">
          备考{prep.length > 0 ? ` · ${prep.length} 条 · 近 7 天 ${thisWeek} 条` : ''}
        </span>
        {!readOnly && (
          <div className="prep-actions">
            <button type="button" className="mini-link" onClick={() => navigate('/write', { state: { mode: 'problem' } })}>
              记一道题
            </button>
            <button type="button" className="mini-link" onClick={() => navigate('/write', { state: { presetTags: [PREP_TAG] } })}>
              ＋ 记一条
            </button>
          </div>
        )}
      </header>

      {prep.length === 0 ? (
        <div className="empty">
          <p>还没有备考记录。</p>
          <p className="empty-sub">卡住的题点「记一道题」拍下来；其它备考内容给记录加一个带「备考」的标签就会出现在这里。</p>
        </div>
      ) : (
        <>
          {open.length > 0 && (
            <section aria-label="待解决的问题">
              <div className="prep-section-head">
                <span className="prep-section-title">待解决 · {open.length}</span>
                <span>{subjectBreakdown(open)}</span>
              </div>
              {open.map((n) => (
                <div key={n.id} className="prep-problem">
                  <NoteCard note={n} timeMode="date" />
                  {!readOnly && (
                    <button type="button" className="resolve-btn" onClick={() => setStatus(n, 'done')}>
                      ✓ 标记已解决
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}

          {others.length > 0 && (
            <section aria-label="备考记录">
              {(open.length > 0 || done.length > 0) && (
                <div className="prep-section-head">
                  <span className="prep-section-title">备考记录 · {others.length}</span>
                </div>
              )}
              {others.map((n) => <NoteCard key={n.id} note={n} timeMode="date" />)}
            </section>
          )}

          {done.length > 0 && (
            <section aria-label="已解决的问题">
              <button
                type="button"
                className="prep-section-head prep-toggle"
                aria-expanded={showDone}
                onClick={() => setShowDone((v) => !v)}
              >
                <span className="prep-section-title">已解决 · {done.length}</span>
                <span>{showDone ? '收起' : '展开'}</span>
              </button>
              {showDone && done.map((n) => (
                <div key={n.id} className="prep-problem">
                  <NoteCard note={n} timeMode="date" />
                  {!readOnly && (
                    <button type="button" className="resolve-btn" onClick={() => setStatus(n, 'open')}>
                      改回待解决
                    </button>
                  )}
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </div>
  );
}
