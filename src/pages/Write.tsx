import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store';
import {
  draftToNote, emptyDraft, noteToDraft,
  type Draft, type MediaRef, type NoteType,
} from '../types';
import { loadDraft, saveDraft, clearDraft } from '../storage';
import {
  prepareImageForUpload,
  uploadPreparedImage,
  storeFile,
  removeMedia,
  FILE_MAX_MB,
} from '../media';
import { useMediaUrl } from '../useBlobUrl';
import { Lightbox } from '../components/ImageGrid';
import { LocationPicker } from '../components/LocationPicker';
import { toDatetimeLocal, fromDatetimeLocal } from '../date';

const MAX_IMAGES = 9;
type ImageUploadState = 'uploading' | 'failed';

export function Write() {
  const navigate = useNavigate();
  const { id: editId } = useParams();
  const { notes, addNote, updateNote, tags } = useStore();

  const existing = useMemo(
    () => (editId ? notes.find((n) => n.id === editId) : undefined),
    [editId, notes],
  );
  const editing = !!editId;

  const [draft, setDraft] = useState<Draft>(() =>
    existing ? noteToDraft(existing) : loadDraft() ?? emptyDraft(),
  );
  // 这条记录的「时间」（可改，用于补录过往）。新建默认现在。
  const [when, setWhen] = useState<number>(() => existing?.createdAt ?? Date.now());
  const [tagInput, setTagInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickingLoc, setPickingLoc] = useState(false);
  const [viewer, setViewer] = useState<number | null>(null);
  const [imageUploads, setImageUploads] = useState<Record<string, ImageUploadState>>(() =>
    Object.fromEntries(
      draft.images
        .filter((image) => image.path && !image.url)
        .map((image) => [image.id, 'failed' as const]),
    ),
  );

  const textRef = useRef<HTMLTextAreaElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nowMax = useRef(toDatetimeLocal(Date.now()));

  useEffect(() => {
    textRef.current?.focus();
  }, []);

  // 自动保存草稿（只对「新建」生效，编辑不动新建草稿）
  useEffect(() => {
    if (!editing) saveDraft(draft);
  }, [draft, editing]);

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  function toggleType(t: NoteType) {
    patch({ type: draft.type === t ? undefined : t });
  }

  async function onPickImages(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      const room = MAX_IMAGES - draft.images.length;
      const activeUploads = new Set<Promise<void>>();
      const allUploads: Promise<void>[] = [];

      for (const f of files.slice(0, room)) {
        if (!f.type.startsWith('image/')) continue;
        try {
          const prepared = await prepareImageForUpload(f);
          const id = prepared.ref.id;

          // 本地压缩完成就先显示，不等待网络上传。
          setDraft((d) => ({ ...d, images: [...d.images, prepared.ref] }));
          setImageUploads((prev) => ({ ...prev, [id]: 'uploading' }));

          const upload = (async () => {
            try {
              const uploaded = await uploadPreparedImage(prepared);
              setDraft((d) => ({
                ...d,
                images: d.images.map((image) => (image.id === id ? uploaded : image)),
              }));
              setImageUploads((prev) => {
                const next = { ...prev };
                delete next[id];
                return next;
              });
            } catch {
              setImageUploads((prev) => ({ ...prev, [id]: 'failed' }));
            }
          })();

          activeUploads.add(upload);
          allUploads.push(upload);
          void upload.finally(() => activeUploads.delete(upload));

          // 手机上同时只跑两条上传，避免多图抢带宽、占满内存。
          if (activeUploads.size >= 2) await Promise.race(activeUploads);
        } catch {
          // 浏览器解不开的格式（如 HEIC）：跳过这一张，不拖垮整批。
          alert(`「${f.name}」无法处理，可能是图片格式不受支持`);
        }
      }
      await Promise.all(allUploads);
    } finally {
      setBusy(false);
    }
  }

  async function retryImageUpload(ref: MediaRef) {
    if (!ref.path || busy) return;
    setBusy(true);
    setImageUploads((prev) => ({ ...prev, [ref.id]: 'uploading' }));
    try {
      const uploaded = await uploadPreparedImage(ref);
      setDraft((d) => ({
        ...d,
        images: d.images.map((image) => (image.id === ref.id ? uploaded : image)),
      }));
      setImageUploads((prev) => {
        const next = { ...prev };
        delete next[ref.id];
        return next;
      });
    } catch {
      setImageUploads((prev) => ({ ...prev, [ref.id]: 'failed' }));
    } finally {
      setBusy(false);
    }
  }

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      const refs: MediaRef[] = [];
      for (const f of files) {
        try {
          const ref = await storeFile(f);
          if (ref) refs.push(ref);
          else alert(`「${f.name}」不支持或超过 ${FILE_MAX_MB}MB（仅支持 PDF / Word）`);
        } catch {
          alert(`「${f.name}」上传失败，已跳过`);
        }
      }
      if (refs.length) setDraft((d) => ({ ...d, files: [...d.files, ...refs] }));
    } finally {
      setBusy(false);
    }
  }

  // 编辑时：移除只从草稿里拿掉，blob 等保存时再清（避免点了取消却把原图删了）
  async function removeImage(ref: MediaRef) {
    if (!editing) await removeMedia(ref);
    setDraft((d) => ({ ...d, images: d.images.filter((x) => x.id !== ref.id) }));
    setImageUploads((prev) => {
      const next = { ...prev };
      delete next[ref.id];
      return next;
    });
  }
  async function removeFile(ref: MediaRef) {
    if (!editing) await removeMedia(ref);
    setDraft((d) => ({ ...d, files: d.files.filter((x) => x.id !== ref.id) }));
  }

  function addTag(tag: string) {
    const t = tag.trim();
    if (!t || draft.tags.includes(t)) {
      setTagInput('');
      return;
    }
    patch({ tags: [...draft.tags, t] });
    setTagInput('');
  }
  function removeTag(t: string) {
    patch({ tags: draft.tags.filter((x) => x !== t) });
  }

  const suggestions = tagInput.trim()
    ? tags.filter((s) => s.tag.includes(tagInput.trim()) && !draft.tags.includes(s.tag)).slice(0, 6)
    : [];

  const canSave = !!(draft.text.trim() || draft.images.length || draft.files.length);
  const failedImageCount = Object.values(imageUploads).filter((state) => state === 'failed').length;
  const hasPendingImages = draft.images.some((image) => image.path && !image.url);
  const canSubmit = canSave && !busy && !hasPendingImages;

  async function onSave() {
    if (!canSubmit) return;
    if (editing && existing) {
      // 清掉这次编辑里被删掉的旧图片/附件
      const kept = new Set([...draft.images, ...draft.files].map((m) => m.id));
      for (const m of [...existing.images, ...existing.files]) {
        if (!kept.has(m.id)) await removeMedia(m);
      }
      updateNote(existing.id, {
        text: draft.text.trim(),
        type: draft.type,
        isGoal: draft.isGoal,
        pinned: draft.pinned,
        tags: draft.tags,
        location: draft.location?.trim() || undefined,
        images: draft.images,
        files: draft.files,
        createdAt: when,
      });
    } else {
      const note = draftToNote(draft);
      note.createdAt = when;
      addNote(note);
      clearDraft();
    }
    navigate(-1);
  }

  function onCancel() {
    navigate(-1); // 新建会留草稿；编辑直接退出，不动原记录
  }

  return (
    <div className="page write-page">
      <header className="write-bar">
        <button className="text-btn" type="button" onClick={onCancel}>取消</button>
        <span className="write-autosave" aria-live="polite">
          {failedImageCount > 0
            ? `${failedImageCount} 张图片待重试`
            : busy
              ? '图片处理中…'
              : editing ? '编辑记录' : '自动保存草稿'}
        </span>
        <button className="primary-btn" type="button" disabled={!canSubmit} onClick={onSave}>
          {editing ? '保存' : '记录'}
        </button>
      </header>

      <textarea
        ref={textRef}
        className="write-text"
        placeholder="此刻在想什么…"
        value={draft.text}
        onChange={(e) => patch({ text: e.target.value })}
      />

      {draft.images.length > 0 && (
        <>
          <div className="write-img-grid">
            {draft.images.map((img, index) => (
              <WriteThumb
                key={img.id}
                img={img}
                state={imageUploads[img.id]}
                onOpen={() => setViewer(index)}
                onRetry={() => retryImageUpload(img)}
                onRemove={() => removeImage(img)}
              />
            ))}
          </div>
          {failedImageCount > 0 && (
            <p className="write-media-notice" role="status">
              图片已经保存在这台设备，点“重试”上传成功后才能保存记录。
            </p>
          )}
        </>
      )}

      {draft.files.length > 0 && (
        <div className="write-file-list">
          {draft.files.map((f) => (
            <div key={f.id} className="write-file">
              <span>📄 {f.name}</span>
              <button type="button" className="x-btn" onClick={() => removeFile(f)}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* 底部编辑面板 */}
      <div className="write-panel">
        <div className="panel-row insert-row">
          <button type="button" className="insert-btn" disabled={busy || draft.images.length >= MAX_IMAGES} onClick={() => imgInput.current?.click()}>＋ 图片</button>
          <button type="button" className="insert-btn" disabled={busy} onClick={() => fileInput.current?.click()}>＋ 附件</button>
          <input ref={imgInput} type="file" accept="image/*" multiple hidden onChange={onPickImages} />
          <input ref={fileInput} type="file" accept=".pdf,.doc,.docx" multiple hidden onChange={onPickFiles} />
        </div>

        {/* 标记：目标 / 置顶 */}
        <div className="panel-row">
          <span className="panel-label">标记</span>
          <button type="button" className={`pick ${draft.isGoal ? 'on goal' : ''}`} onClick={() => patch({ isGoal: !draft.isGoal })}>目标</button>
          <button type="button" className={`pick ${draft.pinned ? 'on pin' : ''}`} onClick={() => patch({ pinned: !draft.pinned })}>置顶</button>
          <span className="panel-optional">可不选</span>
        </div>

        {/* 标签：个人/专业彩色快捷标签 + 自由标签 */}
        <div className="panel-row tag-row">
          <span className="panel-label">标签</span>
          <div className="tag-field">
            <div className="quick-tags">
              <button type="button" className={`pick sm ${draft.type === 'personal' ? 'on personal' : ''}`} onClick={() => toggleType('personal')}>个人</button>
              <button type="button" className={`pick sm ${draft.type === 'professional' ? 'on professional' : ''}`} onClick={() => toggleType('professional')}>专业</button>
            </div>
            <div className="tag-chips">
              {draft.tags.map((t) => (
                <span key={t} className="tag-chip">
                  {t}<button type="button" onClick={() => removeTag(t)}>×</button>
                </span>
              ))}
              <input
                className="tag-input"
                placeholder={draft.tags.length ? '' : '输入标签，如：影评'}
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); addTag(tagInput); }
                  if (e.key === 'Backspace' && !tagInput && draft.tags.length) {
                    removeTag(draft.tags[draft.tags.length - 1]);
                  }
                }}
              />
              {tagInput.trim() && (
                <button type="button" className="tag-add-btn" onClick={() => addTag(tagInput)} aria-label="添加标签">✓</button>
              )}
            </div>
            {suggestions.length > 0 && (
              <div className="tag-suggest">
                {suggestions.map((s) => (
                  <button key={s.tag} type="button" className="suggest-item" onClick={() => addTag(s.tag)}>
                    <span>{s.tag}</span>
                    <span className="suggest-count">用过 {s.count} 次</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 时间：默认现在，可改成过去（补录以前的记录） */}
        <div className="panel-row">
          <span className="panel-label">时间</span>
          <input
            className="panel-input when-input"
            type="datetime-local"
            value={toDatetimeLocal(when)}
            max={nowMax.current}
            onChange={(e) => e.target.value && setWhen(fromDatetimeLocal(e.target.value))}
          />
        </div>

        {/* 地点：选点面板（附近列表+搜索），也可手动输入 */}
        <div className="panel-row">
          <span className="panel-label">地点</span>
          <input
            className="panel-input"
            placeholder="可不填"
            value={draft.location ?? ''}
            onChange={(e) => patch({ location: e.target.value })}
          />
          <button type="button" className="locate-btn" onClick={() => setPickingLoc(true)}>
            📍 选地点
          </button>
        </div>
      </div>

      {pickingLoc && (
        <LocationPicker
          onClose={() => setPickingLoc(false)}
          onPick={(v) => patch({ location: v || undefined })}
        />
      )}

      {viewer !== null && draft.images[viewer] && (
        <Lightbox
          images={draft.images}
          index={viewer}
          onClose={() => setViewer(null)}
        />
      )}
    </div>
  );
}

function WriteThumb({
  img,
  state,
  onOpen,
  onRetry,
  onRemove,
}: {
  img: MediaRef;
  state?: ImageUploadState;
  onOpen: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const url = useMediaUrl(img, 'thumb');
  return (
    <div className={`write-thumb ${state ? `is-${state}` : ''}`} aria-busy={state === 'uploading'}>
      <button
        type="button"
        className="write-thumb-open"
        onClick={onOpen}
        aria-label={`放大查看图片 ${img.name}`}
      >
        {url && <img src={url} alt="" width={img.w} height={img.h} decoding="async" />}
      </button>
      {state && (
        <div className="write-thumb-state">
          {state === 'uploading' ? (
            <span>上传中</span>
          ) : (
            <button type="button" onClick={onRetry}>重试</button>
          )}
        </div>
      )}
      <button type="button" className="x-btn" disabled={state === 'uploading'} onClick={onRemove} aria-label={`移除图片 ${img.name}`}>×</button>
    </div>
  );
}
