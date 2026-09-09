// 给自由标签上色：按标签文字算出一个固定颜色（同名标签永远同色）。
// 一组柔和、暖色调里协调、且明显区别于 个人/专业/目标 三种固定色的配色。
const PALETTE: { bg: string; fg: string }[] = [
  { bg: '#ead9c7', fg: '#9c7b4f' }, // 焦糖
  { bg: '#e3e0cd', fg: '#7f7c53' }, // 橄榄
  { bg: '#e6dce6', fg: '#8a6f8c' }, // 藕紫
  { bg: '#d8e3e3', fg: '#5f8285' }, // 青灰
  { bg: '#efdcd2', fg: '#b06a4a' }, // 陶土
  { bg: '#dee2cf', fg: '#6f7a55' }, // 苔绿
  { bg: '#e7dbe0', fg: '#9c6f82' }, // 豆沙
  { bg: '#dce0ea', fg: '#6b7596' }, // 石板蓝
];

export function tagColor(tag: string): { background: string; color: string } {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  const c = PALETTE[h % PALETTE.length];
  return { background: c.bg, color: c.fg };
}
