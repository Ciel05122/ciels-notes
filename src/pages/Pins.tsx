import { useMemo } from 'react';
import { useStore } from '../store';
import { NoteCard } from '../components/NoteCard';

// 置顶 tab：钉住的记录（个人原则、不想忘的事），固定按时间倒序，不随新内容滚走。
export function Pins() {
  const { notes } = useStore();
  const pinned = useMemo(() => notes.filter((n) => n.pinned), [notes]);

  return (
    <div className="page pins-page">
      <header className="page-topbar">
        <span className="eyebrow">置顶{pinned.length > 0 ? ` · ${pinned.length} 条` : ''}</span>
        <span />
      </header>

      {pinned.length === 0 ? (
        <div className="empty">
          <p>还没有置顶。</p>
          <p className="empty-sub">写记录时点「置顶」，或长按一条记录置顶。</p>
        </div>
      ) : (
        pinned.map((n) => <NoteCard key={n.id} note={n} />)
      )}
    </div>
  );
}
