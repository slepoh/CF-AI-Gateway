import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { setAuth } from '../lib/auth';
import type { User } from '../lib/auth';
import { Mail, Shield, User as UserIcon, Globe, Settings } from 'lucide-react';

type Tab = 'admin' | 'user';

export default function LoginPage() {
  const [tab, setTab] = useState<Tab>('user');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      let data: { token: string; user: User };
      if (tab === 'admin') {
        data = await apiRequest('/api/auth/admin-login', {
          method: 'POST',
          body: { password },
        });
      } else {
        data = await apiRequest('/api/auth/login', {
          method: 'POST',
          body: { email, password },
        });
      }
      setAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '登录失败');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-indigo-500 dark:focus:border-white transition";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-indigo-600 dark:bg-white rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-white dark:text-black" />
            </div>
          </Link>
          <h1 className="text-xl font-bold tracking-tight">登录 AI Gateway</h1>
          <p className="text-slate-500 dark:text-zinc-500 text-sm mt-1">欢迎回来</p>
        </div>

        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          <div className="flex mb-6 bg-slate-100 dark:bg-black rounded-lg p-1 border border-slate-200 dark:border-zinc-800">
            <button
              onClick={() => { setTab('user'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'user'
                  ? 'bg-white dark:bg-white text-slate-900 dark:text-black shadow-sm'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              <UserIcon className="w-3.5 h-3.5" />
              用户登录
            </button>
            <button
              onClick={() => { setTab('admin'); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium transition-all ${
                tab === 'admin'
                  ? 'bg-white dark:bg-white text-slate-900 dark:text-black shadow-sm'
                  : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              管理员
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {tab === 'user' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">邮箱</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                    className={inputClass}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">密码</label>
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className={inputClass}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-indigo-600 dark:bg-white text-white dark:text-black font-medium rounded-lg text-sm hover:bg-indigo-700 dark:hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? '登录中...' : '登录'}
            </button>
          </form>

          {tab === 'user' && (
            <p className="mt-5 text-center text-sm text-slate-500 dark:text-zinc-500">
              还没有账号？{' '}
              <Link to="/register" className="text-indigo-600 dark:text-white hover:underline transition">
                立即注册
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
