import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store';
import { tagStats } from '../storage';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const WEEKLY_LIMIT = 6;

// 标签页：最近 7 天常用主题固定在第一行，其余标签再按历史热度排列。
export function Tags() {
  const { tags, notes } = useStore();
  const navigate = useNavigate();

  const total = useMemo(() => tags.reduce((s, t) => s + t.count, 0), [tags]);
  const weeklyTags = useMemo(
    () => tagStats(notes, { since: Date.now() - WEEK_MS }).slice(0, WEEKLY_LIMIT),
    [notes],
  );
  const weeklyTagNames = useMemo(() => new Set(weeklyTags.map((item) => item.tag)), [weeklyTags]);
  const remainingTags = useMemo(
    () => tags.filter((item) => !weeklyTagNames.has(item.tag)),
    [tags, weeklyTagNames],
  );
  const maxCount = remainingTags[0]?.count ?? 1;

  function sizeClass(count: number): string {
    if (count === 1) return 'sm'; // 只用过一次的永远最小，哪怕它就是最大值
    const r = count / maxCount;
    if (r >= 0.999) return 'xl';
    if (r >= 0.4) return 'lg';
    return 'md';
  }

  return (
    <div className="page tags-page">
      <header className="page-topbar">
        <span className="eyebrow">
          {tags.length > 0 ? `${tags.length} 个标签 · 共使用 ${total} 次` : '标签'}
        </span>
        <div className="header-icons">
          <button type="button" className="mini-link" onClick={() => navigate('/goals')}>◎ 目标</button>
          <button type="button" className="mini-link" onClick={() => navigate('/pins')}>◇ 置顶</button>
        </div>
      </header>

      {tags.length === 0 ? (
        <div className="empty">
          <p>还没有标签。</p>
          <p className="empty-sub">写记录时加上标签，这里会慢慢形成你的主题档案。</p>
        </div>
      ) : (
        <>
          {weeklyTags.length > 0 && (
            <section className="weekly-tags" aria-labelledby="weekly-tags-title">
              <header className="tags-section-head">
                <div>
                  <h1 id="weekly-tags-title">最近 7 天</h1>
                  <p>这一周反复出现的主题</p>
                </div>
                <span>{weeklyTags.reduce((sum, item) => sum + item.count, 0)} 次</span>
              </header>
              <div className="weekly-tags-row">
                {weeklyTags.map((item) => (
                  <button
                    key={item.tag}
                    type="button"
                    className="weekly-tag"
                    onClick={() => navigate(`/search?q=${encodeURIComponent(item.tag)}`)}
                    aria-label={`查看标签 ${item.tag}，最近 7 天使用 ${item.count} 次`}
                  >
                    <b>#{item.tag}</b>
                    <i>{item.count}</i>
                  </button>
                ))}
              </div>
            </section>
          )}

          {remainingTags.length > 0 && (
            <section className="tag-archive" aria-labelledby="tag-archive-title">
              <header className="tags-section-head archive-head">
                <div>
                  <h2 id="tag-archive-title">其余标签</h2>
                  <p>按历史使用次数排列</p>
                </div>
                <span>{remainingTags.length} 个</span>
              </header>
              <div className="pill-cloud">
                {remainingTags.map((t, i) => (
                  <button
                    key={t.tag}
                    type="button"
                    className={`tag-pill ${sizeClass(t.count)} ${i === 0 && t.count > 1 ? 'dark' : ''} ${t.count === 1 ? 'dim' : ''}`}
                    onClick={() => navigate(`/search?q=${encodeURIComponent(t.tag)}`)}
                  >
                    <b>{t.tag}</b>
                    <i>{t.count}</i>
                  </button>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
