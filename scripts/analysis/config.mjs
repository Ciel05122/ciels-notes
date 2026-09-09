import { loadEnvFile } from './env.mjs';

// 和前端读同一份 .env.local，避免两处各配一遍、连到不同项目。
const env = loadEnvFile();

export const SUPABASE_URL = env.VITE_SUPABASE_URL;
export const SUPABASE_PUBLISHABLE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error('缺少 Supabase 环境变量，请参考 .env.example 配置 .env.local');
}

export const ANALYSIS_TIME_ZONE = 'Asia/Shanghai';
export const INITIAL_LOOKBACK_DAYS = 3;
export const DEFAULT_NOTE_LIMIT = 300;
export const MAX_NOTE_LIMIT = 1000;

export const NOTE_COLUMNS = [
  'id',
  'text',
  'created_at',
  'updated_at',
  'type',
  'is_goal',
  'goal_done',
  'pinned',
  'tags',
  'location',
  'comments',
  'timer',
].join(',');

// ——— 回顾播报节奏 ———
// 按 2026-08-31 的实测密度校准：90 天 180 条，最近 30 天 3.53 条/天，
// 且只有 48/91 天有记录（爆发式）。模拟结果：阈值 12 条时实际间隔约 5 天。
export const REVIEW_MIN_GAP_DAYS = 4; // 硬下限：不管攒了多少，4 天内不播报第二次
export const REVIEW_NOTE_THRESHOLD = 12; // 主触发：距上次 ≥4 天且新增 ≥12 条
export const REVIEW_MAX_GAP_DAYS = 8; // 兜底：低产期也不至于永远等不到
export const REVIEW_FALLBACK_MIN_NOTES = 6; // 兜底触发所需的最少条数
export const FIRST_REVIEW_LOOKBACK_DAYS = 5; // 还没有成功游标时，第一份报告回看几天
