import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { Note } from '../types';
import { timeLabel, dateLabel } from '../date';
import { ImageGrid, Lightbox } from './ImageGrid';
import { AttachmentChip } from './Attachment';
import { highlight } from '../highlight';
import { useStore } from '../store';
import { formatDuration } from '../timer';
import { problemStatus, withProblemStatus } from '../prep';

interface Props {
  note: Note;
  // 卡片头部时间显示：时间线用「时:分」，搜索/日历用「月日」
  timeMode?: 'time' | 'date';
  // 搜索高亮关键词
  keyword?: string;
  // 首页使用更克制的时间轴摘要，其他页面保持原卡片布局
  variant?: 'default' | 'timeline';
  // 首页打开独立详情页，并可直接聚焦底部回复栏
  onOpenDetail?: (options?: { focusReply?: boolean }) => void;
}

export function NoteCard({ note, timeMode = 'time', keyword, variant = 'default', onOpenDetail }: Props) {
  const navigate = useNavigate();
  const { updateNote, deleteNote, readOnly } = useStore();
  const isTimeline = variant === 'timeline';
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [sheet, setSheet] = useState(false);

  const comments = note.comments ?? [];
  function deleteComment(cid: string) {
    updateNote(note.id, { comments: comments.filter((c) => c.id !== cid) });
  }

  // 折叠检测（ResizeObserver 等布局稳定后再测，避免首帧误判）
  useLayoutEffect(() => {
    const el = textRef.current;
    if (!el) return;
    const measure = () => setOverflow(el.scrollHeight > el.clientHeight + 2);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [note.text]);

  const timeText = timeMode === 'date' ? dateLabel(note.createdAt) : timeLabel(note.createdAt);

  function openDetail(focusReply = false) {
    if (onOpenDetail) {
      onOpenDetail({ focusReply });
      return;
    }
    navigate(`/note/${encodeURIComponent(note.id)}`, { state: { fromApp: true, focusReply } });
  }

  const noteText = (
    <span ref={textRef} className="note-text clamp" lang="zh">
      {keyword ? highlight(note.text, keyword) : note.text}
    </span>
  );

  return (
    <article className={`note-card ${isTimeline ? 'note-card-timeline' : ''}`}>
      <header className="note-head">
        {isTimeline ? (
          <div className="timeline-note-status" aria-label="记录信息">
            <time className="note-time">{timeText}</time>
            {note.tags.map((tag) => (
              <span key={tag} className="timeline-note-tag">#{tag}</span>
            ))}
            {note.type && <span>{note.type === 'personal' ? '个人' : '专业'}</span>}
            {note.pinned && <span className="status-accent">✦ 置顶</span>}
            {note.isGoal && <span className="status-accent">◎ {note.goalDone ? '目标完成' : '目标'}</span>}
            {note.timer && <span className="status-accent">⏱ {formatDuration(note.timer.seconds)}</span>}
          </div>
        ) : (
          <>
            <div className="note-headline">
              {note.pinned && <span className="pill pill-accent">✦ 置顶</span>}
              {note.isGoal && <span className="pill pill-accent">◎ 目标</span>}
              {note.timer && <span className="pill pill-accent">⏱ {formatDuration(note.timer.seconds)}</span>}
              {note.type === 'personal' && <span className="pill">个人</span>}
              {note.type === 'professional' && <span className="pill">专业</span>}
              {note.tags.map((t) => (
                <span key={t} className="pill">{t}</span>
              ))}
              {note.location && <span className="pill">📍{note.location}</span>}
            </div>
            <time className="note-time">{timeText}</time>
          </>
        )}
        {!readOnly && (
          <button className="more-actions" type="button" aria-label="更多操作" onClick={() => setSheet(true)}>⋯</button>
        )}
      </header>

      {note.text && (
        <div className="note-body">
          {isTimeline ? (
            <button
              className="note-body-trigger"
              type="button"
              aria-label="查看完整记录"
              onClick={() => openDetail()}
            >
              {noteText}
            </button>
          ) : noteText}
          {overflow && (
            <button className="more-btn" onClick={() => openDetail()} type="button">
              全文
            </button>
          )}
        </div>
      )}

      {note.images.length > 0 && <ImageGrid images={note.images} compact={isTimeline} onOpen={(i) => setViewer(i)} />}

      {note.files.length > 0 && (
        <div className="attach-list">
          {note.files.map((f) => (
            <AttachmentChip key={f.id} file={f} />
          ))}
        </div>
      )}

      {isTimeline && note.location && (
        <div className="timeline-note-context">
          <span className="context-location"><span aria-hidden="true">⌖</span>{note.location}</span>
        </div>
      )}

      {/* 备注 */}
      {comments.length > 0 && !isTimeline && (
        <div className="note-comments">
          {comments.map((c) => (
            <div key={c.id} className="comment">
              <span className="comment-text">{c.text}</span>
              <span className="comment-time">{dateLabel(c.createdAt)}</span>
              {!readOnly && (
                <button type="button" className="comment-del" onClick={() => deleteComment(c.id)} aria-label="删除回复">×</button>
              )}
            </div>
          ))}
        </div>
      )}
      {isTimeline ? (
        <div className="timeline-comment-actions">
          <button type="button" className="add-comment-btn" onClick={() => openDetail()}>
            {comments.length > 0 ? `回复 ${comments.length}` : '查看详情'}
          </button>
          {!readOnly && (
            <button type="button" className="add-comment-btn" onClick={() => openDetail(true)}>
              ＋ 回复
            </button>
          )}
        </div>
      ) : !readOnly ? (
        <button type="button" className="add-comment-btn" onClick={() => openDetail(true)}>＋ 回复</button>
      ) : null}

      {viewer !== null && (
        <Lightbox images={note.images} index={viewer} onClose={() => setViewer(null)} />
      )}

      {sheet && createPortal(
        <div className="sheet-mask" onClick={() => setSheet(false)}>
          <div className="action-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="sheet-group">
              <button type="button" onClick={() => { setSheet(false); navigate(`/edit/${note.id}`); }}>编辑</button>
              <button type="button" onClick={() => { updateNote(note.id, { pinned: !note.pinned }); setSheet(false); }}>
                {note.pinned ? '取消置顶' : '置顶'}
              </button>
              <button type="button" onClick={() => { updateNote(note.id, { isGoal: !note.isGoal }); setSheet(false); }}>
                {note.isGoal ? '取消目标' : '设为目标'}
              </button>
              {problemStatus(note) && (
                <button
                  type="button"
                  onClick={() => {
                    updateNote(note.id, { tags: withProblemStatus(note.tags, problemStatus(note) === 'open' ? 'done' : 'open') });
                    setSheet(false);
                  }}
                >
                  {problemStatus(note) === 'open' ? '标记已解决' : '改回待解决'}
                </button>
              )}
              <button type="button" className="danger" onClick={() => { if (confirm('删除这条记录？')) deleteNote(note.id); setSheet(false); }}>
                删除
              </button>
            </div>
            <button type="button" className="sheet-cancel" onClick={() => setSheet(false)}>取消</button>
          </div>
        </div>,
        document.body,
      )}
    </article>
  );
}
