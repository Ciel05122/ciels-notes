import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { MediaRef } from '../types';
import { useMediaUrl } from '../useBlobUrl';

// 单张缩略图（列表里用小图，省内存省流量）
function Thumb({ img, onClick, overlay, index }: { img: MediaRef; onClick?: () => void; overlay?: string; index: number }) {
  const url = useMediaUrl(img, 'thumb');
  return (
    <button
      className={`img-thumb ${url ? 'is-ready' : 'is-loading'}`}
      onClick={onClick}
      type="button"
      aria-label={`查看第 ${index + 1} 张图片`}
      aria-busy={!url}
    >
      {url && <img src={url} alt={`记录图片 ${index + 1}`} width={img.w} height={img.h} loading="lazy" decoding="async" />}
      {overlay && <span className="img-overlay">{overlay}</span>}
    </button>
  );
}

// 九宫格：1 张单图 / 2-4 田字格 / 5-9 九宫格 / 超 9 张末格盖 +N
export function ImageGrid({ images, onOpen, compact = false }: { images: MediaRef[]; onOpen?: (index: number) => void; compact?: boolean }) {
  if (images.length === 0) return null;

  // 单图：竖图更大、横图自适应
  if (images.length === 1) {
    const img = images[0];
    const tall = img.w && img.h ? img.h > img.w : false;
    return (
      <div className={`img-grid single ${tall ? 'tall' : 'wide'} ${compact ? 'compact' : ''}`}>
        <Thumb img={img} index={0} onClick={() => onOpen?.(0)} />
      </div>
    );
  }

  const cols = images.length <= 4 ? 2 : 3;
  const shown = images.slice(0, 9);
  const extra = images.length - 9;

  return (
    <div className={`img-grid multi ${compact ? 'compact' : ''}`} style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
      {shown.map((img, i) => (
        <Thumb
          key={img.id}
          img={img}
          index={i}
          onClick={() => onOpen?.(i)}
          overlay={i === 8 && extra > 0 ? `+${extra}` : undefined}
        />
      ))}
    </div>
  );
}

// 全屏看图
export function Lightbox({
  images,
  index,
  onClose,
}: {
  images: MediaRef[];
  index: number;
  onClose: () => void;
}) {
  const [i, setI] = useState(index);
  const [fullReady, setFullReady] = useState(false);
  const previewUrl = useMediaUrl(images[i], 'thumb');
  const url = useMediaUrl(images[i], 'full'); // 看大图才加载原图

  useEffect(() => setFullReady(false), [i, url]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowLeft' && images.length > 1) {
        setI((value) => (value - 1 + images.length) % images.length);
      }
      if (event.key === 'ArrowRight' && images.length > 1) {
        setI((value) => (value + 1) % images.length);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [images.length, onClose]);

  useEffect(() => {
    if (images.length < 2) return;
    const adjacent = [
      images[(i - 1 + images.length) % images.length],
      images[(i + 1) % images.length],
    ];
    for (const image of adjacent) {
      if (!image.url) continue;
      const preload = new Image();
      preload.decoding = 'async';
      preload.src = image.url;
    }
  }, [i, images]);

  // Portal 到 body：玻璃卡的 backdrop-filter 会把 fixed 定位困在卡片里，必须逃出去
  return createPortal(
    <div className="lightbox" onClick={onClose} role="dialog" aria-modal="true" aria-label="图片查看器">
      <button type="button" className="lightbox-close" onClick={onClose} aria-label="关闭">✕</button>
      <div className="lightbox-count">{i + 1} / {images.length}</div>
      <div className="lightbox-stage" onClick={(event) => event.stopPropagation()}>
        {previewUrl && !fullReady && (
          <img className="lightbox-preview" src={previewUrl} alt="" aria-hidden="true" />
        )}
        {url && (
          <img
            className={`lightbox-full ${fullReady ? 'is-ready' : ''}`}
            src={url}
            alt={`记录图片 ${i + 1}`}
            decoding="async"
            onLoad={() => setFullReady(true)}
          />
        )}
        {!url && <span className="lightbox-loading" role="status">正在读取图片</span>}
      </div>
      {images.length > 1 && (
        <div className="lightbox-nav" onClick={(e) => e.stopPropagation()}>
          <button type="button" aria-label="上一张" onClick={() => setI((v) => (v - 1 + images.length) % images.length)}>‹</button>
          <button type="button" aria-label="下一张" onClick={() => setI((v) => (v + 1) % images.length)}>›</button>
        </div>
      )}
    </div>,
    document.body,
  );
}
