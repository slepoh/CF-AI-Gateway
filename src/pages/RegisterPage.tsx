import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { setAuth } from '../lib/auth';
import type { User } from '../lib/auth';
import { Mail, Shield, User as UserIcon, Ticket, Globe, ShieldCheck } from 'lucide-react';

export default function RegisterPage() {
  const [step, setStep] = useState<'email' | 'verify'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const navigate = useNavigate();

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const handleSendCode = useCallback(async () => {
    if (!email || sendingCode || countdown > 0) return;
    setSendingCode(true);
    setError('');
    try {
      await apiRequest('/api/auth/send-code', {
        method: 'POST',
        body: { email, purpose: 'register' },
      });
      setStep('verify');
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSendingCode(false);
    }
  }, [email, sendingCode, countdown]);

  const handleResend = useCallback(async () => {
    if (countdown > 0) return;
    setSendingCode(true);
    setError('');
    try {
      await apiRequest('/api/auth/send-code', {
        method: 'POST',
        body: { email, purpose: 'register' },
      });
      setCountdown(60);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发送失败');
    } finally {
      setSendingCode(false);
    }
  }, [email, countdown]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest<{ token: string; user: User; api_key?: string }>('/api/auth/register', {
        method: 'POST',
        body: { email, password, name, invite_code: inviteCode || undefined, code },
      });
      setAuth(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '注册失败');
    } finally {
      setLoading(false);
    }
  };

  const inputClass = "w-full pl-10 pr-4 py-2.5 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-indigo-500 dark:focus:border-white transition";

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-black px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 mb-4">
            <div className="w-9 h-9 bg-indigo-600 dark:bg-white rounded-lg flex items-center justify-center">
              <Globe className="w-5 h-5 text-white dark:text-black" />
            </div>
          </Link>
          <h1 className="text-xl font-bold tracking-tight">创建账号</h1>
          <p className="text-slate-500 dark:text-zinc-500 text-sm mt-1">开始使用 AI Gateway</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10 rounded-lg text-red-600 dark:text-red-400 text-sm">
              {error}
            </div>
          )}

          {step === 'email' ? (
            <div className="space-y-4">
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
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                onClick={handleSendCode}
                disabled={!email || sendingCode}
                className="w-full py-2.5 bg-indigo-600 dark:bg-white text-white dark:text-black font-medium rounded-lg text-sm hover:bg-indigo-700 dark:hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sendingCode ? '发送中...' : '发送验证码'}
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-zinc-900/50 border border-slate-200 dark:border-zinc-800 rounded-lg">
                <Mail className="w-4 h-4 text-slate-400 dark:text-zinc-500 shrink-0" />
                <span className="text-sm text-slate-600 dark:text-zinc-300 truncate">{email}</span>
                <button
                  type="button"
                  onClick={() => { setStep('email'); setError(''); }}
                  className="ml-auto text-xs text-slate-400 dark:text-zinc-600 hover:text-slate-700 dark:hover:text-white transition shrink-0"
                >
                  更换
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">验证码</label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600" />
                    <input
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="6 位验证码"
                      required
                      maxLength={6}
                      autoFocus
                      className={inputClass + " tracking-widest"}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={countdown > 0 || sendingCode}
                    className="px-4 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-lg text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:border-slate-300 dark:hover:border-zinc-600 transition disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {countdown > 0 ? `${countdown}s` : '重新发送'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">密码</label>
                <div className="relative">
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="至少 6 位"
                    required
                    minLength={6}
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">昵称</label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="你的昵称"
                    required
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-zinc-300 mb-1.5">
                  邀请码 <span className="text-slate-400 dark:text-zinc-600">(选填)</span>
                </label>
                <div className="relative">
                  <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-zinc-600" />
                  <input
                    type="text"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    placeholder="有邀请码请填写"
                    className={inputClass}
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-2.5 bg-indigo-600 dark:bg-white text-white dark:text-black font-medium rounded-lg text-sm hover:bg-indigo-700 dark:hover:bg-zinc-200 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '注册中...' : '完成注册'}
              </button>
            </form>
          )}

          <p className="mt-5 text-center text-sm text-slate-500 dark:text-zinc-500">
            已有账号？{' '}
            <Link to="/login" className="text-indigo-600 dark:text-white hover:underline transition">
              去登录
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
