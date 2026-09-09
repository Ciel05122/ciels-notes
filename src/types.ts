// ——— 数据模型 ———
// 文字类信息存 localStorage；图片/附件这种大文件存 IndexedDB，
// Note 里只保留它们的「引用」(MediaRef)。

export type NoteType = 'personal' | 'professional';

// 一个媒体文件（图片或附件）的元信息。真正的二进制存在 IndexedDB 里，靠 id 取。
export interface MediaRef {
  id: string; // 本地 IndexedDB 的 key（旧数据用）
  name: string; // 原始文件名（附件卡片显示用）
  mime: string; // image/jpeg, application/pdf ...
  size: number; // 字节
  w?: number; // 图片宽（压缩后），用于排版判断竖图/横图
  h?: number; // 图片高
  path?: string; // 云端存储路径 userId/xxx（接云端后）
  url?: string; // 云端公开访问 URL（接云端后，直接给 <img src>）
  thumbPath?: string; // 缩略图云端路径（列表用小图，省内存省流量）
  thumbUrl?: string; // 缩略图 URL；旧图没有时回退用原图
}

// 一条备注/评论（回顾时补充的想法），记它自己写下的时间
export interface Comment {
  id: string;
  text: string;
  createdAt: number;
}

// 计时信息：这条记录是由计时器产生的（任务名 + 实际时长秒数）
export interface TimerInfo {
  task: string;
  seconds: number;
}

export interface Note {
  id: string;
  text: string;
  createdAt: number; // 毫秒时间戳，时间线核心
  updatedAt: number;
  comments?: Comment[]; // 备注列表
  timer?: TimerInfo; // 计时器产生的记录

  type?: NoteType; // 类型：个人 / 专业（可不选）
  isGoal?: boolean; // 设为目标 → 显示绿色「目标」标签
  goalDone?: boolean; // 目标是否完成（目标 tab 里勾选）
  pinned?: boolean; // 置顶

  tags: string[]; // 自由标签，可多个
  location?: string; // 地点，独立于标签

  images: MediaRef[]; // 已压缩的图片
  files: MediaRef[]; // 附件（PDF / Word）
}

// 写入页正在编辑的草稿（自动保存）。图片/附件已先入库，这里只存引用。
export interface Draft {
  text: string;
  type?: NoteType;
  isGoal?: boolean;
  pinned?: boolean;
  tags: string[];
  location?: string;
  images: MediaRef[];
  files: MediaRef[];
}

export function emptyDraft(): Draft {
  return { text: '', tags: [], images: [], files: [] };
}

export function newId(prefix = ''): string {
  return `${prefix}${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function newComment(text: string): Comment {
  return { id: newId('c-'), text: text.trim(), createdAt: Date.now() };
}

// 把一条已有记录载回写入页（编辑用）
export function noteToDraft(n: Note): Draft {
  return {
    text: n.text,
    type: n.type,
    isGoal: n.isGoal,
    pinned: n.pinned,
    tags: [...n.tags],
    location: n.location,
    images: [...n.images],
    files: [...n.files],
  };
}

// 把草稿落成一条正式记录
export function draftToNote(d: Draft): Note {
  const now = Date.now();
  return {
    id: newId('n-'),
    text: d.text.trim(),
    createdAt: now,
    updatedAt: now,
    type: d.type,
    isGoal: d.isGoal,
    pinned: d.pinned,
    tags: d.tags,
    location: d.location?.trim() || undefined,
    images: d.images,
    files: d.files,
  };
}
