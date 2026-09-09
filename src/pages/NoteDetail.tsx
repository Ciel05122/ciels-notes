import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { AttachmentChip } from '../components/Attachment';
import { ImageGrid, Lightbox } from '../components/ImageGrid';
import { useStore } from '../store';
import { newComment } from '../types';
import { formatDuration } from '../timer';

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

type DetailLocationState = {
  // 站内任意列表页跳进来都会带上，用来区分「返回上一页」和「直接打开链接」
  fromApp?: boolean;
  focusReply?: boolean;
};

function detailDateTime(timestamp: number): string {
  const date = new Date(timestamp);
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} · ${hour}:${minute}`;
}

export function NoteDetail() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { notes, syncing, updateNote, deleteNote } = useStore();
  const note = notes.find((item) => item.id === id);
  const state = location.state as DetailLocationState | null;
  const [viewer, setViewer] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);
  const [replyText, setReplyText] = useState('');
  const replyRef = useRef<HTMLTextAreaElement>(null);

  const comments = note?.comments ?? [];

  useLayoutEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [id]);

  useEffect(() => {
    if (!note || !state?.focusReply) return;
    const frame = requestAnimationFrame(() => replyRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [note, state?.focusReply]);

  useEffect(() => {
    const field = replyRef.current;
    if (!field) return;
    field.style.height = 'auto';
    const height = Math.min(field.scrollHeight, 112);
    field.style.height = `${height}px`;
    field.style.overflowY = field.scrollHeight > 112 ? 'auto' : 'hidden';
  }, [replyText]);

  function goBack() {
    // 从站内进来的就退回上一页（搜索页能落回同一批结果）；
    // 直接开链接或 PWA 冷启动没有上一页，才回首页。
    if (state?.fromApp) {
      navigate(-1);
      return;
    }
    navigate('/', { replace: true });
  }

  function addReply(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    const text = replyText.trim();
    if (!note || !text) return;
    updateNote(note.id, { comments: [...comments, newComment(text)] });
    setReplyText('');
  }

  function handleReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  if (!note) {
    return (
      <div className="page note-detail-page">
        <DetailHeader onBack={goBack} />
        <main className="detail-state" id="main-content">
          <p>{syncing ? '正在读取这条记录…' : '没有找到这条记录'}</p>
          {!syncing && (
            <button type="button" className="detail-home-btn" onClick={() => navigate('/', { replace: true })}>
              返回首页
            </button>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="page note-detail-page">
      <DetailHeader onBack={goBack} onMore={() => setSheet(true)} />

      <main id="main-content">
        <article className="note-detail-article">
          {(note.type || note.pinned || note.isGoal || note.timer) && (
            <div className="detail-status" aria-label="记录状态">
              {note.type && <span>{note.type === 'personal' ? '个人' : '专业'}</span>}
              {note.pinned && <span className="detail-accent">✦ 置顶</span>}
              {note.isGoal && <span className="detail-accent">◎ {note.goalDone ? '目标完成' : '目标'}</span>}
              {note.timer && <span className="detail-accent">⏱ {formatDuration(note.timer.seconds)}</span>}
            </div>
          )}

          {note.text && <div className="detail-note-text" lang="zh">{note.text}</div>}

          {note.images.length > 0 && (
            <ImageGrid images={note.images} onOpen={(index) => setViewer(index)} />
          )}

          {note.files.length > 0 && (
            <div className="attach-list detail-attachments">
              {note.files.map((file) => <AttachmentChip key={file.id} file={file} />)}
            </div>
          )}

          <footer className="detail-record-meta">
            <time dateTime={new Date(note.createdAt).toISOString()}>{detailDateTime(note.createdAt)}</time>
            {(note.location || note.tags.length > 0) && (
              <div className="detail-context">
                {note.location && <span className="detail-location"><span aria-hidden="true">⌖</span>{note.location}</span>}
                {note.tags.map((tag) => <span key={tag} className="detail-tag">#{tag}</span>)}
              </div>
            )}
          </footer>

          <section className="detail-replies" aria-labelledby="detail-replies-title">
            <header className="detail-replies-head">
              <h2 id="detail-replies-title">回复</h2>
              <span aria-live="polite">{comments.length}</span>
            </header>

            {comments.length > 0 ? (
              <div className="detail-reply-list">
                {comments.map((comment) => (
                  <article key={comment.id} className="detail-reply">
                    <div className="detail-reply-text" lang="zh">{comment.text}</div>
                    <footer className="detail-reply-meta">
                      <time dateTime={new Date(comment.createdAt).toISOString()}>{detailDateTime(comment.createdAt)}</time>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm('删除这条回复？')) {
                            updateNote(note.id, { comments: comments.filter((item) => item.id !== comment.id) });
                          }
                        }}
                      >
                        删除
                      </button>
                    </footer>
                  </article>
                ))}
              </div>
            ) : (
              <p className="detail-replies-empty">还没有回复，可以在下面补充此刻的新想法。</p>
            )}
          </section>
        </article>
      </main>

      <form className="detail-reply-composer" onSubmit={addReply}>
        <label className="sr-only" htmlFor="detail-reply-input">写下回复</label>
        <textarea
          id="detail-reply-input"
          ref={replyRef}
          rows={1}
          value={replyText}
          placeholder="写下回复…"
          onChange={(event) => setReplyText(event.target.value)}
          onKeyDown={handleReplyKeyDown}
        />
        <button type="submit" disabled={!replyText.trim()}>发送</button>
      </form>

      {viewer !== null && (
        <Lightbox images={note.images} index={viewer} onClose={() => setViewer(null)} />
      )}

      {sheet && createPortal(
        <div className="sheet-mask" onClick={() => setSheet(false)}>
          <div className="action-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-group">
              <button type="button" onClick={() => { setSheet(false); navigate(`/edit/${note.id}`); }}>编辑</button>
              <button type="button" onClick={() => { updateNote(note.id, { pinned: !note.pinned }); setSheet(false); }}>
                {note.pinned ? '取消置顶' : '置顶'}
              </button>
              <button type="button" onClick={() => { updateNote(note.id, { isGoal: !note.isGoal }); setSheet(false); }}>
                {note.isGoal ? '取消目标' : '设为目标'}
              </button>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  if (confirm('删除这条记录？')) {
                    deleteNote(note.id);
                    setSheet(false);
                    navigate('/', { replace: true });
                  }
                }}
              >
                删除
              </button>
            </div>
            <button type="button" className="sheet-cancel" onClick={() => setSheet(false)}>取消</button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}

function DetailHeader({ onBack, onMore }: { onBack: () => void; onMore?: () => void }) {
  return (
    <header className="note-detail-header">
      <button type="button" className="detail-header-action detail-back" onClick={onBack} aria-label="返回">
        <svg viewBox="0 0 24 24" width="23" height="23" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      <h1 className="note-detail-title">记录详情</h1>
      {onMore ? (
        <button type="button" className="detail-header-action detail-more" onClick={onMore} aria-label="更多操作">⋯</button>
      ) : <span aria-hidden="true" />}
    </header>
  );
}
