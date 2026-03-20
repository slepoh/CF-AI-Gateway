import { useNavigate } from 'react-router-dom';
import { isLoggedIn } from '../lib/auth';
import { apiRequest } from '../lib/api';
import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Boxes, Shield, ArrowRight, BarChart3, Key, Globe, Check, Code, Copy,
  Zap, Terminal, Sparkles, ChevronRight, Menu, X,
} from 'lucide-react';
import { ThemeToggle } from '../components/ThemeProvider';

interface Plan {
  id: string;
  name: string;
  price: number;
  rpm: number;
  total_limit: number;
}

/* ── Intersection Observer hook for scroll animations ── */
function useInView(threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setInView(true); obs.unobserve(el); } },
      { threshold },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold]);
  return { ref, inView };
}

/* ── Animated counter ── */
function AnimatedCounter({ target, suffix = '' }: { target: string; suffix?: string }) {
  const [display, setDisplay] = useState(target);
  const { ref, inView } = useInView(0.3);

  useEffect(() => {
    if (!inView) return;
    const num = parseInt(target.replace(/[^0-9]/g, ''));
    if (isNaN(num)) { setDisplay(target); return; }
    const prefix = target.replace(/[0-9.+<]+/g, '').replace(suffix, '');
    const hasPlus = target.includes('+');
    const hasLt = target.includes('<');
    let frame = 0;
    const totalFrames = 40;
    const timer = setInterval(() => {
      frame++;
      const progress = frame / totalFrames;
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(num * eased);
      setDisplay(`${hasLt ? '<' : ''}${prefix}${current}${hasPlus ? '+' : ''}${suffix}`);
      if (frame >= totalFrames) clearInterval(timer);
    }, 30);
    return () => clearInterval(timer);
  }, [inView, target, suffix]);

  return <span ref={ref as React.RefObject<HTMLSpanElement>}>{display}</span>;
}

/* ── Typing effect for code ── */
function TypedCode({ code, active }: { code: string; active: boolean }) {
  const [displayed, setDisplayed] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!active) { setDisplayed(code); setDone(true); return; }
    setDisplayed('');
    setDone(false);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayed(code.slice(0, i));
      if (i >= code.length) { setDone(true); clearInterval(timer); }
    }, 12);
    return () => clearInterval(timer);
  }, [code, active]);

  return (
    <span>
      {displayed}
      {!done && <span className="inline-block w-[2px] h-[1.1em] bg-indigo-400 ml-0.5 animate-pulse align-middle" />}
    </span>
  );
}

export default function LandingPage() {
  const navigate = useNavigate();
  const loggedIn = isLoggedIn();

  const [plans, setPlans] = useState<Plan[]>([]);
  const [copied, setCopied] = useState(false);
  const [codeTab, setCodeTab] = useState<'curl' | 'python' | 'js'>('curl');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    apiRequest<{ plans: Plan[] }>('/api/plans')
      .then((data) => setPlans(data.plans))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handler, { passive: true });
    return () => window.removeEventListener('scroll', handler);
  }, []);

  const codeExamples: Record<string, string> = {
    curl: `curl https://your-domain.example/v1/chat/completions \\
  -H "Authorization: Bearer sk-your-key" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "claude-4.6-sonnet",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'`,
    python: `from openai import OpenAI

client = OpenAI(
    api_key="sk-your-key",
    base_url="https://your-domain.example/v1"
)

resp = client.chat.completions.create(
    model="claude-4.6-sonnet",
    messages=[{"role": "user", "content": "Hello!"}]
)
print(resp.choices[0].message.content)`,
    js: `import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'sk-your-key',
  baseURL: 'https://your-domain.example/v1',
});

const resp = await client.chat.completions.create({
  model: 'claude-4.6-sonnet',
  messages: [{ role: 'user', content: 'Hello!' }],
});
console.log(resp.choices[0].message.content);`,
  };

  const handleCopyCode = useCallback(() => {
    navigator.clipboard.writeText(codeExamples[codeTab]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [codeTab]);

  const models = [
    { name: 'Claude 4.6 Opus', isNew: true, color: 'from-orange-400 to-amber-500' },
    { name: 'Claude 4.6 Sonnet', isNew: true, color: 'from-orange-400 to-amber-500' },
    { name: 'Gemini 3.0 Pro', isNew: true, color: 'from-blue-400 to-cyan-500' },
    { name: 'GPT-4o', isNew: false, color: 'from-emerald-400 to-green-500' },
    { name: 'DeepSeek V3', isNew: false, color: 'from-violet-400 to-purple-500' },
    { name: 'Qwen3 Coder', isNew: false, color: 'from-sky-400 to-blue-500' },
    { name: 'GLM-5', isNew: false, color: 'from-rose-400 to-pink-500' },
    { name: 'Kimi K2.5', isNew: false, color: 'from-teal-400 to-cyan-500' },
  ];

  const features = [
    {
      icon: Boxes,
      title: '50+ 模型统一接入',
      desc: 'Claude、Gemini、GPT、DeepSeek、Qwen……一个 base_url 任意切换，无需管理多个 Key。',
      gradient: 'from-violet-500 to-purple-600',
    },
    {
      icon: Code,
      title: '100% OpenAI 兼容',
      desc: '标准 /v1/chat/completions 接口，所有 OpenAI SDK 和工具直接使用。',
      gradient: 'from-cyan-500 to-blue-600',
    },
    {
      icon: Globe,
      title: '全球边缘加速',
      desc: 'Cloudflare 300+ 节点就近处理，首字响应低至毫秒级。',
      gradient: 'from-emerald-500 to-teal-600',
    },
    {
      icon: Shield,
      title: '企业级安全',
      desc: 'PBKDF2 密码加密、JWT 认证、密钥级 RPM 限制与配额管控。',
      gradient: 'from-amber-500 to-orange-600',
    },
    {
      icon: BarChart3,
      title: '实时用量分析',
      desc: '按模型、按天追踪 Token 消耗，可视化仪表盘一目了然。',
      gradient: 'from-pink-500 to-rose-600',
    },
    {
      icon: Key,
      title: '灵活密钥管理',
      desc: '按项目创建独立密钥，灵活分配配额，团队协作无忧。',
      gradient: 'from-indigo-500 to-violet-600',
    },
  ];

  const planLabels: Record<string, string> = {
    free: '试用版',
    basic: '基础版',
    standard: '标准版',
    pro: '专业版',
  };

  const popularPlans: Record<string, boolean> = { standard: true };
  const planEmoji: Record<string, string> = { free: '🌱', basic: '🚀', standard: '⚡', pro: '💎' };

  /* ── Section animation helpers ── */
  const heroObs = useInView(0.1);
  const modelObs = useInView(0.15);
  const featObs = useInView(0.1);
  const quickObs = useInView(0.1);
  const pricingObs = useInView(0.1);
  const ctaObs = useInView(0.15);

  const navLinks = [
    { label: '产品', href: '#features' },
    { label: '定价', href: '#pricing' },
    { label: '文档', href: '#quickstart' },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-slate-900 dark:text-white antialiased overflow-x-hidden">
      {/* ═══════ Inline keyframes via style tag ═══════ */}
      <style>{`
        @keyframes aurora-shift {
          0%, 100% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(2%, -3%) scale(1.05); }
          50% { transform: translate(-1%, 2%) scale(0.98); }
          75% { transform: translate(-3%, -1%) scale(1.03); }
        }
        @keyframes aurora-shift-2 {
          0%, 100% { transform: translate(0, 0) rotate(0deg) scale(1); }
          33% { transform: translate(-4%, 3%) rotate(2deg) scale(1.06); }
          66% { transform: translate(3%, -2%) rotate(-1deg) scale(0.97); }
        }
        @keyframes aurora-shift-3 {
          0%, 100% { transform: translate(0, 0) scale(1.02); }
          50% { transform: translate(5%, 4%) scale(0.95); }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-12px); }
        }
        @keyframes pulse-ring {
          0% { transform: scale(0.9); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 0.3; }
          100% { transform: scale(0.9); opacity: 0.6; }
        }
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes slide-up {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slide-up-delayed {
          0%, 30% { opacity: 0; transform: translateY(30px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes fade-in {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .animate-aurora-1 { animation: aurora-shift 10s ease-in-out infinite; }
        .animate-aurora-2 { animation: aurora-shift-2 12s ease-in-out infinite; }
        .animate-aurora-3 { animation: aurora-shift-3 8s ease-in-out infinite; }
        .animate-float { animation: float 6s ease-in-out infinite; }
        .animate-pulse-ring { animation: pulse-ring 3s ease-in-out infinite; }
        .animate-gradient-x { animation: gradient-x 6s ease infinite; background-size: 200% 200%; }
        .anim-slide-up { animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) both; }
        .anim-slide-up-d1 { animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.1s both; }
        .anim-slide-up-d2 { animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.2s both; }
        .anim-slide-up-d3 { animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.3s both; }
        .anim-slide-up-d4 { animation: slide-up 0.8s cubic-bezier(0.16, 1, 0.3, 1) 0.4s both; }
        .anim-fade { animation: fade-in 1s ease both; }
      `}</style>

      {/* ═══════ Nav ═══════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? 'bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl shadow-lg shadow-black/[0.03] dark:shadow-black/20 border-b border-slate-200/50 dark:border-zinc-800/50'
          : 'bg-transparent'
      }`}>
        <div className="flex items-center justify-between px-5 md:px-10 py-4 max-w-7xl mx-auto">
          <a href="/" className="flex items-center gap-2.5 group">
            <div className="relative">
              <img src="/logo.svg" alt="AI Gateway" className="w-8 h-8 rounded-lg relative z-10" />
              <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-xl opacity-0 group-hover:opacity-40 blur-md transition-opacity duration-500" />
            </div>
            <span className="text-lg font-bold tracking-tight">AI Gateway</span>
          </a>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="px-4 py-2 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition-colors rounded-lg hover:bg-slate-100/60 dark:hover:bg-zinc-800/60"
              >
                {l.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            {loggedIn ? (
              <button
                onClick={() => navigate('/tokens')}
                className="hidden sm:flex items-center gap-1.5 px-5 py-2.5 text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-full hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-0.5"
              >
                控制台 <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  onClick={() => navigate('/login')}
                  className="px-4 py-2.5 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition font-medium rounded-lg hover:bg-slate-100/60 dark:hover:bg-zinc-800/60"
                >
                  登录
                </button>
                <button
                  onClick={() => navigate('/register')}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-full hover:shadow-lg hover:shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-0.5"
                >
                  免费注册 <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 transition"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white/95 dark:bg-zinc-950/95 backdrop-blur-xl border-t border-slate-200/50 dark:border-zinc-800/50 px-5 pb-5 anim-fade">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMobileMenuOpen(false)}
                className="block py-3 text-sm text-slate-600 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white transition"
              >
                {l.label}
              </a>
            ))}
            <div className="pt-3 border-t border-slate-200/50 dark:border-zinc-800/50 flex gap-3">
              {loggedIn ? (
                <button onClick={() => navigate('/tokens')} className="w-full py-3 text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-full">
                  控制台
                </button>
              ) : (
                <>
                  <button onClick={() => navigate('/login')} className="flex-1 py-3 text-sm text-slate-600 dark:text-zinc-300 font-medium rounded-full border border-slate-200 dark:border-zinc-700">
                    登录
                  </button>
                  <button onClick={() => navigate('/register')} className="flex-1 py-3 text-sm bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-full">
                    免费注册
                  </button>
                </>
              )}
            </div>
          </div>
        )}
      </nav>

      {/* ═══════ Hero – Aurora ═══════ */}
      <section ref={heroObs.ref} className="relative overflow-hidden min-h-[100dvh] flex items-center bg-gradient-to-b from-slate-50 to-white dark:from-zinc-950 dark:to-zinc-900">
        {/* Aurora blobs – light */}
        <div className="absolute inset-0 -z-20 dark:hidden">
          <div className="animate-aurora-1 absolute -top-[20%] -right-[10%] w-[70vw] h-[60vh] rounded-full opacity-40"
            style={{ background: 'radial-gradient(ellipse at center, rgba(129,140,248,0.6), transparent 70%)' }} />
          <div className="animate-aurora-2 absolute top-[10%] -left-[15%] w-[60vw] h-[55vh] rounded-full opacity-35"
            style={{ background: 'radial-gradient(ellipse at center, rgba(34,211,238,0.5), transparent 70%)' }} />
          <div className="animate-aurora-3 absolute bottom-[0%] right-[5%] w-[50vw] h-[50vh] rounded-full opacity-30"
            style={{ background: 'radial-gradient(ellipse at center, rgba(192,132,252,0.5), transparent 70%)' }} />
          <div className="animate-aurora-2 absolute bottom-[10%] left-[20%] w-[40vw] h-[35vh] rounded-full opacity-25"
            style={{ background: 'radial-gradient(ellipse at center, rgba(251,191,36,0.35), transparent 70%)' }} />
        </div>
        {/* Aurora blobs – dark */}
        <div className="absolute inset-0 -z-20 hidden dark:block">
          <div className="animate-aurora-1 absolute -top-[20%] -right-[10%] w-[70vw] h-[60vh] rounded-full opacity-30"
            style={{ background: 'radial-gradient(ellipse at center, rgba(79,70,229,0.5), transparent 70%)' }} />
          <div className="animate-aurora-2 absolute top-[10%] -left-[15%] w-[60vw] h-[55vh] rounded-full opacity-25"
            style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.4), transparent 70%)' }} />
          <div className="animate-aurora-3 absolute bottom-[0%] right-[5%] w-[50vw] h-[50vh] rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse at center, rgba(147,51,234,0.4), transparent 70%)' }} />
          <div className="animate-aurora-2 absolute bottom-[10%] left-[20%] w-[40vw] h-[35vh] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse at center, rgba(217,119,6,0.25), transparent 70%)' }} />
        </div>
        {/* Dot grid */}
        <div className="absolute inset-0 -z-10 opacity-[0.03] dark:opacity-[0.04]"
          style={{ backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

        <div className="max-w-7xl mx-auto px-5 md:px-10 pt-28 pb-16 md:pt-32 md:pb-24 w-full">
          <div className={`max-w-4xl transition-all duration-1000 ${heroObs.inView ? 'opacity-100' : 'opacity-0 translate-y-8'}`}>
            {/* Badge */}
            <div className="anim-slide-up inline-flex items-center gap-2.5 px-4 py-2 bg-white/60 dark:bg-white/[0.06] backdrop-blur-sm border border-slate-200/60 dark:border-white/10 rounded-full text-xs font-semibold text-indigo-600 dark:text-indigo-400 mb-8 shadow-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Claude 4.6 · Gemini 3.0 · 50+ 模型已上线</span>
              <ChevronRight className="w-3 h-3 opacity-50" />
            </div>

            {/* Headline */}
            <h1 className="anim-slide-up-d1 text-[2.75rem] sm:text-6xl md:text-7xl lg:text-[5.5rem] font-extrabold tracking-tight leading-[1.06]">
              <span className="block">一个端点</span>
              <span className="block mt-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 bg-clip-text text-transparent animate-gradient-x">
                连接所有 AI 模型
              </span>
            </h1>

            {/* Subtitle */}
            <p className="anim-slide-up-d2 mt-7 text-lg sm:text-xl md:text-2xl text-slate-500 dark:text-zinc-400 max-w-2xl leading-relaxed font-light">
              OpenAI 兼容 API，即刻接入 Claude、Gemini、GPT、DeepSeek 等 50+ 大语言模型。<span className="text-indigo-600 dark:text-indigo-400 font-medium">注册即送免费额度</span>。
            </p>

            {/* CTA */}
            <div className="anim-slide-up-d3 mt-10 flex flex-col sm:flex-row items-start gap-4">
              <button
                onClick={() => navigate(loggedIn ? '/tokens' : '/register')}
                className="group relative flex items-center gap-2.5 px-8 py-4 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-semibold rounded-full transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/30 hover:-translate-y-0.5 text-sm"
              >
                <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-600 to-violet-600 rounded-full blur-lg opacity-40 group-hover:opacity-60 transition-opacity" />
                <span className="relative flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  {loggedIn ? '进入控制台' : '免费开始使用'}
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </span>
              </button>
              <a
                href="#quickstart"
                className="group flex items-center gap-2 px-8 py-4 text-slate-600 dark:text-zinc-300 font-medium hover:text-slate-900 dark:hover:text-white transition text-sm rounded-full border border-slate-200/60 dark:border-zinc-700/60 hover:border-slate-300 dark:hover:border-zinc-600 hover:bg-white/50 dark:hover:bg-white/5 backdrop-blur-sm"
              >
                <Terminal className="w-4 h-4" />
                查看代码示例
                <ChevronRight className="w-3.5 h-3.5 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
              </a>
            </div>
          </div>

          {/* Stats */}
          <div className={`anim-slide-up-d4 mt-20 pt-10 border-t border-slate-200/40 dark:border-zinc-800/40 transition-all duration-1000 delay-300 ${heroObs.inView ? 'opacity-100' : 'opacity-0 translate-y-8'}`}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">
              {[
                { v: '53+', l: 'AI 模型', icon: Boxes },
                { v: '99.9%', l: '服务可用性', icon: Shield },
                { v: '<1s', l: '首字响应', icon: Zap },
                { v: '300+', l: '全球边缘节点', icon: Globe },
              ].map((s) => (
                <div key={s.l} className="group">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20 flex items-center justify-center">
                      <s.icon className="w-5 h-5 text-indigo-500 dark:text-indigo-400" />
                    </div>
                    <p className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-zinc-300 bg-clip-text text-transparent">
                      <AnimatedCounter target={s.v} />
                    </p>
                  </div>
                  <p className="text-sm text-slate-500 dark:text-zinc-500 pl-[52px]">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ Model Showcase ═══════ */}
      <section
        ref={modelObs.ref}
        className="relative py-16 md:py-20 border-y border-slate-100 dark:border-zinc-800/80 bg-gradient-to-b from-slate-50/80 to-white dark:from-zinc-900/50 dark:to-zinc-950/50"
      >
        {/* subtle aurora stripe */}
        <div className="absolute inset-0 -z-10 overflow-hidden opacity-10 dark:opacity-20">
          <div className="animate-aurora-1 absolute top-0 left-[10%] w-[40vw] h-[200px] rounded-full"
            style={{ background: 'radial-gradient(ellipse at center, rgba(129,140,248,0.3), transparent 70%)' }} />
          <div className="animate-aurora-3 absolute top-0 right-[10%] w-[30vw] h-[200px] rounded-full"
            style={{ background: 'radial-gradient(ellipse at center, rgba(192,132,252,0.25), transparent 70%)' }} />
        </div>

        <div className={`max-w-7xl mx-auto px-5 md:px-10 transition-all duration-700 ${modelObs.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-[0.2em] text-center mb-8">
            支持的模型
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {models.map((m, i) => (
              <span
                key={m.name}
                className="group relative inline-flex items-center gap-2.5 px-5 py-2.5 bg-white dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-700/80 rounded-full text-sm font-medium text-slate-700 dark:text-zinc-300 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 cursor-default backdrop-blur-sm"
                style={{ animationDelay: `${i * 60}ms` }}
              >
                <div className={`w-2 h-2 rounded-full bg-gradient-to-r ${m.color}`} />
                {m.name}
                {m.isNew && (
                  <span className="text-[10px] font-bold bg-gradient-to-r from-indigo-500 to-violet-500 text-white px-2 py-0.5 rounded-full shadow-sm">
                    NEW
                  </span>
                )}
                {/* hover glow */}
                <div className={`absolute -inset-0.5 bg-gradient-to-r ${m.color} rounded-full opacity-0 group-hover:opacity-10 blur-md transition-opacity duration-300`} />
              </span>
            ))}
            <span className="text-sm text-slate-400 dark:text-zinc-500 ml-2 font-medium">+45 more</span>
          </div>
        </div>
      </section>

      {/* ═══════ Features ═══════ */}
      <section id="features" className="relative py-24 md:py-32 overflow-hidden bg-white dark:bg-transparent">
        {/* ambient aurora behind features */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="animate-aurora-2 absolute top-[20%] right-[-5%] w-[40vw] h-[40vh] rounded-full opacity-15 dark:opacity-10"
            style={{ background: 'radial-gradient(ellipse at center, rgba(79,70,229,0.4), transparent 70%)' }} />
          <div className="animate-aurora-3 absolute bottom-[10%] left-[-5%] w-[35vw] h-[35vh] rounded-full opacity-10 dark:opacity-8"
            style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.3), transparent 70%)' }} />
        </div>

        <div ref={featObs.ref} className="max-w-7xl mx-auto px-5 md:px-10">
          <div className={`max-w-2xl mb-16 transition-all duration-700 ${featObs.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-5">
              <Sparkles className="w-3 h-3" />
              产品特性
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
              为开发者构建的
              <br />
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600 bg-clip-text text-transparent">
                AI 基础设施
              </span>
            </h2>
            <p className="mt-5 text-lg text-slate-500 dark:text-zinc-400 leading-relaxed">
              简洁的 API、可靠的服务、透明的计费。专注构建产品，把模型接入交给我们。
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
            {features.map((f, i) => (
              <div
                key={f.title}
                className={`group relative p-7 md:p-8 rounded-2xl border border-transparent hover:border-slate-200/80 dark:hover:border-zinc-700/60 bg-white/50 dark:bg-zinc-900/30 hover:bg-white dark:hover:bg-zinc-900/60 backdrop-blur-sm transition-all duration-500 hover:shadow-xl hover:shadow-black/[0.03] dark:hover:shadow-black/20 hover:-translate-y-1 ${
                  featObs.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                }`}
                style={{ transitionDelay: `${i * 80}ms` }}
              >
                {/* gradient bar top */}
                <div className={`absolute top-0 left-8 right-8 h-[2px] bg-gradient-to-r ${f.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-full`} />

                <div className={`w-12 h-12 bg-gradient-to-br ${f.gradient} rounded-xl flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/10 group-hover:scale-110 transition-transform duration-300`}>
                  <f.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold mb-2.5 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{f.title}</h3>
                <p className="text-sm text-slate-500 dark:text-zinc-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════ Quick Start (dark section with code) ═══════ */}
      <section id="quickstart" className="relative bg-slate-50 dark:bg-[#0b0e14] text-slate-900 dark:text-white overflow-hidden">
        {/* Aurora in dark section */}
        <div className="absolute inset-0 -z-10 overflow-hidden hidden dark:block">
          <div className="animate-aurora-1 absolute -top-[20%] right-[10%] w-[50vw] h-[40vh] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse at center, rgba(79,70,229,0.5), transparent 70%)' }} />
          <div className="animate-aurora-3 absolute bottom-[-10%] left-[5%] w-[40vw] h-[30vh] rounded-full opacity-10"
            style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.4), transparent 70%)' }} />
        </div>
        {/* Grid lines */}
        <div className="absolute inset-0 -z-10 opacity-[0.02] dark:opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(to right, #6366f1 1px, transparent 1px), linear-gradient(to bottom, #6366f1 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div ref={quickObs.ref} className="max-w-7xl mx-auto px-5 md:px-10 py-24 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center">
            {/* Left */}
            <div className={`transition-all duration-700 ${quickObs.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-200 dark:border-indigo-500/20 rounded-full text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-5">
                <Terminal className="w-3 h-3" />
                快速开始
              </div>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight leading-tight">
                三行代码
                <br />
                <span className="bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 dark:from-cyan-400 dark:via-indigo-400 dark:to-purple-400 bg-clip-text text-transparent">
                  接入所有模型
                </span>
              </h2>
              <p className="mt-5 text-lg text-slate-600 dark:text-slate-400 leading-relaxed">
                替换{' '}
                <code className="text-sm bg-indigo-50 dark:bg-white/10 px-2.5 py-1 rounded-lg font-mono text-indigo-600 dark:text-indigo-300 border border-indigo-200 dark:border-white/5">base_url</code>
                ，其他代码一行不改。支持所有 OpenAI SDK。
              </p>

              <div className="mt-10 space-y-4">
                {[
                  { n: '1', title: '注册账号', desc: '邮箱验证，30 秒完成', icon: Sparkles },
                  { n: '2', title: '获取 API Key', desc: '注册后自动生成', icon: Key },
                  { n: '3', title: '开始调用', desc: '替换 base_url 即可', icon: Zap },
                ].map((step, i) => (
                  <div
                    key={step.n}
                    className={`group flex items-start gap-4 p-4 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5 transition-all duration-300 ${
                      quickObs.inView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-8'
                    }`}
                    style={{ transitionDelay: `${300 + i * 100}ms` }}
                  >
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-violet-600 text-white font-bold rounded-xl flex items-center justify-center text-sm shrink-0 shadow-lg shadow-indigo-500/20 group-hover:scale-110 transition-transform">
                      {step.n}
                    </div>
                    <div>
                      <p className="font-semibold text-sm flex items-center gap-2">
                        {step.title}
                        <step.icon className="w-3.5 h-3.5 text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">{step.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={() => navigate(loggedIn ? '/tokens' : '/register')}
                className="mt-8 group flex items-center gap-2 px-7 py-3.5 bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-semibold rounded-full hover:shadow-xl hover:shadow-indigo-500/25 transition-all duration-300 hover:-translate-y-0.5 text-sm"
              >
                {loggedIn ? '进入控制台' : '免费注册'}
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
              </button>
            </div>

            {/* Right – Code Block */}
            <div className={`transition-all duration-700 delay-200 ${quickObs.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
              <div className="relative group">
                {/* glow behind code block */}
                <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 via-purple-500/20 to-cyan-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />

                <div className="relative bg-[#111827] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl shadow-black/30">
                  {/* Window chrome */}
                  <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/[0.06] bg-[#0d1117]">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full bg-red-500/80" />
                        <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                        <div className="w-3 h-3 rounded-full bg-green-500/80" />
                      </div>
                      <div className="flex items-center gap-1">
                        {(['curl', 'python', 'js'] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setCodeTab(tab)}
                            className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all duration-200 ${
                              codeTab === tab
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-white/10 dark:text-white shadow-inner'
                                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5'
                            }`}
                          >
                            {tab === 'curl' ? 'cURL' : tab === 'python' ? 'Python' : 'Node.js'}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleCopyCode}
                      className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                      {copied ? '已复制' : '复制'}
                    </button>
                  </div>
                  <pre className="p-5 text-[13px] text-slate-700 dark:text-slate-300 overflow-x-auto leading-relaxed font-mono min-h-[240px]">
                    <code>
                      <TypedCode code={codeExamples[codeTab]} active={quickObs.inView} />
                    </code>
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════ Pricing ═══════ */}
      <section id="pricing" className="relative py-24 md:py-32 overflow-hidden bg-slate-50/50 dark:bg-transparent">
        {/* subtle aurora */}
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="animate-aurora-1 absolute top-[10%] left-[20%] w-[40vw] h-[40vh] rounded-full opacity-10 dark:opacity-8"
            style={{ background: 'radial-gradient(ellipse at center, rgba(129,140,248,0.3), transparent 70%)' }} />
          <div className="animate-aurora-2 absolute bottom-[0%] right-[10%] w-[30vw] h-[30vh] rounded-full opacity-8 dark:opacity-6"
            style={{ background: 'radial-gradient(ellipse at center, rgba(192,132,252,0.25), transparent 70%)' }} />
        </div>

        <div ref={pricingObs.ref} className="max-w-7xl mx-auto px-5 md:px-10">
          <div className={`text-center mb-16 transition-all duration-700 ${pricingObs.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 rounded-full text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-5">
              <Zap className="w-3 h-3" />
              定价
            </div>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold tracking-tight">
              简单透明的定价
            </h2>
            <p className="mt-5 text-lg text-slate-500 dark:text-zinc-400 max-w-xl mx-auto">
              免费开始，按需升级。无隐藏费用。
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl mx-auto">
            {plans.map((plan, i) => {
              const isPopular = popularPlans[plan.id];
              return (
                <div
                  key={plan.id}
                  className={`group relative p-7 rounded-2xl transition-all duration-500 hover:-translate-y-2 ${
                    pricingObs.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
                  } ${
                    isPopular
                      ? 'bg-gradient-to-b from-indigo-600 via-indigo-600 to-violet-700 text-white shadow-2xl shadow-indigo-500/25 scale-[1.03] z-10 border-indigo-500'
                      : 'bg-white dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800/80 hover:border-indigo-200 dark:hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5'
                  }`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  {isPopular && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-amber-400 to-orange-400 text-amber-900 text-[10px] font-bold rounded-full shadow-lg">
                      🔥 最受欢迎
                    </div>
                  )}

                  <div className="flex items-center gap-2 mb-4">
                    <span className="text-lg">{planEmoji[plan.id] || '📦'}</span>
                    <p className={`text-sm font-bold ${isPopular ? 'text-indigo-100' : 'text-slate-500 dark:text-zinc-500'}`}>
                      {planLabels[plan.id] || plan.name}
                    </p>
                  </div>

                  <div className="flex items-baseline gap-1">
                    <span className={`text-4xl font-extrabold ${isPopular ? "text-white" : "text-slate-900 dark:text-white"}`}>
                      {plan.price > 0 ? `¥${plan.price}` : '¥0'}
                    </span>
                  </div>

                  <ul className="mt-6 space-y-3">
                    {[
                      `${plan.rpm} 请求/分钟`,
                      `${plan.total_limit.toLocaleString()} 次调用`,
                      '全部 50+ 模型',
                      '技术支持',
                    ].map((f) => (
                      <li
                        key={f}
                        className={`flex items-center gap-2.5 text-sm ${
                          isPopular ? 'text-indigo-100' : 'text-slate-600 dark:text-zinc-400'
                        }`}
                      >
                        <Check className={`w-4 h-4 shrink-0 ${isPopular ? 'text-white' : 'text-indigo-500 dark:text-indigo-400'}`} />
                        {f}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => navigate(loggedIn ? '/pricing' : '/register')}
                    className={`w-full mt-8 py-3 text-sm font-semibold rounded-full transition-all duration-300 ${
                      isPopular
                        ? 'bg-white text-indigo-600 hover:bg-indigo-50 shadow-lg hover:shadow-xl'
                        : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-zinc-100 hover:shadow-lg'
                    }`}
                  >
                    {plan.price > 0 ? '立即升级' : '免费开始'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════ Final CTA ═══════ */}
      <section ref={ctaObs.ref} className="relative overflow-hidden">
        {/* gradient bg with aurora effect */}
        <div className="absolute inset-0 -z-20 bg-gradient-to-br from-indigo-500 via-purple-500 to-violet-600 dark:from-indigo-600 dark:via-purple-600 dark:to-violet-700" />
        <div className="absolute inset-0 -z-10 overflow-hidden">
          <div className="animate-aurora-1 absolute -top-[30%] left-[10%] w-[50vw] h-[50vh] rounded-full opacity-20"
            style={{ background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.2), transparent 70%)' }} />
          <div className="animate-aurora-3 absolute bottom-[-20%] right-[10%] w-[40vw] h-[40vh] rounded-full opacity-15"
            style={{ background: 'radial-gradient(ellipse at center, rgba(6,182,212,0.3), transparent 70%)' }} />
        </div>
        {/* dot pattern */}
        <div className="absolute inset-0 -z-10 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className={`max-w-4xl mx-auto px-5 md:px-10 py-24 md:py-32 text-center transition-all duration-700 ${ctaObs.inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-xs font-semibold text-white/80 mb-8">
            <Sparkles className="w-3 h-3" />
            立即开始，完全免费
          </div>
          <h2 className="text-4xl sm:text-5xl md:text-6xl font-extrabold text-white tracking-tight leading-tight">
            准备好了吗？
            <br />
            <span className="text-indigo-200">开始构建下一个 AI 应用</span>
          </h2>
          <p className="mt-6 text-xl text-indigo-100/80 max-w-xl mx-auto leading-relaxed">
            注册即送免费额度。无需信用卡，无需绑定手机。
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => navigate(loggedIn ? '/tokens' : '/register')}
              className="group relative flex items-center gap-2.5 px-10 py-4 bg-white text-indigo-700 font-bold rounded-full transition-all duration-300 hover:bg-indigo-50 hover:shadow-2xl hover:shadow-black/10 hover:-translate-y-0.5 text-sm"
            >
              <Sparkles className="w-4 h-4" />
              {loggedIn ? '进入控制台' : '免费注册，立即体验'}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
            <a
              href="#quickstart"
              className="flex items-center gap-2 px-8 py-4 text-white/80 hover:text-white font-medium transition text-sm border border-white/20 rounded-full hover:bg-white/10 backdrop-blur-sm"
            >
              <Code className="w-4 h-4" />
              查看文档
            </a>
          </div>
        </div>
      </section>

      {/* ═══════ Footer ═══════ */}
      <footer className="border-t border-slate-200/60 dark:border-zinc-800/60 bg-white dark:bg-zinc-950">
        <div className="max-w-7xl mx-auto px-5 md:px-10 py-10">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img src="/logo.svg" alt="AI Gateway" className="w-5 h-5 rounded" />
              <span className="text-sm text-slate-400 dark:text-zinc-500">
                © {new Date().getFullYear()} AI Gateway · 一个端点，连接所有 AI 模型
              </span>
            </div>
            <div className="flex items-center gap-8 text-sm text-slate-400 dark:text-zinc-500">
              <a href="#features" className="hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
                产品
              </a>
              <a href="#pricing" className="hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
                定价
              </a>
              <a href="#quickstart" className="hover:text-slate-700 dark:hover:text-zinc-300 transition-colors">
                文档
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
