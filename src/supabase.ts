import { createClient } from '@supabase/supabase-js';

// 云端连接配置。publishable key 设计上就是放在前端用的（数据安全靠数据库的 RLS 行级权限），
// 但仍然从环境变量读：仓库是公开的，不该把某一个具体项目的地址钉死在源码里。
// 本地开发把真实值写进 .env.local（已被 .gitignore 排除），格式见 .env.example。
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  throw new Error('缺少 Supabase 环境变量，请参考 .env.example 配置 .env.local');
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true, // 登录状态记住，下次打开免登录
    autoRefreshToken: true,
  },
});

export const MEDIA_BUCKET = 'media';
