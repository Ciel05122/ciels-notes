import type { MediaRef } from '../types';
import { useMediaUrl } from '../useBlobUrl';

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function icon(mime: string): string {
  if (mime.includes('pdf')) return '📄';
  if (mime.includes('word') || mime.includes('msword')) return '📝';
  return '📎';
}

// 附件卡片：点一下用浏览器打开/下载
export function AttachmentChip({ file }: { file: MediaRef }) {
  const url = useMediaUrl(file);
  return (
    <a
      className="attach-chip"
      href={url}
      target="_blank"
      rel="noreferrer"
      download={file.name}
    >
      <span className="attach-icon">{icon(file.mime)}</span>
      <span className="attach-name">{file.name}</span>
      <span className="attach-size">{fmtSize(file.size)}</span>
    </a>
  );
}
