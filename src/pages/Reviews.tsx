import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { fetchReview, fetchReviewList, deleteReview, type Review, type ReviewMeta } from '../cloudReviews';
import { dateLabel } from '../date';
import { saveReviewsSeenAt } from '../reviewsSeen';
import { useStore } from '../store';

// 回顾报告由电脑上的分析任务生成后写入云端，网页只负责读和删。
// 正文是 Markdown，渲染前一律过一遍 DOMPurify——报告里引用了自己的记录原文，
// 万一某条记录里写过 HTML，不能让它变成真的标签。

function renderMarkdown(source: string): string {
  const html = marked.parse(source, { async: false, gfm: true, breaks: false }) as string;
  return DOMPurify.sanitize(html);
}

function periodLabel(r: ReviewMeta): string {
  return `${dateLabel(r.periodStart)} — ${dateLabel(r.periodEnd)}`;
}

// —— 列表页 ——

export function Reviews() {
  const navigate = useNavigate();
  const [list, setList] = useState<ReviewMeta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetchReviewList()
      .then((rows) => {
        if (!alive) return;
        setList(rows);
        if (rows.length) saveReviewsSeenAt(rows[0].createdAt);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page reviews-page">
      <header className="page-topbar">
        <span className="eyebrow">回顾{list?.length ? ` · ${list.length} 份` : ''}</span>
        <span />
      </header>

      {error && (
        <div className="review-error">
          读取失败：{error}
          <button type="button" className="mini-link" onClick={() => window.location.reload()}>重试</button>
        </div>
      )}

      {!error && list === null && <p className="review-loading">正在读取…</p>}

      {!error && list?.length === 0 && (
        <div className="empty">
          <p>还没有回顾。</p>
          <p className="empty-sub">攒够约 12 条新记录、且距上次超过 4 天时，电脑上的分析任务会自动生成一份。</p>
        </div>
      )}

      {list?.map((r) => (
        <button
          key={r.id}
          type="button"
          className="review-item"
          onClick={() => navigate(`/reviews/${encodeURIComponent(r.id)}`)}
        >
          <span className="review-item-period">{periodLabel(r)}</span>
          <span className="review-item-meta">
            {r.noteCount} 条记录 · 生成于 {dateLabel(r.createdAt)}
          </span>
        </button>
      ))}
    </div>
  );
}

// —— 详情页 ——

export function ReviewDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const [review, setReview] = useState<Review | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { readOnly } = useStore();

  useEffect(() => {
    let alive = true;
    setReview(null);
    fetchReview(id)
      .then((r) => {
        if (!alive) return;
        if (!r) setError('这份回顾不存在，可能已经被删除。');
        else setReview(r);
      })
      .catch((e: unknown) => alive && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      alive = false;
    };
  }, [id]);

  const html = useMemo(() => (review ? renderMarkdown(review.content) : ''), [review]);

  const remove = useCallback(async () => {
    try {
      await deleteReview(id);
      navigate('/reviews', { replace: true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id, navigate]);

  return (
    <div className="page review-detail-page">
      <header className="page-topbar">
        <button type="button" className="account-btn" aria-label="返回回顾列表" onClick={() => navigate('/reviews')}>
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <span className="eyebrow">{review ? periodLabel(review) : '回顾'}</span>
        {review && !readOnly ? (
          <button type="button" className="account-btn" aria-label="删除这份回顾" onClick={() => setConfirmDelete(true)}>
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M5 7h14" /><path d="M9 7V5h6v2" /><path d="M7 7l1 13h8l1-13" />
            </svg>
          </button>
        ) : (
          <span />
        )}
      </header>

      {error && <div className="review-error">{error}</div>}
      {!error && !review && <p className="review-loading">正在读取…</p>}

      {review && (
        <>
          <p className="review-detail-meta">
            {review.noteCount} 条记录 · 生成于 {dateLabel(review.createdAt)}
          </p>
          {/* 已经过 DOMPurify 清洗 */}
          <article className="review-body" dangerouslySetInnerHTML={{ __html: html }} />
        </>
      )}

      {confirmDelete && (
        <div className="review-confirm" role="dialog" aria-label="确认删除">
          <p>删除这份回顾？本机 reports 目录里的文件不受影响。</p>
          <div className="review-confirm-actions">
            <button type="button" className="mini-link" onClick={() => setConfirmDelete(false)}>取消</button>
            <button type="button" className="mini-link danger" onClick={remove}>删除</button>
          </div>
        </div>
      )}
    </div>
  );
}
