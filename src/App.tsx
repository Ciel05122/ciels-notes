import { lazy, Suspense } from 'react';
import { Routes, Route, useLocation } from 'react-router-dom';
import { StoreProvider, useStore } from './store';
import { TabBar } from './components/TabBar';
import { Timeline } from './pages/Timeline';
import { Write } from './pages/Write';
import { Search } from './pages/Search';
import { Calendar } from './pages/Calendar';
import { Goals } from './pages/Goals';
import { Pins } from './pages/Pins';
import { Login } from './pages/Login';
import { Timer } from './pages/Timer';
import { Tags } from './pages/Tags';
import { NoteDetail } from './pages/NoteDetail';
// 回顾页要用 marked + dompurify 渲染 Markdown，按需加载，不拖慢首页
const Reviews = lazy(() => import('./pages/Reviews').then((m) => ({ default: m.Reviews })));
const ReviewDetail = lazy(() => import('./pages/Reviews').then((m) => ({ default: m.ReviewDetail })));
import './App.css';

function Shell() {
  const location = useLocation();
  const { authReady, user } = useStore();

  // 还没确认登录状态：先留白，避免登录页/主页闪一下
  if (!authReady) return <div className="app" />;
  // 未登录 → 登录页
  if (!user) return <div className="app"><Login /></div>;

  // 全屏二级页（写入 / 日历 / 编辑）不显示底部 tab 栏
  const hideTab =
    location.pathname === '/write' ||
    location.pathname === '/calendar' ||
    location.pathname === '/timer' ||
    location.pathname.startsWith('/edit/') ||
    location.pathname.startsWith('/note/') ||
    location.pathname.startsWith('/reviews/');

  return (
    <div className="app">
      <Routes>
        <Route path="/" element={<Timeline />} />
        <Route path="/write" element={<Write />} />
        <Route path="/edit/:id" element={<Write />} />
        <Route path="/note/:id" element={<NoteDetail />} />
        <Route path="/search" element={<Search />} />
        <Route path="/calendar" element={<Calendar />} />
        <Route path="/timer" element={<Timer />} />
        <Route path="/tags" element={<Tags />} />
        <Route path="/goals" element={<Goals />} />
        <Route path="/pins" element={<Pins />} />
        <Route path="/reviews" element={<Suspense fallback={<div className="page" />}><Reviews /></Suspense>} />
        <Route path="/reviews/:id" element={<Suspense fallback={<div className="page" />}><ReviewDetail /></Suspense>} />
      </Routes>
      {!hideTab && <TabBar />}
    </div>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
