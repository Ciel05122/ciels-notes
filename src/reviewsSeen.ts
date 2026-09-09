// 最近一次看过的回顾时间。单独成文件，这样首页判断小红点时
// 不会把整个回顾页（连同 marked 和 dompurify）拉进首屏包。
const SEEN_KEY = 'kb.reviews.seen.v1';

export function loadReviewsSeenAt(): number {
  try {
    return Number(localStorage.getItem(SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

export function saveReviewsSeenAt(ts: number): void {
  try {
    localStorage.setItem(SEEN_KEY, String(ts));
  } catch {
    // 隐私模式下写不进去，只影响小红点，不影响阅读
  }
}
