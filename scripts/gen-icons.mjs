// 生成 PWA 图标（赤陶橙圆角方块 + 白色「记」字）。
// 用法：node scripts/gen-icons.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';

mkdirSync('public', { recursive: true });

const svg = (size, radius) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" rx="${radius}" fill="#b85c38"/>
  <text x="50%" y="52%" dy="0.04em" text-anchor="middle" dominant-baseline="central"
    font-family="PingFang SC, Microsoft YaHei, sans-serif" font-weight="700"
    font-size="${Math.round(size * 0.56)}" fill="#fffefb">记</text>
</svg>`;

const targets = [
  { file: 'public/pwa-192.png', size: 192, radius: 40 },
  { file: 'public/pwa-512.png', size: 512, radius: 108 },
  // iOS 主屏图标：满铺、无透明（系统自己加圆角）
  { file: 'public/apple-touch-icon.png', size: 180, radius: 0 },
  { file: 'public/favicon-32.png', size: 32, radius: 6 },
];

for (const t of targets) {
  await sharp(Buffer.from(svg(t.size, t.radius))).png().toFile(t.file);
  console.log('✓', t.file);
}
