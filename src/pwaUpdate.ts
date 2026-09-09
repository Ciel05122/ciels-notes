import { registerSW } from 'virtual:pwa-register';

// PWA 自动更新：解决「部署了新版本，手机桌面 App 还一直显示旧版」。
// 1) 打开 App / 从后台切回来 / 每 5 分钟 → 主动检查有没有新版本
// 2) 新版本装好接管后 → 自动刷新页面，直接用上新版

if ('serviceWorker' in navigator) {
  // 首次安装接管时也会触发 controllerchange，那次不用刷新
  let hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });
}

registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => reg.update().catch(() => {});
    setInterval(check, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) check();
    });
  },
});
