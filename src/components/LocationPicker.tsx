import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { getPosition, nearbyPlaces, searchPlaces, formatDistance, type Place } from '../amap';

// 朋友圈式选地点：定位 → 附近地点列表；顶部可关键字搜索；也可选「不显示位置」。
export function LocationPicker({ onPick, onClose }: { onPick: (v: string) => void; onClose: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'noloc'>('loading');
  const [coarse, setCoarse] = useState('');
  const [city, setCity] = useState('');
  const [pois, setPois] = useState<Place[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Place[] | null>(null);
  const [searching, setSearching] = useState(false);

  // 打开即定位 + 拉附近地点
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const pos = await getPosition();
        const r = await nearbyPlaces(pos.lat, pos.lng);
        if (dead) return;
        setCoarse(r.coarse);
        setCity(r.city);
        setPois(r.places);
        setPhase('ready');
      } catch {
        if (!dead) setPhase('noloc');
      }
    })();
    return () => { dead = true; };
  }, []);

  // 关键字搜索（防抖 400ms；有城市则限定本市）
  useEffect(() => {
    const kw = q.trim();
    if (!kw) {
      setResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setResults(await searchPlaces(kw, city || undefined));
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(t);
  }, [q, city]);

  function pick(v: string) {
    onPick(v);
    onClose();
  }

  const list = results ?? pois;

  return createPortal(
    <div className="sheet-mask" onClick={onClose}>
      <div className="loc-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="loc-head">
          <span className="eyebrow">所在位置</span>
          <button type="button" className="text-btn" onClick={onClose}>关闭</button>
        </div>
        <input
          className="loc-search"
          placeholder="搜索地点，如：星巴克"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="loc-list">
          <button type="button" className="loc-item" onClick={() => pick('')}>
            <b>不显示位置</b>
          </button>
          {!results && coarse && (
            <button type="button" className="loc-item" onClick={() => pick(coarse)}>
              <b>{coarse}</b>
              <small>只显示大致区域</small>
            </button>
          )}
          {phase === 'loading' && !results && <div className="loc-tip">正在定位…</div>}
          {phase === 'noloc' && !results && (
            <div className="loc-tip">定位不可用（可能未授权）。可以直接在上面搜索地点。</div>
          )}
          {searching && <div className="loc-tip">搜索中…</div>}
          {list.map((p, i) => (
            <button type="button" key={`${p.name}-${i}`} className="loc-item" onClick={() => pick(p.name)}>
              <b>{p.name}</b>
              <small>
                {p.distance != null ? `${formatDistance(p.distance)} · ` : ''}
                {p.address ?? ''}
              </small>
            </button>
          ))}
          {results && results.length === 0 && !searching && (
            <div className="loc-tip">没搜到「{q.trim()}」</div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
