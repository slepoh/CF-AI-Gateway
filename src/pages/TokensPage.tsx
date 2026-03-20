import { useState, useEffect, useCallback } from 'react';
import { apiRequest } from '../lib/api';
import { isAdmin } from '../lib/auth';
import {
  Plus, Copy, Pencil, RotateCcw, Trash2, ToggleLeft, ToggleRight, X, Check, Loader2
} from 'lucide-react';

interface Token {
  key: string;
  name: string;
  rpm: number;
  total_limit: number;
  total_used: number;
    plan_id?: string;
  plan_expires_at?: string;
  enabled: boolean;
  user_email?: string;
}

function maskKey(key: string) {
  if (key.length <= 10) return key;
  return key.slice(0, 6) + '...' + key.slice(-4);
}

function formatLimit(n: number | undefined): string {
  if (!n || n === 0 || n === -1) return '不限';
  return n.toLocaleString();
}

export default function TokensPage() {
  const [tokens, setTokens] = useState<Token[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [editToken, setEditToken] = useState<Token | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const admin = isAdmin();

  const fetchTokens = useCallback(async () => {
    try {
      const data = await apiRequest<{ tokens: Token[] }>('/api/tokens');
      setTokens(data.tokens || []);
    } catch (err) {
      console.error('Failed to fetch tokens:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  const copyKey = async (key: string) => {
    await navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  const toggleToken = async (token: Token) => {
    try {
      await apiRequest(`/api/tokens/${encodeURIComponent(token.key)}`, {
        method: 'PUT',
        body: { enabled: !token.enabled },
      });
      fetchTokens();
    } catch (err) {
      alert(err instanceof Error ? err.message : '操作失败');
    }
  };

  const resetToken = async (key: string) => {
    if (!confirm('确定要重置此密钥的 Key？旧 Key 将失效。')) return;
    try {
      await apiRequest(`/api/tokens/reset/${encodeURIComponent(key)}`, { method: 'POST' });
      fetchTokens();
    } catch (err) {
      alert(err instanceof Error ? err.message : '重置失败');
    }
  };

  const deleteToken = async (key: string) => {
    if (!confirm('确定要删除此密钥？此操作不可撤销。')) return;
    try {
      await apiRequest(`/api/tokens/${encodeURIComponent(key)}`, { method: 'DELETE' });
      fetchTokens();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const planLabel: Record<string, string> = { free: '试用版', basic: '基础版', standard: '标准版', pro: '专业版' };

  // Compute summary info
  const totalUsed = tokens.reduce((s, t) => s + (t.total_used || 0), 0);
  const totalLimit = tokens.reduce((s, t) => s + (t.total_limit || 0), 0);
  const bestPlan = tokens.length > 0
    ? tokens.reduce((best, t) => {
        const ranks = ['free', 'basic', 'standard', 'pro'];
        return ranks.indexOf(t.plan_id || 'free') > ranks.indexOf(best) ? (t.plan_id || 'free') : best;
      }, 'free')
    : 'free';
  const planExpiry = tokens.find(t => t.plan_expires_at)?.plan_expires_at;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-slate-400 dark:text-zinc-500 animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">密钥管理</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-500 mt-0.5">管理你的 API 密钥</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-zinc-200 transition"
        >
          <Plus className="w-4 h-4" />
          {' '}新建密钥
        </button>
      </div>

      {/* Summary cards (non-admin only) */}
      {!admin && tokens.length > 0 && (
        <div className="border border-slate-200 dark:border-zinc-800 rounded-xl p-4 mb-4 flex items-center justify-between bg-white dark:bg-transparent">
          <div className="flex items-center gap-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-zinc-500">当前套餐</p>
              <span className={`inline-flex text-sm font-semibold mt-0.5 ${
                bestPlan === 'pro' ? 'text-yellow-500 dark:text-yellow-400' :
                bestPlan === 'standard' ? 'text-blue-500 dark:text-blue-400' :
                bestPlan === 'basic' ? 'text-emerald-500 dark:text-emerald-400' :
                'text-slate-500 dark:text-zinc-400'
              }`}>
                {planLabel[bestPlan] || '试用版'}
              </span>
              {planExpiry && (
                <p className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5">
                  到期 {new Date(planExpiry).toLocaleDateString('zh-CN')}
                </p>
              )}
            </div>
            <div className="w-px h-8 bg-slate-200 dark:bg-zinc-800" />
            <div>
              <p className="text-xs text-slate-500 dark:text-zinc-500">本月用量</p>
              <p className="text-sm font-semibold mt-0.5">
                {totalUsed.toLocaleString()}
                <span className="text-slate-400 dark:text-zinc-600 font-normal">
                  /{totalLimit > 0 ? totalLimit.toLocaleString() : '∞'}
                </span>
              </p>
              {totalLimit > 0 && (
                <div className="w-32 h-1.5 bg-slate-200 dark:bg-zinc-800 rounded-full mt-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      totalUsed / totalLimit > 0.9 ? 'bg-red-500' :
                      totalUsed / totalLimit > 0.7 ? 'bg-yellow-500' :
                      'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(100, (totalUsed / totalLimit) * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
          <a href="/pricing" className="text-xs text-slate-500 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-white transition">
            升级套餐 →
          </a>
        </div>
      )}

      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-transparent">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">名称</th>
                {admin && <th className="text-left px-4 py-3 font-medium">用户</th>}
                <th className="text-left px-4 py-3 font-medium">Key</th>
                <th className="text-left px-4 py-3 font-medium">套餐</th>
                <th className="text-left px-4 py-3 font-medium">RPM</th>
                <th className="text-left px-4 py-3 font-medium">已用 / 总量</th>
                <th className="text-left px-4 py-3 font-medium">状态</th>
                <th className="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {tokens.length === 0 ? (
                <tr>
                  <td colSpan={admin ? 8 : 7} className="text-center py-16 text-slate-400 dark:text-zinc-600">
                    暂无密钥，点击右上角创建
                  </td>
                </tr>
              ) : (
                tokens.map((t) => (
                  <tr key={t.key} className="border-b border-slate-100 dark:border-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition">
                    <td className="px-4 py-3 font-medium">{t.name || '-'}</td>
                    {admin && <td className="px-4 py-3 text-slate-500 dark:text-zinc-500">{t.user_email || '-'}</td>}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => copyKey(t.key)}
                        className="inline-flex items-center gap-1.5 text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white font-mono text-xs bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2.5 py-1 rounded-md transition"
                        title="点击复制完整 Key"
                      >
                        {maskKey(t.key)}
                        {copied === t.key ? (
                          <Check className="w-3 h-3 text-green-500 dark:text-green-400" />
                        ) : (
                          <Copy className="w-3 h-3 text-slate-400 dark:text-zinc-600" />
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.plan_id === 'pro' ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                        t.plan_id === 'standard' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                        t.plan_id === 'basic' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                        'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-500'
                      }`}>
                        {planLabel[t.plan_id || 'free'] || '试用版'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{t.rpm || '∞'}</td>
                    <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{(t.total_used || 0).toLocaleString()} / {formatLimit(t.total_limit)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs font-medium px-2 py-0.5 rounded-full ${
                        t.enabled
                          ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'
                      }`}>
                        {t.enabled ? '启用' : '禁用'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button onClick={() => copyKey(t.key)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition" title="复制 Key">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={() => setEditToken(t)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition" title="编辑">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {admin && <button onClick={() => toggleToken(t)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition" title={t.enabled ? '禁用' : '启用'}>
                          {t.enabled ? <ToggleRight className="w-4 h-4 text-emerald-500 dark:text-emerald-400" /> : <ToggleLeft className="w-4 h-4" />}
                        </button>}
                        <button onClick={() => resetToken(t.key)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-yellow-500 dark:hover:text-yellow-400 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition" title="重置 Key">
                          <RotateCcw className="w-4 h-4" />
                        </button>
                        <button onClick={() => deleteToken(t.key)} className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition" title="删除">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {(showCreate || editToken) && (
        <TokenModal
          token={editToken}
          onClose={() => { setShowCreate(false); setEditToken(null); }}
          onSave={() => { setShowCreate(false); setEditToken(null); fetchTokens(); }}
        />
      )}
    </div>
  );
}

function TokenModal({ token, onClose, onSave }: { token: Token | null; onClose: () => void; onSave: () => void }) {
  const [name, setName] = useState(token?.name || '');
  const [rpm, setRpm] = useState(String(token?.rpm ?? 60));
  const [totalLimitVal, setTotalLimitVal] = useState(String(token?.total_limit ?? 0));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const admin = isAdmin();

  const inputClass = "w-full px-3 py-2.5 bg-white dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg text-sm placeholder:text-slate-400 dark:placeholder:text-zinc-600 focus:border-indigo-500 dark:focus:border-white transition";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body: Record<string, unknown> = { name };
      if (admin) {
        body.rpm = parseInt(rpm) || 0;
        body.total_limit = parseInt(totalLimitVal) || 0;
      }
      if (token) {
        await apiRequest(`/api/tokens/${encodeURIComponent(token.key)}`, { method: 'PUT', body });
      } else {
        await apiRequest('/api/tokens', { method: 'POST', body });
      }
      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={onClose}>
      <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-md shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold">{token ? '编辑密钥' : '新建密钥'}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 dark:text-zinc-600 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-500/5 border border-red-200 dark:border-red-500/10 rounded-lg text-red-600 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">名称</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：生产环境"
              required
              className={inputClass}
            />
          </div>
          {admin && (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">RPM</label>
                  <input type="number" value={rpm} onChange={(e) => setRpm(e.target.value)} min="0" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">总额度</label>
                  <input type="number" value={totalLimitVal} onChange={(e) => setTotalLimitVal(e.target.value)} min="0" className={inputClass} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-600 dark:text-zinc-400 mb-1.5">总限额</label>
                  <input type="number" value={totalLimitVal} onChange={(e) => setTotalLimitVal(e.target.value)} min="0" className={inputClass} />
                </div>
              </div>
              <p className="text-xs text-slate-400 dark:text-zinc-600">限额设为 0 表示无限制</p>
            </>
          )}
          {!admin && !token && (
            <p className="text-xs text-slate-500 dark:text-zinc-500">新密钥将使用试用版配额（5 RPM / 50 次），可在「购买套餐」页面升级</p>
          )}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 py-2.5 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 transition">取消</button>
            <button type="submit" disabled={loading}
              className="flex-1 py-2.5 bg-indigo-600 dark:bg-white text-white dark:text-black text-sm font-medium rounded-lg hover:bg-indigo-700 dark:hover:bg-zinc-200 transition disabled:opacity-50">
              {loading ? '保存中...' : '保存'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
