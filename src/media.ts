import { supabase, MEDIA_BUCKET } from './supabase';
import { getBlob, putBlob, deleteBlob } from './db';
import { newId, type MediaRef } from './types';

// 图片压缩参数：
// - 照片（JPEG/HEIC 源）→ 长边 2000px + JPEG 0.85，清晰度和体积平衡
// - 截图（PNG 源）→ 保持无损 PNG（JPEG 会让文字边缘出噪点、显得糊）；
//   过大的截图退回高质量 JPEG，防止撑爆存储
const MAX_EDGE = 2000;
const JPEG_QUALITY = 0.85;
const PNG_MAX_BYTES = 2.5 * 1024 * 1024;
const THUMB_EDGE = 800; // 列表缩略图长边

// 附件限制
const FILE_MAX_BYTES = 10 * 1024 * 1024; // 10MB
export const FILE_MAX_MB = FILE_MAX_BYTES / 1024 / 1024;

export interface PreparedImage {
  ref: MediaRef;
  blob: Blob;
  thumbnailBlob?: Blob;
}

function isPreparedImage(value: PreparedImage | MediaRef): value is PreparedImage {
  return 'ref' in value && 'blob' in value;
}

async function currentUserId(): Promise<string> {
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session?.user.id) return sessionData.session.user.id;
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error('未登录');
  return data.user.id;
}

// 传一个 blob 到指定云端路径，返回公开 URL
async function uploadAt(path: string, blob: Blob): Promise<string> {
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, blob, { contentType: blob.type, upsert: true });
  if (error) throw error;
  return supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}

// 把一个 blob 传到云端存储，返回带 url 的 MediaRef
async function uploadBlob(
  blob: Blob,
  name: string,
  prefix: string,
  extra: Partial<MediaRef> = {},
): Promise<MediaRef> {
  const uid = await currentUserId();
  const id = newId(prefix);
  const path = `${uid}/${id}`;
  const url = await uploadAt(path, blob);
  return { id, name, mime: blob.type, size: blob.size, path, url, ...extra };
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('图片压缩失败'))), type, quality),
  );
}

// 先压缩并写进 IndexedDB。此时写入页已经可以显示本地预览，不必等待网络上传。
export async function prepareImageForUpload(file: File): Promise<PreparedImage> {
  const uid = await currentUserId();
  const id = newId('img-');
  const path = `${uid}/${id}`;
  const bitmap = await createImageBitmap(file);
  const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_EDGE);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const isScreenshot = file.type === 'image/png';
  let blob: Blob;
  if (isScreenshot) {
    blob = await canvasToBlob(canvas, 'image/png');
    if (blob.size > PNG_MAX_BYTES) {
      // JPEG 没有透明通道：先在透明区域垫白底，否则会变成黑块
      const ctx = canvas.getContext('2d')!;
      ctx.globalCompositeOperation = 'destination-over';
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      blob = await canvasToBlob(canvas, 'image/jpeg', 0.92);
    }
  } else {
    blob = await canvasToBlob(canvas, 'image/jpeg', JPEG_QUALITY);
  }

  let thumbnailBlob: Blob | undefined;
  let thumbPath: string | undefined;
  try {
    const t = fitWithin(width, height, THUMB_EDGE);
    if (t.width < width) {
      const tc = document.createElement('canvas');
      tc.width = t.width;
      tc.height = t.height;
      tc.getContext('2d')!.drawImage(canvas, 0, 0, t.width, t.height);
      thumbnailBlob = await canvasToBlob(tc, 'image/jpeg', 0.72);
      thumbPath = `${path}-thumb`;
    }
  } catch {
    /* 没有缩略图就回退用原图 */
  }

  const ref: MediaRef = {
    id,
    name: file.name,
    mime: blob.type,
    size: blob.size,
    w: width,
    h: height,
    path,
    thumbPath,
  };

  const cacheWrites = [putBlob(path, blob)];
  if (thumbPath && thumbnailBlob) cacheWrites.push(putBlob(thumbPath, thumbnailBlob));
  await Promise.all(cacheWrites);

  return { ref, blob, thumbnailBlob };
}

// 上传已经准备好的图片。原图和缩略图并行上传，缩略图失败时仍保留可用的原图。
export async function uploadPreparedImage(input: PreparedImage | MediaRef): Promise<MediaRef> {
  const prepared = isPreparedImage(input) ? input : undefined;
  const ref: MediaRef = prepared ? prepared.ref : input as MediaRef;
  if (!ref.path) throw new Error('图片缺少云端路径');

  const blob = prepared?.blob
    ?? await getBlob(ref.path).catch(() => undefined)
    ?? await getBlob(ref.id).catch(() => undefined);
  if (!blob) throw new Error('找不到待上传的本地图片');

  const thumbnailBlob = prepared?.thumbnailBlob
    ?? (ref.thumbPath ? await getBlob(ref.thumbPath).catch(() => undefined) : undefined);

  const fullUpload = uploadAt(ref.path, blob);
  const thumbnailUpload = ref.thumbPath && thumbnailBlob
    ? uploadAt(ref.thumbPath, thumbnailBlob).catch(() => undefined)
    : Promise.resolve(undefined);
  const [url, thumbUrl] = await Promise.all([fullUpload, thumbnailUpload]);

  return { ...ref, url, thumbUrl };
}

// 兼容旧调用：完整执行“本地准备 → 云端上传”。
export async function compressAndStoreImage(file: File): Promise<MediaRef> {
  const prepared = await prepareImageForUpload(file);
  return uploadPreparedImage(prepared);
}

// 上传附件（PDF / Word）。返回 null 表示类型不支持或太大。
export async function storeFile(file: File): Promise<MediaRef | null> {
  const okType = /\.(pdf|docx?)$/i.test(file.name) || /pdf|word|msword/i.test(file.type);
  if (!okType || file.size > FILE_MAX_BYTES) return null;
  return uploadBlob(file, file.name, 'file-');
}

// 删除云端文件（含缩略图）+ 本地 IndexedDB 缓存
export async function removeMedia(ref: MediaRef): Promise<void> {
  const paths = [ref.path, ref.thumbPath].filter(Boolean) as string[];
  if (paths.length) {
    await supabase.storage.from(MEDIA_BUCKET).remove(paths).catch(() => {});
    for (const p of paths) await deleteBlob(p).catch(() => {});
  }
  if (ref.id) {
    await deleteBlob(ref.id).catch(() => {});
  }
}

// 把一条「只在本地 IndexedDB」的旧媒体迁移到云端；已在云端的原样返回
export async function migrateMediaRef(ref: MediaRef): Promise<MediaRef> {
  if (ref.url) return ref; // 已在云端
  if (ref.path) {
    try {
      return await uploadPreparedImage(ref);
    } catch {
      return ref;
    }
  }
  const blob = await getBlob(ref.id).catch(() => undefined);
  if (!blob) return ref; // 找不到本地文件，只能放弃
  try {
    const prefix = ref.mime.startsWith('image/') ? 'img-' : 'file-';
    return await uploadBlob(blob, ref.name, prefix, { w: ref.w, h: ref.h });
  } catch {
    return ref;
  }
}

function fitWithin(w: number, h: number, maxEdge: number) {
  const longest = Math.max(w, h);
  if (longest <= maxEdge) return { width: w, height: h };
  const scale = maxEdge / longest;
  return { width: Math.round(w * scale), height: Math.round(h * scale) };
}
