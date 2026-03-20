import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { Loader2, Eye, X, Trash2, ShoppingCart, Users, Key, CreditCard, BarChart3, DollarSign } from 'lucide-react';

interface UserInfo {
  id: string;
  email: string;
  name: string;
  role: string;
  created_at?: string;
  key_count: number;
  order_count: number;
  active_plan?: string | null;
  plan_expires?: string | null;
}

interface UserToken {
  key: string;
  name: string;
  rpm: number;
  total_limit: number;
  total_used: number;
    plan_id?: string;
  plan_expires_at?: string;
  enabled: boolean;
}

interface Order {
  id: string;
  plan_id: string;
  plan_name?: string;
  amount: number;
  status: string;
  pay_type?: string;
  created_at: string;
  paid_at?: string;
  expires_at?: string;
}

interface Overview {
  users: number;
  keys: number;
  paid_orders: number;
  today_revenue: number;
  total_revenue: number;
  today_requests: number;
}

const planNames: Record<string, string> = { free: '试用版', basic: '基础版', standard: '标准版', pro: '专业版' };

export default function UsersPage() {
  const [users, setUsers] = useState<UserInfo[]>([]);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalType, setModalType] = useState<'tokens' | 'orders' | null>(null);
  const [modalUser, setModalUser] = useState<string>('');
  const [userTokens, setUserTokens] = useState<UserToken[]>([]);
  const [userOrders, setUserOrders] = useState<Order[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [userData, overviewData] = await Promise.all([
        apiRequest<{ users: UserInfo[] }>('/api/users'),
        apiRequest<Overview>('/api/admin/overview'),
      ]);
      setUsers(userData.users || []);
      setOverview(overviewData);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const viewTokens = async (userId: string, email: string) => {
    setModalType('tokens');
    setModalUser(email);
    setModalLoading(true);
    try {
      const data = await apiRequest<{ tokens: UserToken[] }>(`/api/tokens?user_id=${encodeURIComponent(userId)}`);
      setUserTokens(data.tokens || []);
    } catch { setUserTokens([]); }
    finally { setModalLoading(false); }
  };

  const viewOrders = async (userId: string, email: string) => {
    setModalType('orders');
    setModalUser(email);
    setModalLoading(true);
    try {
      const data = await apiRequest<{ orders: Order[] }>(`/api/admin/orders?user_id=${encodeURIComponent(userId)}`);
      setUserOrders(data.orders || []);
    } catch { setUserOrders([]); }
    finally { setModalLoading(false); }
  };

  const deleteUser = async (userId: string, email: string) => {
    if (!confirm(`确定删除用户 ${email}？\n\n将同时删除其所有密钥和订单记录，不可撤销。`)) return;
    try {
      await apiRequest(`/api/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
      loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : '删除失败');
    }
  };

  const closeModal = () => { setModalType(null); setModalUser(''); };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-5 h-5 text-slate-400 dark:text-zinc-500 animate-spin" />
    </div>
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-semibold">用户管理</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-500 mt-0.5">平台用户与收入概览</p>
      </div>

      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: '用户数', value: overview.users, icon: Users, color: 'text-blue-500 dark:text-blue-400' },
            { label: '密钥数', value: overview.keys, icon: Key, color: 'text-emerald-500 dark:text-emerald-400' },
            { label: '已付订单', value: overview.paid_orders, icon: CreditCard, color: 'text-purple-500 dark:text-purple-400' },
            { label: '今日收入', value: `¥${overview.today_revenue.toFixed(1)}`, icon: DollarSign, color: 'text-yellow-500 dark:text-yellow-400' },
            { label: '总收入', value: `¥${overview.total_revenue.toFixed(1)}`, icon: DollarSign, color: 'text-orange-500 dark:text-orange-400' },
            { label: '今日请求', value: overview.today_requests.toLocaleString(), icon: BarChart3, color: 'text-cyan-500 dark:text-cyan-400' },
          ].map((item) => (
            <div key={item.label} className="border border-slate-200 dark:border-zinc-800 rounded-xl p-4 bg-white dark:bg-transparent">
              <div className="flex items-center gap-2 mb-2">
                <item.icon className={`w-4 h-4 ${item.color}`} />
                <span className="text-xs text-slate-500 dark:text-zinc-500">{item.label}</span>
              </div>
              <p className="text-xl font-bold">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-transparent">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-500 text-xs uppercase tracking-wider">
                <th className="text-left px-4 py-3 font-medium">用户</th>
                <th className="text-left px-4 py-3 font-medium">当前套餐</th>
                <th className="text-left px-4 py-3 font-medium">密钥</th>
                <th className="text-left px-4 py-3 font-medium">订单</th>
                <th className="text-left px-4 py-3 font-medium">注册时间</th>
                <th className="text-right px-4 py-3 font-medium">操作</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-16 text-slate-400 dark:text-zinc-600">暂无用户</td></tr>
              ) : users.map((u) => (
                <tr key={u.id} className="border-b border-slate-100 dark:border-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-900/50 transition">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium">{u.name || u.email.split('@')[0]}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-500">{u.email}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {u.active_plan ? (
                      <div>
                        <span className={`inline-flex text-xs font-medium px-2 py-0.5 rounded-full ${
                          u.active_plan === 'pro' ? 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400' :
                          u.active_plan === 'standard' ? 'bg-blue-100 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' :
                          u.active_plan === 'basic' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                          'bg-slate-100 dark:bg-zinc-900 text-slate-500 dark:text-zinc-400'
                        }`}>
                          {planNames[u.active_plan] || u.active_plan}
                        </span>
                        {u.plan_expires && (
                          <p className="text-xs text-slate-400 dark:text-zinc-600 mt-0.5">到期 {new Date(u.plan_expires).toLocaleDateString('zh-CN')}</p>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 dark:text-zinc-600">试用版</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{u.key_count}</td>
                  <td className="px-4 py-3 text-slate-500 dark:text-zinc-400">{u.order_count}</td>
                  <td className="px-4 py-3 text-slate-400 dark:text-zinc-500 text-xs font-mono">
                    {u.created_at ? new Date(u.created_at).toLocaleDateString('zh-CN') : '-'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => viewTokens(u.id, u.email)}
                        className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition" title="查看密钥">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => viewOrders(u.id, u.email)}
                        className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition" title="查看订单">
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteUser(u.id, u.email)}
                        className="p-1.5 text-slate-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition" title="删除用户">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalType && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={closeModal}>
          <div className="bg-white dark:bg-[#0a0a0a] border border-slate-200 dark:border-zinc-800 rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">
                {modalUser} 的{modalType === 'tokens' ? '密钥' : '订单'}
              </h3>
              <button onClick={closeModal} className="p-1 text-slate-400 dark:text-zinc-600 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-800 transition">
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 text-slate-400 dark:text-zinc-500 animate-spin" /></div>
            ) : modalType === 'tokens' ? (
              userTokens.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">暂无密钥</p>
              ) : (
                <div className="space-y-2">
                  {userTokens.map((t) => (
                    <div key={t.key} className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg p-3 hover:border-slate-300 dark:hover:border-zinc-700 transition">
                      <div className="flex items-center justify-between mb-2">
                        <p className="font-medium text-sm">{t.name}</p>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${t.enabled ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-400'}`}>
                          {t.enabled ? '启用' : '禁用'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 dark:text-zinc-600 font-mono mb-2">{t.key.slice(0, 10)}...{t.key.slice(-4)}</p>
                      <div className="flex gap-3 text-xs text-slate-500 dark:text-zinc-500">
                        <span>套餐: {planNames[t.plan_id || 'free'] || '试用版'}</span>
                        <span>RPM: {t.rpm}</span>
                        <span>总用: {t.total_used || 0}/{t.total_limit || '∞'}</span>
                      </div>
                      {t.plan_expires_at && (
                        <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">到期: {new Date(t.plan_expires_at).toLocaleString('zh-CN')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              userOrders.length === 0 ? (
                <p className="text-slate-400 dark:text-zinc-600 text-sm text-center py-8">暂无订单</p>
              ) : (
                <div className="space-y-2">
                  {userOrders.map((o) => (
                    <div key={o.id} className="bg-slate-50 dark:bg-black border border-slate-200 dark:border-zinc-800 rounded-lg p-3 hover:border-slate-300 dark:hover:border-zinc-700 transition">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{o.plan_name || planNames[o.plan_id] || o.plan_id}</span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          o.status === 'paid' ? 'bg-emerald-100 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400'
                        }`}>
                          {o.status === 'paid' ? '已支付' : '待支付'}
                        </span>
                      </div>
                      <div className="flex gap-3 text-xs text-slate-500 dark:text-zinc-500">
                        <span>¥{o.amount}</span>
                        {o.pay_type && <span>{o.pay_type === 'alipay' ? '支付宝' : o.pay_type === 'wxpay' ? '微信' : o.pay_type}</span>}
                        <span>{new Date(o.created_at).toLocaleString('zh-CN')}</span>
                      </div>
                      {o.expires_at && o.status === 'paid' && (
                        <p className="text-xs text-slate-400 dark:text-zinc-600 mt-1">有效期至: {new Date(o.expires_at).toLocaleString('zh-CN')}</p>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}

            <button onClick={closeModal} className="mt-4 w-full py-2 border border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 text-sm font-medium rounded-lg hover:bg-slate-50 dark:hover:bg-zinc-900 transition">关闭</button>
          </div>
        </div>
      )}
    </div>
  );
}
