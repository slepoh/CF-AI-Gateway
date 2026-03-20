import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { BarChart3, Activity, Key, Globe, Loader2, MessageSquare, Cpu } from 'lucide-react';

interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

interface ModelUsageItem {
  model: string;
  today_tokens: number;
  all_tokens: number;
}

interface StatItem {
  key: string;
  name: string;
  
  total_limit: number;
  total_used: number;
  tokens?: {
    today: TokenUsage;
    all: TokenUsage;
  };
}

interface StatsResponse {
  stats: StatItem[];
  model_usage?: ModelUsageItem[];
  date: string;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toLocaleString();
}

export default function StatsPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiRequest<StatsResponse>('/api/stats')
      .then(setStats)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 text-slate-400 dark:text-zinc-500 animate-spin" />
      </div>
    );
  }

  const items = stats?.stats || [];
  const modelUsage = stats?.model_usage || [];
  const todayRequests = items.reduce((s, i) => s + (i.total_used || 0), 0);
  const totalRequests = items.reduce((s, i) => s + (i.total_used || 0), 0);
  const todayTokens = items.reduce((s, i) => s + (i.tokens?.today?.total || 0), 0);
  const totalTokens = items.reduce((s, i) => s + (i.tokens?.all?.total || 0), 0);

  const cards = [
    { label: '今日请求', value: formatNumber(todayRequests), icon: BarChart3, sub: `${stats?.date || ''}` },
    { label: '总请求', value: formatNumber(totalRequests), icon: Activity, sub: '所有时间' },
    { label: '今日 Tokens', value: formatNumber(todayTokens), icon: Globe, sub: '输入 + 输出' },
    { label: '总 Tokens', value: formatNumber(totalTokens), icon: MessageSquare, sub: '所有时间' },
  ];

  const tableClass = 'border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-transparent';
  const headerRowClass = 'border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 text-xs uppercase tracking-wider';
  const bodyRowClass = 'border-b border-slate-100 dark:border-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold">用量统计</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-500 mt-0.5">查看 API 使用情况</p>
        </div>
        <span className="text-xs text-slate-400 dark:text-zinc-600 font-mono">{stats?.date}</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800 rounded-xl p-4 hover:border-slate-300 dark:hover:border-zinc-700 transition">
            <div className="flex items-center justify-between mb-3">
              <c.icon className="w-4 h-4 text-slate-400 dark:text-zinc-600" />
            </div>
            <p className="text-2xl font-bold tracking-tight">{c.value}</p>
            <p className="text-xs text-slate-500 dark:text-zinc-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>

      {/* Model usage table */}
      {modelUsage.length > 0 && (
        <div className={tableClass + ' mb-6'}>
          <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Cpu className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
              {' '}模型用量
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className={headerRowClass}>
                  <th className="text-left px-4 py-3 font-medium">模型</th>
                  <th className="text-right px-4 py-3 font-medium">今日 Tokens</th>
                  <th className="text-right px-4 py-3 font-medium">累计 Tokens</th>
                  <th className="text-left px-4 py-3 font-medium w-48">占比</th>
                </tr>
              </thead>
              <tbody>
                {modelUsage.sort((a, b) => b.all_tokens - a.all_tokens).map((m) => {
                  const maxAll = Math.max(...modelUsage.map(x => x.all_tokens), 1);
                  const pct = (m.all_tokens / maxAll) * 100;
                  return (
                    <tr key={m.model} className={bodyRowClass}>
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs bg-slate-100 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 px-2 py-0.5 rounded">
                          {m.model}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-zinc-400">{formatNumber(m.today_tokens)}</td>
                      <td className="px-4 py-3 text-right font-medium">{formatNumber(m.all_tokens)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-900 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 dark:bg-white/80 rounded-full transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-slate-400 dark:text-zinc-600 w-10 text-right">{pct.toFixed(0)}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Request usage table */}
      <div className={tableClass + ' mb-6'}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Key className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
            {' '}请求用量
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={headerRowClass}>
                <th className="text-left px-4 py-3 font-medium">密钥名称</th>
                <th className="text-right px-4 py-3 font-medium">今日请求</th>
                <th className="text-right px-4 py-3 font-medium">总请求</th>
                <th className="text-left px-4 py-3 font-medium w-48">总额度</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={4} className="text-center py-16 text-slate-400 dark:text-zinc-600">暂无数据</td></tr>
              ) : items.map((s) => (
                <tr key={s.key} className={bodyRowClass}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-zinc-400">{s.total_used.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-zinc-400">{s.total_used.toLocaleString()}</td>
                  <td className="px-4 py-3 w-48">
                    <ProgressBar current={s.total_used} limit={s.total_limit} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Token usage table */}
      <div className={tableClass}>
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Globe className="w-4 h-4 text-slate-400 dark:text-zinc-500" />
            {' '}Token 用量
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className={headerRowClass}>
                <th className="text-left px-4 py-3 font-medium">密钥名称</th>
                <th className="text-right px-4 py-3 font-medium">今日 Prompt</th>
                <th className="text-right px-4 py-3 font-medium">今日 Completion</th>
                <th className="text-right px-4 py-3 font-medium">今日合计</th>
                <th className="text-right px-4 py-3 font-medium">累计合计</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-16 text-slate-400 dark:text-zinc-600">暂无数据</td></tr>
              ) : items.map((s) => (
                <tr key={s.key} className={bodyRowClass}>
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-zinc-400">{formatNumber(s.tokens?.today?.prompt || 0)}</td>
                  <td className="px-4 py-3 text-right text-slate-500 dark:text-zinc-400">{formatNumber(s.tokens?.today?.completion || 0)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatNumber(s.tokens?.today?.total || 0)}</td>
                  <td className="px-4 py-3 text-right font-medium">{formatNumber(s.tokens?.all?.total || 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ current, limit }: { current: number; limit: number }) {
  if (!limit || limit <= 0) return <span className="text-xs text-slate-400 dark:text-zinc-600">无限制</span>;
  const pct = Math.min((current / limit) * 100, 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-200 dark:bg-zinc-900 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct > 90 ? 'bg-red-400' : pct > 70 ? 'bg-yellow-400' : 'bg-indigo-500 dark:bg-white/80'
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-slate-400 dark:text-zinc-600 w-10 text-right">{pct.toFixed(0)}%</span>
    </div>
  );
}
