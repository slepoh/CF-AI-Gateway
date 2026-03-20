import { useState, useEffect } from 'react';
import { apiRequest } from '../lib/api';
import { isLoggedIn } from '../lib/auth';
import { useNavigate } from 'react-router-dom';
import { Check, Globe, Loader2 } from 'lucide-react';

interface Plan {
  id: string;
  name: string;
  price: number;
  rpm: number;
  total_limit: number;
  }

const planFeatures: Record<string, string[]> = {
  free: ['3 RPM 速率限制', '不限日请求', '100 次总请求', '全模型支持'],
  basic: ['10 RPM 速率限制', '不限日请求', '1,000 次总请求', '全模型支持', '邮件支持'],
  standard: ['20 RPM 速率限制', '不限日请求', '5,000 次总请求', '全模型支持', '优先支持'],
  pro: ['40 RPM 速率限制', '不限日请求', '20,000 次总请求', '全模型支持', '专属客服'],
};

const planBadges: Record<string, string> = {
  basic: '',
  standard: '🔥 最受欢迎',
  pro: '',
};

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  useEffect(() => {
    apiRequest<{ plans: Plan[] }>('/api/plans')
      .then((data) => setPlans(data.plans.filter(p => p.price > 0)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleBuy = async (planId: string) => {
    if (!loggedIn) { navigate('/login'); return; }
    setBuying(planId);
    try {
      const data = await apiRequest<{ pay_url: string }>('/api/pay/create', {
        method: 'POST',
        body: { plan_id: planId },
      });
      window.location.href = data.pay_url;
    } catch (err) {
      alert(err instanceof Error ? err.message : '创建订单失败');
      setBuying(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400 dark:text-zinc-500" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-bold">选择套餐</h2>
        <p className="text-sm text-slate-500 dark:text-zinc-500 mt-2">升级账户配额，所有密钥共享套餐额度</p>
      </div>

      {/* 套餐卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
        {plans.map((plan) => {
          const isPopular = plan.id === 'standard';
          const features = planFeatures[plan.id] || [];
          const badge = planBadges[plan.id];

          return (
            <div
              key={plan.id}
              className={`relative border rounded-xl p-6 flex flex-col transition ${
                isPopular
                  ? 'border-indigo-500 dark:border-white bg-white dark:bg-[#0a0a0a] ring-1 ring-indigo-200 dark:ring-white/20'
                  : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-[#0a0a0a] hover:border-slate-300 dark:hover:border-zinc-600'
              }`}
            >
              {badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-indigo-600 dark:bg-white text-white dark:text-black text-xs font-semibold rounded-full whitespace-nowrap">
                  {badge}
                </div>
              )}

              <div className="mb-4">
                <h3 className="text-lg font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">¥{plan.price}</span>
                  
                </div>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-600 dark:text-zinc-400">
                    <Check className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0 mt-0.5" />
                    {' '}{f}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleBuy(plan.id)}
                disabled={buying === plan.id}
                className={`w-full py-2.5 rounded-lg text-sm font-medium transition disabled:opacity-50 ${
                  isPopular
                    ? 'bg-indigo-600 dark:bg-white text-white dark:text-black hover:bg-indigo-700 dark:hover:bg-zinc-200'
                    : 'border border-slate-300 dark:border-zinc-700 text-slate-700 dark:text-zinc-300 hover:border-slate-400 dark:hover:border-zinc-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {buying === plan.id ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> 跳转支付...
                  </span>
                ) : (
                  '立即购买'
                )}
              </button>
            </div>
          );
        })}
      </div>

      {/* 免费版说明 */}
      <div className="max-w-4xl mx-auto mt-8 p-4 border border-slate-200 dark:border-zinc-800 rounded-xl text-center bg-white dark:bg-transparent">
        <p className="text-sm text-slate-500 dark:text-zinc-500">
          <Globe className="w-4 h-4 inline -mt-0.5 mr-1" />
          注册即送 <strong className="text-slate-700 dark:text-zinc-300">试用版</strong>（100 次请求），无需付费即可体验全部模型
        </p>
      </div>
    </div>
  );
}
