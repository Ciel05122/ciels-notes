import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// 思源宋体（自托管，按字符块按需加载），用于正文
import '@fontsource/noto-serif-sc/chinese-simplified-400.css';
import '@fontsource/noto-serif-sc/latin-400.css';
import './index.css';
import './pwaUpdate';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
