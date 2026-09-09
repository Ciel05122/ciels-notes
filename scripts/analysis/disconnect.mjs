import { disconnect } from './private-store.mjs';

await disconnect();
console.log('已删除本机 Supabase 会话。分析游标仍保留，原始笔记和云端数据没有变化。');
