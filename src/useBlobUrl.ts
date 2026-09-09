import { useEffect, useState } from 'react';
import { getBlob } from './db';
import type { MediaRef } from './types';

// 取一个媒体文件的可显示 URL，本地缓存优先：
//  1) 有云端 URL 时立即交给浏览器显示，避免先等 IndexedDB 查询
//  2) 本地 IndexedDB 命中后切换为本地 URL（新选择的图片因此可以立即预览）
//  3) 远端文件交给 Service Worker / HTTP 缓存，不再额外 fetch 一遍，避免首屏重复下载
// variant='thumb'：列表用缩略图（没有缩略图的旧图回退原图）；'full'：看大图/下载用原图。
export function useMediaUrl(ref?: MediaRef, variant: 'thumb' | 'full' = 'full'): string | undefined {
  const refId = ref?.id;
  const wantThumb = variant === 'thumb';
  const remoteUrl = wantThumb ? ref?.thumbUrl ?? ref?.url : ref?.url;
  const cacheKey = wantThumb
    ? ref?.thumbPath ?? ref?.path ?? refId
    : ref?.path || refId;
  const [url, setUrl] = useState<string | undefined>(remoteUrl);

  useEffect(() => {
    if (!refId) {
      setUrl(undefined);
      return;
    }
    let revoked = false;
    let objectUrl: string | undefined;
    setUrl(remoteUrl);

    (async () => {
      // 云端 URL 已经先显示；本地命中后再无闪烁地切成 object URL。
      if (cacheKey) {
        const cached = await getBlob(cacheKey).catch(() => undefined);
        if (cached) {
          if (revoked) return;
          objectUrl = URL.createObjectURL(cached);
          setUrl(objectUrl);
          return;
        }
      }
      // 兼容没有 path 的旧本地文件。
      if (!remoteUrl && refId !== cacheKey) {
        const b = await getBlob(refId).catch(() => undefined);
        if (b && !revoked) {
          objectUrl = URL.createObjectURL(b);
          setUrl(objectUrl);
        }
      }
    })();

    return () => {
      revoked = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [cacheKey, remoteUrl, refId]);

  return url;
}
