import { useMemo } from 'react';
import { useStore } from '../store';
import { NoteCard } from '../components/NoteCard';

// 目标 tab：所有标了「目标」的记录，带完成勾选；完成的划掉并沉到底部。
export function Goals() {
  const { notes, updateNote } = useStore();

  const goals = useMemo(() => {
    return notes
      .filter((n) => n.isGoal)
      .sort((a, b) => {
        // 未完成在前，再按时间倒序
        if (!!a.goalDone !== !!b.goalDone) return a.goalDone ? 1 : -1;
        return b.createdAt - a.createdAt;
      });
  }, [notes]);

  const doneCount = goals.filter((g) => g.goalDone).length;

  return (
    <div className="page goals-page">
      <header className="page-topbar">
        <span className="eyebrow">
          目标{goals.length > 0 ? ` · ${doneCount}/${goals.length} 已完成` : ''}
        </span>
        <span />
      </header>

      {goals.length === 0 ? (
        <div className="empty">
          <p>还没有目标。</p>
          <p className="empty-sub">写记录时点「目标」，或长按一条记录设为目标。</p>
        </div>
      ) : (
        goals.map((n) => (
          <div key={n.id} className={`goal-item ${n.goalDone ? 'done' : ''}`}>
            <button
              type="button"
              className={`goal-check ${n.goalDone ? 'on' : ''}`}
              aria-label={n.goalDone ? '标记未完成' : '标记完成'}
              onClick={() => updateNote(n.id, { goalDone: !n.goalDone })}
            >
              {n.goalDone ? '✓' : ''}
            </button>
            <div className="goal-body">
              <NoteCard note={n} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
