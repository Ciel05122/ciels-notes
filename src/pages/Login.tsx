import { useState } from 'react';
import { useStore } from '../store';

export function Login() {
  const { signIn, signUp } = useStore();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg('');
    if (!email.trim() || pw.length < 6) {
      setMsg('请填邮箱，密码至少 6 位');
      return;
    }
    setBusy(true);
    try {
      if (mode === 'in') {
        await signIn(email.trim(), pw);
      } else {
        await signUp(email.trim(), pw);
        setMsg('注册成功，正在进入…（若提示验证邮箱，去邮箱点一下链接再登录）');
      }
    } catch (err) {
      setMsg(friendly((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-box">
        <h1 className="login-title">我的记录</h1>
        <p className="login-sub">登录后，记录会自动云端备份、跨设备同步</p>

        <form onSubmit={submit}>
          <input
            className="login-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="邮箱"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="login-input"
            type="password"
            autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
            placeholder="密码（至少 6 位）"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
          />
          <button className="login-btn" type="submit" disabled={busy}>
            {busy ? '请稍候…' : mode === 'in' ? '登录' : '注册'}
          </button>
        </form>

        {msg && <p className="login-msg">{msg}</p>}

        <button
          className="login-switch"
          type="button"
          onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setMsg(''); }}
        >
          {mode === 'in' ? '还没有账号？去注册' : '已有账号？去登录'}
        </button>
      </div>
    </div>
  );
}

function friendly(m: string): string {
  if (/Invalid login credentials/i.test(m)) return '邮箱或密码不对';
  if (/already registered/i.test(m)) return '这个邮箱已注册，直接登录吧';
  if (/Email not confirmed/i.test(m)) return '邮箱还没验证，去邮箱点一下确认链接';
  return m;
}
