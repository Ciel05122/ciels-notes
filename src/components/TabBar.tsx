import { NavLink } from 'react-router-dom';

const tabs = [
  { to: '/', label: '首页', icon: IconHome, end: true },
  { to: '/tags', label: '标签', icon: IconTags, end: false },
  { to: '/search', label: '搜索', icon: IconSearch, end: false },
];

export function TabBar() {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.end} className="tab">
          <t.icon />
          <span className="tab-label">{t.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 10.5L12 4l8 6.5" /><path d="M6 9.5V20h12V9.5" />
    </svg>
  );
}
function IconTags() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="9" cy="9" r="4.5" /><circle cx="16.5" cy="14.5" r="3.2" /><circle cx="8.5" cy="17.5" r="2.2" />
    </svg>
  );
}
function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" />
    </svg>
  );
}
