import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

function requireLocalAppData() {
  const root = process.env.LOCALAPPDATA;
  if (!root) throw new Error('未找到 Windows LOCALAPPDATA，无法安全保存本机会话。');
  return root;
}

export const ANALYSIS_DATA_DIR = path.join(requireLocalAppData(), 'CielsNotes', 'analysis');
export const SESSION_PATH = path.join(ANALYSIS_DATA_DIR, 'supabase-session.json');
export const STATE_PATH = path.join(ANALYSIS_DATA_DIR, 'analysis-state.json');

function userDataPath(userId, fileName) {
  const safeUserId = String(userId ?? '');
  if (!/^[a-zA-Z0-9-]{1,128}$/.test(safeUserId)) {
    throw new Error('用户 ID 格式无效，未读写本地标签知识库。');
  }
  return path.join(ANALYSIS_DATA_DIR, 'users', safeUserId, fileName);
}

async function readJson(filePath, { optional = false } = {}) {
  try {
    return JSON.parse(await readFile(filePath, 'utf8'));
  } catch (error) {
    if (optional && error?.code === 'ENOENT') return undefined;
    throw error;
  }
}

function restrictWindowsAcl(filePath) {
  if (process.platform !== 'win32') return;

  const identity = execFileSync('whoami.exe', [], { encoding: 'utf8', windowsHide: true }).trim();
  if (!identity) throw new Error('无法确认当前 Windows 用户，未保存敏感会话。');

  execFileSync(
    'icacls.exe',
    [
      filePath,
      '/inheritance:r',
      '/grant:r',
      `${identity}:(F)`,
      '*S-1-5-18:(F)',
      '*S-1-5-32-544:(F)',
    ],
    { stdio: 'ignore', windowsHide: true },
  );
}

async function writePrivateJson(filePath, value) {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  restrictWindowsAcl(temporaryPath);
  await rename(temporaryPath, filePath);
  restrictWindowsAcl(filePath);
}

export function loadSession() {
  return readJson(SESSION_PATH, { optional: true });
}

export function saveSession(session) {
  return writePrivateJson(SESSION_PATH, session);
}

export function loadState() {
  return readJson(STATE_PATH, { optional: true });
}

export function saveState(state) {
  return writePrivateJson(STATE_PATH, state);
}

export function loadTagAliases(userId) {
  return readJson(userDataPath(userId, 'tag-aliases.json'), { optional: true });
}

export function saveTagAliases(userId, aliases) {
  return writePrivateJson(userDataPath(userId, 'tag-aliases.json'), aliases);
}

export function loadTagHistoryIndex(userId) {
  return readJson(userDataPath(userId, 'tag-history-index.json'), { optional: true });
}

export function saveTagHistoryIndex(userId, index) {
  return writePrivateJson(userDataPath(userId, 'tag-history-index.json'), index);
}

export async function disconnect() {
  await rm(SESSION_PATH, { force: true });
}
