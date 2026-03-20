import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { getUser, clearAuth, isAdmin } from '../lib/auth';
import { Key, BarChart3, Users, LogOut, ChevronDown, User, CreditCard } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { ThemeToggle } from './ThemeProvider';

export default function DashboardLayout() {
  const user = getUser();
  const navigate = useNavigate();
  const admin = isAdmin();
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleLogout = () => {
    clearAuth();
    navigate('/login');
  };

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const navItems = [
    { to: '/tokens', label: '密钥管理', icon: Key },
    { to: '/pricing', label: '购买套餐', icon: CreditCard },
    { to: '/stats', label: '用量统计', icon: BarChart3 },
    { to: '/account', label: '账户信息', icon: User },
    ...(admin ? [{ to: '/users', label: '用户管理', icon: Users }] : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black">
      {/* Top navbar */}
      <header className="sticky top-0 z-50 border-b border-slate-200 dark:border-zinc-900 bg-white/80 dark:bg-black/80 backdrop-blur-lg">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-14 flex items-center justify-between">
          {/* Left: Logo + Nav */}
          <div className="flex items-center gap-8">
            <NavLink to="/" className="flex items-center gap-2">
              <img src="/logo.svg" alt="AI Gateway" className="w-7 h-7 rounded-md" />
              <span className="text-sm font-bold tracking-tight">AI Gateway</span>
            </NavLink>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition ${
                      isActive
                        ? 'text-slate-900 dark:text-white bg-slate-100 dark:bg-zinc-900'
                        : 'text-slate-500 dark:text-zinc-500 hover:text-slate-700 dark:hover:text-zinc-300'
                    }`
                  }
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right: Theme toggle + User menu */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setUserMenuOpen(!userMenuOpen)}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white rounded-md hover:bg-slate-100 dark:hover:bg-zinc-900 transition"
              >
                <div className="w-6 h-6 bg-slate-200 dark:bg-zinc-800 border border-slate-300 dark:border-zinc-700 rounded-full flex items-center justify-center text-xs font-medium text-slate-700 dark:text-white">
                  {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-sm">{user?.name || user?.email || '用户'}</span>
                <ChevronDown className="w-3.5 h-3.5" />
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-[#111] border border-slate-200 dark:border-zinc-800 rounded-lg shadow-xl py-1 z-50">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-zinc-800">
                    <p className="text-sm font-medium truncate">{user?.name || user?.email}</p>
                    <p className="text-xs text-slate-500 dark:text-zinc-500">{user?.role === 'admin' ? '管理员' : '用户'}</p>
                  </div>
                  {/* Mobile nav items */}
                  <div className="md:hidden border-b border-slate-100 dark:border-zinc-800">
                    {navItems.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-zinc-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-zinc-900 transition"
                      >
                        <item.icon className="w-3.5 h-3.5" />
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-500 dark:text-zinc-400 hover:text-red-500 dark:hover:text-red-400 hover:bg-slate-50 dark:hover:bg-zinc-900 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    退出登录
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 md:px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
