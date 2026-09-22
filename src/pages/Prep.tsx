import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { NoteCard } from '../components/NoteCard';
import type { Note } from '../types';

// 备考专栏：标签里含「备考」两个字的记录自动聚到这里。
// 用包含匹配而不是全等，#备考、#备考-英语、#考研备考 都算，分科打标签也不会漏。
const PREP_KEYWORD = '备考';

function isPrepNote(note: Note): boolean {
  return note.tags.some((tag) => tag.includes(PREP_KEYWORD));
}

const WEEK = 7 * 24 * 60 * 60 * 1000;

export function Prep() {
  const { notes, readOnly } = useStore();
  const navigate = useNavigate();
  const prep = useMemo(() => notes.filter(isPrepNote), [notes]);
  const thisWeek = useMemo(() => {
    const since = Date.now() - WEEK;
    return prep.filter((n) => n.createdAt >= since).length;
  }, [prep]);

  return (
    <div className="page prep-page">
      <header className="page-topbar">
        <span className="eyebrow">
          备考{prep.length > 0 ? ` · ${prep.length} 条 · 近 7 天 ${thisWeek} 条` : ''}
        </span>
        {!readOnly && (
          <button
            type="button"
            className="mini-link"
            onClick={() => navigate('/write', { state: { presetTags: [PREP_KEYWORD] } })}
          >
            ＋ 记一条
          </button>
        )}
      </header>

      {prep.length === 0 ? (
        <div className="empty">
          <p>还没有备考记录。</p>
          <p className="empty-sub">给记录加一个带「备考」的标签，比如 #备考、#备考-英语，就会自动出现在这里。</p>
        </div>
      ) : (
        prep.map((n) => <NoteCard key={n.id} note={n} timeMode="date" />)
      )}
    </div>
  );
}
