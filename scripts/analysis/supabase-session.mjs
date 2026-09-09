import { createClient } from '@supabase/supabase-js';

import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config.mjs';
import { saveSession } from './private-store.mjs';

export function createReadOnlyClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

export function serializeSession(session) {
  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt: session.expires_at,
    userId: session.user.id,
    savedAt: Date.now(),
  };
}

export async function restoreSession(client, storedSession) {
  if (!storedSession?.accessToken || !storedSession?.refreshToken || !storedSession?.userId) {
    throw new Error('尚未完成分析助手登录，请先运行 npm run analysis:setup。');
  }

  const { data, error } = await client.auth.setSession({
    access_token: storedSession.accessToken,
    refresh_token: storedSession.refreshToken,
  });

  if (error || !data.session) {
    throw new Error(`Supabase 会话已经失效，请重新运行 npm run analysis:setup。${error ? ` 原因：${error.message}` : ''}`);
  }

  if (data.session.user.id !== storedSession.userId) {
    throw new Error('Supabase 返回的账号与本机保存的账号不一致，已停止读取。');
  }

  const refreshed = serializeSession(data.session);
  if (
    refreshed.accessToken !== storedSession.accessToken
    || refreshed.refreshToken !== storedSession.refreshToken
    || refreshed.expiresAt !== storedSession.expiresAt
  ) {
    await saveSession(refreshed);
  }

  return refreshed;
}
