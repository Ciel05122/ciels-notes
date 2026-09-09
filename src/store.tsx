import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import type { Note } from './types';
import { loadNotes, saveNotes, tagStats, type TagStat } from './storage';
import { seedNotes } from './seed';
import { supabase } from './supabase';
import { cloudFetchNotes, cloudUpsertNote, cloudDeleteNote } from './cloudNotes';
import { removeMedia, migrateMediaRef } from './media';

const SEEDED_KEY = 'kb.seeded.v1';

interface Store {
  notes: Note[];
  tags: TagStat[];
  user: User | null;
  authReady: boolean;
  syncing: boolean;
  addNote: (note: Note) => void;
  updateNote: (id: string, patch: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<Store | null>(null);
const isSeed = (n: Note) => n.id.startsWith('seed-');

// 合并本地与云端：按 id 去重，冲突取 updatedAt 更新的一方
function merge(local: Note[], cloud: Note[]): Note[] {
  const map = new Map<string, Note>();
  for (const n of cloud) map.set(n.id, n);
  for (const n of local) {
    const c = map.get(n.id);
    if (!c || n.updatedAt > c.updatedAt) map.set(n.id, n);
  }
  return Array.from(map.values()).sort((a, b) => b.createdAt - a.createdAt);
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const userRef = useRef<User | null>(null);
  userRef.current = user;

  // 登录后：拉云端 → 与本地合并 → 把本地独有/更新的推上云（顺带把本地图片迁移到云）
  const sync = useCallback(async (userId: string) => {
    setSyncing(true);
    try {
      const cloud = await cloudFetchNotes();
      const cloudMap = new Map(cloud.map((n) => [n.id, n]));
      const local = loadNotes().filter((n) => !isSeed(n)); // 登录后丢掉示例数据
      const merged = merge(local, cloud);

      for (let i = 0; i < merged.length; i++) {
        const n = merged[i];
        const c = cloudMap.get(n.id);
        if (!c || n.updatedAt > c.updatedAt) {
          // 本地独有或更新 → 迁移媒体后推上云
          const images = await Promise.all(n.images.map(migrateMediaRef));
          const files = await Promise.all(n.files.map(migrateMediaRef));
          merged[i] = { ...n, images, files };
          await cloudUpsertNote(merged[i], userId);
        }
      }
      saveNotes(merged);
      setNotes(merged);
    } catch (e) {
      console.error('云端同步失败（先用本地数据）：', e);
    } finally {
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    // 立即显示本地数据（无登录时也能看；首启灌示例）
    const existing = loadNotes();
    if (existing.length === 0 && !localStorage.getItem(SEEDED_KEY)) {
      const demo = seedNotes();
      saveNotes(demo);
      localStorage.setItem(SEEDED_KEY, '1');
      setNotes(demo);
    } else {
      setNotes(existing);
    }

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
      if (session?.user && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
        void sync(session.user.id);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [sync]);

  const addNote = useCallback((note: Note) => {
    setNotes((prev) => {
      const next = [note, ...prev].sort((a, b) => b.createdAt - a.createdAt);
      saveNotes(next);
      return next;
    });
    const u = userRef.current;
    if (u) cloudUpsertNote(note, u.id).catch((e) => console.error('上传失败：', e));
  }, []);

  const updateNote = useCallback((id: string, patch: Partial<Note>) => {
    let updated: Note | undefined;
    setNotes((prev) => {
      const next = prev
        .map((n) => (n.id === id ? (updated = { ...n, ...patch, updatedAt: Date.now() }) : n))
        .sort((a, b) => b.createdAt - a.createdAt);
      saveNotes(next);
      return next;
    });
    const u = userRef.current;
    if (u && updated) cloudUpsertNote(updated, u.id).catch((e) => console.error('更新失败：', e));
  }, []);

  const deleteNote = useCallback((id: string) => {
    setNotes((prev) => {
      const gone = prev.find((n) => n.id === id);
      if (gone) for (const m of [...gone.images, ...gone.files]) void removeMedia(m);
      const next = prev.filter((n) => n.id !== id);
      saveNotes(next);
      return next;
    });
    const u = userRef.current;
    if (u) cloudDeleteNote(id).catch((e) => console.error('删除失败：', e));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);
  const signUp = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setNotes([]);
  }, []);

  const tags = useMemo(() => tagStats(notes), [notes]);

  const value = useMemo(
    () => ({ notes, tags, user, authReady, syncing, addNote, updateNote, deleteNote, signIn, signUp, signOut }),
    [notes, tags, user, authReady, syncing, addNote, updateNote, deleteNote, signIn, signUp, signOut],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useStore 必须在 StoreProvider 内使用');
  return ctx;
}
