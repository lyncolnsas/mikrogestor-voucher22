"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/* ── Icon shortcuts ─────────────────────────────────────────────────── */
const Icon = ({ d, active }: { d: string; active?: boolean }) => (
  <svg className={`w-5 h-5 shrink-0 ${active ? 'text-white' : 'text-[#94a3b8]'}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const ICONS = {
  overview:  "M4 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z",
  profiles:  "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10",
  users:     "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
  portal:    "M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z",
  traffic:   "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 002 2h2a2 2 0 002-2z",
  ppp:       "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
  dhcp:      "M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8v.01M12 12v.01",
  security:  "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  finance:   "M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
  admin:     "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
  logout:    "M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1",
  whatsapp:  "M3 21l1.65-3.8a9 9 0 113.4 2.9L3 21zm5.5-12.5a.5.5 0 00-.5.5c0 1.5 1.5 4 3 5s3.5 1.5 4 .5.5-1 0-1.5l-2-.5c-.5 0-1 .5-1.5 0s-2-1.5-2-2 .5-1 0-1.5l-.5-2c-.5-.5-1 0-1.5 0z",
  leads:     "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  store:     "M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z",
  vpn:       "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
};

const NAV_SECTIONS = [
  {
    label: 'Principal',
    items: [
      { href: '/dashboard',          label: 'Visão Geral',       icon: 'overview'  },
      { href: '/dashboard/leads',    label: 'Leads',             icon: 'leads'     },
    ],
  },
  {
    label: 'Hotspot',
    items: [
      { href: '/dashboard/profiles', label: 'Planos / Perfis',   icon: 'profiles'  },
      { href: '/dashboard/users',    label: 'Central de Vouchers', icon: 'users'   },
      { href: '/dashboard/portal',   label: 'Configurar Portal', icon: 'portal'    },
    ],
  },
  {
    label: 'Serviços & Rede',
    items: [
      { href: '/dashboard/traffic',  label: 'Monitor de Tráfego', icon: 'traffic'  },
      { href: '/dashboard/ppp',      label: 'PPPoE Secrets',     icon: 'ppp'       },
      { href: '/dashboard/dhcp',     label: 'DHCP Leases',       icon: 'dhcp'      },
    ],
  },
  {
    label: 'Administração',
    items: [
      { href: '/dashboard/whatsapp', label: 'Conexão WhatsApp', icon: 'whatsapp' },
      { href: '/dashboard/whatsapp-plans', label: 'Planos WhatsApp', icon: 'store' },
      { href: '/dashboard/security', label: 'Controle de Acesso', icon: 'security' },
      { href: '/dashboard/finance',  label: 'Financeiro / Vendas', icon: 'finance' },
      { href: '/dashboard/admin',    label: 'Roteadores e Sistema', icon: 'admin'  },
      { href: '/dashboard/vpn',      label: 'VPN WireGuard',        icon: 'vpn'    },
    ],
  },
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('mg-theme') as 'light' | 'dark' | null;
      if (saved) return saved;
    }
    return 'light';
  });

  // Sync data-theme + dark class
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const toggleTheme = () => {
    const nextTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    document.documentElement.classList.toggle('dark', nextTheme === 'dark');
    localStorage.setItem('mg-theme', nextTheme);
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (err) {
      console.error('Falha na requisição de logout:', err);
    }
    // Remove também quaisquer cookies legados do cliente
    document.cookie = 'system_auth=; Max-Age=0; path=/';
    document.cookie = 'mikro_session=; Max-Age=0; path=/';
    window.location.href = '/';
  };

  return (
    <div className="saas-theme min-h-screen flex flex-col md:flex-row bg-[var(--mg-app-bg)] text-[var(--mg-text-body)] antialiased transition-colors duration-200">
      {/* ── Mobile top bar ──────────────────────────────────────── */}
      <header
        className="md:hidden sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-[#1a1d2e] border-b border-[#262a3d]"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shrink-0 shadow-md">
            <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9 9 0 0112.14 0" />
            </svg>
          </div>
          <span className="text-sm font-extrabold text-white">
            Mikro<span className="text-blue-400">Gestor</span>
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-xs bg-[#262a3d] border border-slate-700/60 text-slate-200 cursor-pointer"
            title="Alternar Tema Claro / Escuro"
          >
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(v => !v)}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold bg-[#262a3d] border border-slate-700/60 text-slate-200 transition-colors"
          >
            {open ? '✕' : '☰'}
          </button>
        </div>
      </header>

      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/60 md:hidden backdrop-blur-sm"
          onClick={() => setOpen(false)}
        />
      )}

      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside
        className={[
          'saas-sidebar fixed inset-y-0 left-0 z-50 flex flex-col shrink-0',
          'md:sticky md:top-0 md:h-screen md:translate-x-0',
          'transition-[width,transform] duration-300 ease-in-out',
          'print:hidden border-r border-[#262a3d]',
          isCollapsed ? 'w-20' : 'w-[260px]',
          open ? 'translate-x-0' : '-translate-x-full md:translate-x-0',
        ].join(' ')}
      >
        {/* Brand */}
        <div className="mg-sidebar-brand flex items-center justify-between px-4 py-4 border-b border-[#1e2538]">
          <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${isCollapsed ? 'opacity-0 w-0' : 'opacity-100 w-auto'}`}>
            <div className="mg-sidebar-logo-icon">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9 9 0 0112.14 0M1.394 9h.01m21.196 0h.01" />
              </svg>
            </div>
            <div className="whitespace-nowrap">
              <div className="text-[15px] font-extrabold text-white leading-none tracking-tight">
                Mikro<span className="text-blue-400">Gestor</span>
              </div>
              <div className="text-[9.5px] font-semibold text-slate-300 tracking-wider uppercase mt-1">
                Hotspot Gateway
              </div>
            </div>
          </div>
          
          <button 
            type="button" 
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="w-7 h-7 rounded-lg hidden md:flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-800 transition-colors shrink-0"
            title="Alternar Menu Lateral"
          >
            <svg className={`w-4 h-4 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 custom-scrollbar overflow-x-hidden">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-2">
              {/* Section label */}
              <div className={`mg-sidebar-section-label transition-all duration-300 ${isCollapsed ? 'opacity-0 h-0 p-0 overflow-hidden m-0' : 'opacity-100'}`}>
                {section.label}
              </div>
              {isCollapsed && <div className="h-px bg-[#1e293b] mx-4 my-2" />}

              {/* Links */}
              {section.items.map(item => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`mg-nav-link group relative ${active ? 'active' : ''} ${isCollapsed ? 'justify-center px-0' : ''}`}
                    style={{ textDecoration: 'none' }}
                  >
                    {/* Active bar */}
                    {active && <span className="mg-nav-link-indicator" />}
                    <Icon d={ICONS[item.icon as keyof typeof ICONS]} active={active} />
                    <span className={`truncate transition-all duration-300 ${isCollapsed ? 'w-0 opacity-0 hidden' : 'w-auto opacity-100'}`}>
                      {item.label}
                    </span>
                    {active && !isCollapsed && <span className="mg-nav-link-dot" />}

                    {/* Custom CSS Tooltip (Mini-Sidebar) */}
                    {isCollapsed && (
                      <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0F172A] border border-[#1E293B] text-white text-[11px] font-bold tracking-wide rounded-md whitespace-nowrap opacity-0 pointer-events-none translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 z-[999] shadow-[4px_0_20px_rgba(0,0,0,0.45)] flex items-center">
                        <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent border-r-[5px] border-r-[#1E293B]"></div>
                        <div className="absolute -left-[4px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[4px] border-y-transparent border-r-[4px] border-r-[#0F172A] z-10"></div>
                        {item.label}
                      </div>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Footer — user + logout */}
        <div className="mg-sidebar-footer">
          <div className={`flex items-center gap-2.5 mb-3 transition-all duration-300 ${isCollapsed ? 'justify-center' : 'px-2'}`}>
            <div className="mg-sidebar-avatar-badge" title={isCollapsed ? 'Administrador' : undefined}>
              ADM
            </div>
            {!isCollapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-[11.5px] font-bold text-white leading-none truncate">Administrador</p>
                  <p className="text-[9px] mt-0.5 uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block animate-pulse" />
                    Online
                  </p>
                </div>
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="w-7 h-7 rounded-lg flex items-center justify-center text-xs bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700/60 transition-colors cursor-pointer shrink-0"
                  title="Alternar Tema Claro / Escuro"
                >
                  {theme === 'light' ? '🌙' : '☀️'}
                </button>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={handleLogout}
            className={`mg-sidebar-logout-btn group relative ${isCollapsed ? 'justify-center p-2' : ''}`}
          >
            <Icon d={ICONS.logout} />
            {!isCollapsed && <span>Sair do Painel</span>}

            {/* Custom Tooltip Logout */}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-3 py-1.5 bg-[#0F172A] border border-[#1E293B] text-rose-400 text-[11px] font-bold tracking-wide rounded-md whitespace-nowrap opacity-0 pointer-events-none translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-200 z-[999] shadow-[4px_0_20px_rgba(0,0,0,0.45)] flex items-center">
                <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[5px] border-y-transparent border-r-[5px] border-r-[#1E293B]"></div>
                <div className="absolute -left-[4px] top-1/2 -translate-y-1/2 w-0 h-0 border-y-[4px] border-y-transparent border-r-[4px] border-r-[#0F172A] z-10"></div>
                Sair do Painel
              </div>
            )}
          </button>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────── */}
      <main className="flex-1 min-w-0 min-h-screen flex flex-col bg-[var(--mg-app-bg)] transition-colors duration-200">
        {children}
      </main>
    </div>
  );
}
