"use client";

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
} from 'recharts';
import {
  TrendingUp,
  ShoppingBag,
  Users,
  Cpu,
  ArrowUpRight,
  Wifi,
  AlertCircle,
  Plus,
  ArrowUp,
  ExternalLink,
} from 'lucide-react';

function formatBytes(bytes: number, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');
  const [notConnected, setNotConnected] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.status === 401) { setNotConnected(true); setLoading(false); return; }
      const data = await res.json();
      if (data.success) { setStats(data.data); setNotConnected(false); }
      else setError(data.message);
    } catch {
      setError('Falha na comunicação com o sistema.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!ignore) {
        await fetchStats();
      }
    };
    run();
    const interval = setInterval(() => {
      if (!ignore) fetchStats();
    }, 10000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [fetchStats]);

  const totalMemory = stats?.totalMemory || 1;
  const freeMemory = stats?.freeMemory || 0;
  const memUsedPercent = Math.min(100, Math.max(0, Math.round(((totalMemory - freeMemory) / totalMemory) * 100)));

  return (
    <main className="mg-page-container">

      {/* ── TOP GREETING BAR ────────────────────────────────────────────── */}
      <header className="mg-page-header-row">
        <div className="mg-page-header">
          <h1 className="mg-page-title">
            Olá, Bem-vindo de volta! 👋
          </h1>
          <p className="mg-page-subtitle">
            Monitoramento e controle de vendas e telemetria MikroTik em tempo real
          </p>
        </div>

        <div className="flex items-center gap-3">
          {stats && (
            <div className="hidden lg:flex items-center gap-2 px-3.5 py-2 rounded-xl mg-card text-xs font-semibold">
              <span className={`w-2 h-2 rounded-full ${stats.offline ? 'bg-amber-500' : 'bg-emerald-500 animate-pulse'}`} />
              <span>{stats.identity}</span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <span className="font-mono text-slate-500 dark:text-slate-400">
                {stats.offline ? 'Offline' : (stats.clockTime || '00:00')}
              </span>
            </div>
          )}

          <Link
            href="/dashboard/users?tab=batch"
            className="mg-btn mg-btn-primary"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            Gerar Vouchers
          </Link>
        </div>
      </header>

      {/* ── ERROR BANNER ──────────────────────────────────────────────── */}
      {error && !stats && (
        <div className="mg-alert mg-alert-danger">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Erro no sistema: {error}</span>
        </div>
      )}

      {/* ── OFFLINE / VPN NOTICE BANNER ───────────────────────────────── */}
      {stats?.offline && (
        <div className="p-5 rounded-2xl bg-gradient-to-r from-amber-50/80 via-orange-50/50 to-amber-50/80 dark:from-amber-950/30 dark:via-orange-950/20 dark:to-amber-950/30 border border-amber-200/90 dark:border-amber-800/60 text-amber-900 dark:text-amber-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 shadow-sm">
              <Wifi className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-black text-sm text-slate-900 dark:text-white">
                  MikroTik Desconectado ou sem IP Público ({stats.targetHost || '192.168.88.1'})
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-200/80 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700/80">
                  Túnel Remoto Necessário
                </span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1 max-w-2xl font-medium leading-relaxed">
                A VPS não conseguiu comunicação direta com o roteador. Se o seu MikroTik está em uma rede local, CGNAT ou Starlink (sem IP público), configure a <strong>VPN WireGuard</strong> para que o painel tenha controle total remoto sem consumir dados da sua VPS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
            <Link
              href="/dashboard/vpn"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider shadow-md shadow-blue-500/25 transition-all cursor-pointer transform hover:-translate-y-0.5"
            >
              <span>🛡️</span>
              <span>Conectar via VPN</span>
            </Link>
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs uppercase tracking-wider transition-all cursor-pointer shadow-sm"
            >
              <span>⚙️</span>
              <span>Roteadores</span>
            </Link>
          </div>
        </div>
      )}

      {/* ── NOT CONNECTED BANNER ──────────────────────────────────────── */}
      {notConnected ? (
        <div className="saas-card p-8 flex flex-col sm:flex-row items-center gap-6 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 flex items-center justify-center text-3xl shrink-0 text-amber-600 dark:text-amber-400">
            🔌
          </div>
          <div className="flex-1">
            <span className="saas-pill saas-pill-warning mb-2">Desconectado</span>
            <h3 className="text-xl font-bold text-slate-900 dark:text-white mt-1">Nenhum Roteador Conectado</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 mb-4">
              Conecte o sistema à sua Routerboard MikroTik para ativar o monitoramento em tempo real ou provisione o acesso remoto via VPN WireGuard.
            </p>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard/admin"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white font-bold text-xs uppercase tracking-wider shadow-sm hover:bg-blue-700 transition-colors"
              >
                Configurar Conexão
              </Link>
              <Link
                href="/dashboard/vpn"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60 text-indigo-700 dark:text-indigo-300 font-bold text-xs uppercase tracking-wider hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition-colors"
              >
                🛡️ Conectar via VPN
              </Link>
            </div>
          </div>
        </div>
      ) : loading && !stats ? (
        /* SKELETON LOADERS */
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 h-80 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
            <div className="h-80 rounded-2xl bg-slate-200/60 dark:bg-slate-800/60 animate-pulse" />
          </div>
        </div>
      ) : stats ? (
        <>
          {/* ═══════════════════════════════════════════════════════════════
             1. TOP ROW: 4 VIBRANT METRIC CARDS (EXACT REFERENCE DESIGN)
             ═══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

            {/* CARD 1: TOTAL SALES (TEAL / EMERALD) */}
            <div className="mg-stat-card mg-stat-teal group">
              <div className="flex flex-col justify-between h-full z-10">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Total Sales
                </span>
                <div className="my-2">
                  <div className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                    R$ {stats.finance.monthIncome.toFixed(2)}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white font-bold">
                  <span className="bg-white/30 text-white px-2 py-0.5 rounded-md text-[10px] font-black">
                    +15%
                  </span>
                  <span>este mês</span>
                </div>
              </div>
              <div className="mg-stat-icon-badge text-emerald-700">
                <ArrowUpRight className="w-6 h-6 stroke-[2.5]" />
              </div>
            </div>

            {/* CARD 2: TOTAL PURCHASES (VIBRANT BLUE) */}
            <div className="mg-stat-card mg-stat-blue group">
              <div className="flex flex-col justify-between h-full z-10">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Total Purchases
                </span>
                <div className="my-2">
                  <div className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                    {stats.finance.monthCount}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white font-bold">
                  <span className="bg-white/30 text-white px-2 py-0.5 rounded-md text-[10px] font-black">
                    Hoje: {stats.finance.todayCount}
                  </span>
                  <span>este mês</span>
                </div>
              </div>
              <div className="mg-stat-icon-badge text-blue-700">
                <ShoppingBag className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>

            {/* CARD 3: TOTAL ORDERS (CARMIM / ROSE) */}
            <div className="mg-stat-card mg-stat-rose group">
              <div className="flex flex-col justify-between h-full z-10">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Total Orders
                </span>
                <div className="my-2">
                  <div className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                    {stats.activeUsersCount}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white font-bold">
                  <span className="bg-white/30 text-white px-2 py-0.5 rounded-md text-[10px] font-black">
                    Online
                  </span>
                  <span>{stats.totalUsersCount} cadastrados</span>
                </div>
              </div>
              <div className="mg-stat-icon-badge text-rose-700">
                <Users className="w-5 h-5 stroke-[2.2]" />
              </div>
            </div>

            {/* CARD 4: TOTAL GROWTH / HARDWARE (SOLAR ORANGE) */}
            <div className="mg-stat-card mg-stat-orange group">
              <div className="flex flex-col justify-between h-full z-10">
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Total Growth
                </span>
                <div className="my-2">
                  <div className="text-2xl lg:text-3xl font-black text-white tracking-tight">
                    {stats.cpuLoad}%
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-white font-bold">
                  <span className="bg-white/30 text-white px-2 py-0.5 rounded-md text-[10px] font-black truncate max-w-[100px]">
                    {stats.model || 'MikroTik'}
                  </span>
                  <span>CPU Load</span>
                </div>
              </div>
              <div className="mg-stat-icon-badge text-amber-700">
                <TrendingUp className="w-6 h-6 stroke-[2.5]" />
              </div>
            </div>

          </section>

          {/* ═══════════════════════════════════════════════════════════════
             2. MIDDLE SECTION: LARGE SPLINE CHART + SPARKLINES & DONUT
             ═══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT: LARGE SPLINE AREA CHART (FATURAMENTO & TENDÊNCIA) */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-6 lg:col-span-2 flex flex-col justify-between">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-slate-100 dark:border-slate-800 gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                      Faturamento & Vendas
                    </h3>
                    <p className="text-xs font-semibold text-slate-700 dark:text-slate-400 mt-0.5">
                      Volume financeiro e emissão de vouchers ao longo do período
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-1 rounded-lg border border-emerald-200 dark:border-emerald-800/60">
                      <ArrowUp className="w-3.5 h-3.5" /> +18.4%
                    </span>
                  </div>
                </div>

                {/* 4 SUMMARY STATS IN A ROW */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-400 block mb-0.5">
                      Receita Hoje
                    </span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      R$ {stats.finance.todayIncome.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-400 block mb-0.5">
                      Vendas Hoje
                    </span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {stats.finance.todayCount} unid.
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-400 block mb-0.5">
                      Receita Mês
                    </span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      R$ {stats.finance.monthIncome.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-400 block mb-0.5">
                      Vouchers Mês
                    </span>
                    <p className="text-xl font-black text-slate-900 dark:text-white">
                      {stats.finance.monthCount} unid.
                    </p>
                  </div>
                </div>
              </div>

              {/* RECHARTS SPLINE AREA CHART */}
              <div className="w-full h-56 mt-2">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats.chartData || []} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFaturamento" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ff3b5c" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#ff3b5c" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="colorVouchers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0084ff" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#0084ff" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={12} fontWeight={700} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={12} fontWeight={700} tickLine={false} axisLine={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 8px 16px rgba(0,0,0,0.06)',
                          fontSize: '12px',
                          fontWeight: 600,
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="faturamento"
                        name="Faturamento (R$)"
                        stroke="#ff3b5c"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorFaturamento)"
                      />
                      <Area
                        type="monotone"
                        dataKey="vouchers"
                        name="Vouchers"
                        stroke="#0084ff"
                        strokeWidth={2.5}
                        fillOpacity={1}
                        fill="url(#colorVouchers)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* RIGHT COLUMN: REAL USER & HARDWARE METRICS */}
            <div className="flex flex-col gap-6">

              {/* CARD: USERS & MEMORY TELEMETRY */}
              <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-5 grid grid-cols-2 gap-4">
                {/* User Real Stats */}
                <div className="flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-400 block mb-0.5">
                      Total Usuários
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-slate-900 dark:text-white">{stats.totalUsersCount}</span>
                      <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        {stats.activeUsersCount} online
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">cadastrados no MikroTik</span>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-2.5 rounded-full transition-all duration-500" 
                        style={{ width: `${Math.min(100, Math.max(5, stats.totalUsersCount > 0 ? Math.round((stats.activeUsersCount / stats.totalUsersCount) * 100) : 0))}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1 block">
                      Taxa de ocupação: {stats.totalUsersCount > 0 ? Math.round((stats.activeUsersCount / stats.totalUsersCount) * 100) : 0}%
                    </span>
                  </div>
                </div>

                {/* RAM Real Stats */}
                <div className="flex flex-col justify-between border-l border-slate-200 dark:border-slate-800 pl-4">
                  <div>
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-400 block mb-0.5">
                      RAM Livre
                    </span>
                    <div className="flex items-baseline gap-1 mt-0.5">
                      <span className="text-xl font-black text-slate-900 dark:text-white">{formatBytes(stats.freeMemory)}</span>
                      <span className="text-xs font-bold text-blue-700 dark:text-blue-400">{memUsedPercent}% uso</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">de {formatBytes(stats.totalMemory)}</span>
                  </div>
                  <div className="mt-3">
                    <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden">
                      <div 
                        className={`h-2.5 rounded-full transition-all duration-500 ${memUsedPercent > 85 ? 'bg-rose-500' : memUsedPercent > 60 ? 'bg-amber-500' : 'bg-blue-500'}`} 
                        style={{ width: `${Math.min(100, Math.max(5, memUsedPercent))}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold mt-1 block">
                      Carga de memória da Routerboard
                    </span>
                  </div>
                </div>
              </div>


              {/* CARD: CIRCULAR PROGRESS DONUT (ONLINE VS OFFLINE) */}
              <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-5 flex-1 flex flex-col justify-between">
                <div>
                  <h4 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
                    Conexões & Consumo
                  </h4>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                    Clientes conectados e ocupação de hardware
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 my-2">
                  {/* Gauge 1: Online Users */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-200 dark:text-slate-800"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-rose-500"
                          strokeDasharray={`${Math.min(100, (stats.activeUsersCount / (stats.totalUsersCount || 1)) * 100)}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <Wifi className="w-4 h-4 text-rose-500 absolute" />
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-black text-slate-700 dark:text-slate-400 block leading-tight">
                        Online
                      </span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">{stats.activeUsersCount}</span>
                    </div>
                  </div>

                  {/* Gauge 2: Memory Load */}
                  <div className="flex items-center gap-3">
                    <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-200 dark:text-slate-800"
                          strokeWidth="3.5"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className="text-amber-500"
                          strokeDasharray={`${memUsedPercent}, 100`}
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <Cpu className="w-4 h-4 text-amber-500 absolute" />
                    </div>
                    <div>
                      <span className="text-[11px] uppercase font-black text-slate-700 dark:text-slate-400 block leading-tight">
                        RAM Uso
                      </span>
                      <span className="text-lg font-black text-slate-900 dark:text-white">{memUsedPercent}%</span>
                    </div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                  <span>Storage: {formatBytes(stats.freeHdd)} livres</span>
                  <Link href="/dashboard/traffic" className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 flex items-center gap-1 font-bold">
                    Ver tráfego <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>

            </div>

          </section>

          {/* ═══════════════════════════════════════════════════════════════
             3. BOTTOM SECTION: RECENT ACTIVITIES TABLE + LIVE EVENT LOGS
             ═══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* LEFT: RECENT CLIENTS & TICKETS TABLE (WITH COLORFUL AVATARS) */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl lg:col-span-2 overflow-hidden flex flex-col justify-between">
              <div className="p-5 pb-3 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Atividades Recentes do Hotspot
                  </h3>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                    Conexões, cadastros e vouchers emitidos recentemente
                  </p>
                </div>
                <Link
                  href="/dashboard/users"
                  className="text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors"
                >
                  Ver todos →
                </Link>
              </div>

              <div className="overflow-x-auto custom-scrollbar">
                <table className="saas-table">
                  <thead>
                    <tr>
                      <th>Cliente / Voucher</th>
                      <th>Data & Hora</th>
                      <th>Perfil / Plano</th>
                      <th>Status</th>
                      <th className="text-center">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* Render Real Hotspot Activities (Active Connected Clients Only) */}
                    {stats.activeHotspotList && stats.activeHotspotList.length > 0 ? (
                      stats.activeHotspotList.map((row: any, idx: number) => (
                        <tr key={idx} className="group hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                          <td>
                            <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                                <Wifi className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-black text-slate-900 dark:text-white text-xs leading-tight">{row.user}</div>
                                <div className="text-xs font-mono font-bold text-slate-700 dark:text-slate-400">{row.address} | {row.macAddress}</div>
                              </div>
                            </div>
                          </td>
                          <td className="text-xs font-bold text-slate-800 dark:text-slate-300 whitespace-nowrap">
                            Uptime: {row.uptime}
                          </td>
                          <td className="text-xs font-black text-slate-900 dark:text-white whitespace-nowrap">
                            {formatBytes(row.bytesIn + row.bytesOut)}
                          </td>
                          <td className="whitespace-nowrap">
                            <span className="saas-pill saas-pill-success">
                              Conectado
                            </span>
                          </td>
                          <td className="text-center whitespace-nowrap">
                            <Link
                              href="/dashboard/users"
                              className="w-8 h-8 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 inline-flex items-center justify-center text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors cursor-pointer mx-auto font-bold"
                            >
                              <ExternalLink className="w-4 h-4" />
                            </Link>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                          Nenhum cliente conectado ao Hotspot no momento. As conexões ativas do MikroTik aparecerão aqui em tempo real.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="p-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/60 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300">
                <span>{stats.activeHotspotList?.length > 0 ? `${stats.activeHotspotList.length} usuários conectados agora` : 'Nenhum usuário ativo no momento'}</span>
                <Link href="/dashboard/leads" className="font-black text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300">
                  Gerenciar Leads & Cadastros →
                </Link>
              </div>

            </div>

            {/* RIGHT: UPDATES / LIVE MIKROTIK EVENT LOGS */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
              <div className="pb-3 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                    Eventos do Roteador
                  </h3>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-0.5">
                    Telemetria e logs em tempo real
                  </p>
                </div>
                <span className="saas-pill saas-pill-primary text-xs font-bold">
                  auto 10s
                </span>
              </div>

              {/* TIMELINE LIST */}
              <div className="flex-1 overflow-y-auto max-h-[320px] custom-scrollbar py-3 space-y-4">
                {stats.logs?.length === 0 ? (
                  <p className="text-xs text-slate-600 dark:text-slate-400 font-bold text-center py-8">Nenhum evento registrado</p>
                ) : (
                  stats.logs?.slice(0, 6).map((l: any, i: number) => {
                    const isLogin = l.message?.includes('logged in');
                    const isLogout = l.message?.includes('logged out');
                    return (
                      <div key={i} className="flex items-start gap-3 relative">
                        <div className={`w-2.5 h-2.5 rounded-full mt-1 shrink-0 ${
                          isLogin ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : isLogout ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-black text-slate-900 dark:text-white leading-tight">
                            {isLogin ? 'Usuário Conectado' : isLogout ? 'Usuário Desconectado' : l.topics || 'Sistema'}
                          </p>
                          <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-300 truncate mt-0.5">
                            {l.message}
                          </p>
                          <span className="text-[11px] font-bold text-slate-600 dark:text-slate-400 block mt-1">
                            {l.time}
                          </span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Status: {stats.isProvisioned ? 'Provisionado' : 'Pronto'}</span>
                <Link
                  href="/dashboard/portal"
                  className="text-xs font-black text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                >
                  Editor do Portal →
                </Link>
              </div>
            </div>

          </section>

          {/* ═══════════════════════════════════════════════════════════════
             4. FOURTH SECTION: PROFILES + REAL SALES REPORT + PLATFORM OVERVIEW
             ═══════════════════════════════════════════════════════════════ */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* CARD 1: DISTRIBUTION (REAL PROFILES) */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Perfis de Hotspot
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Distribuição de vouchers por plano cadastrado
                </p>
              </div>

              <div className="my-4 space-y-3">
                {stats.profileDistribution && stats.profileDistribution.length > 0 ? (
                  stats.profileDistribution.slice(0, 4).map((item: any, idx: number) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-800 dark:text-slate-200">{item.name}</span>
                        <span className="text-slate-500 dark:text-slate-400 font-mono">{item.count} ({item.percent}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${idx === 0 ? 'bg-blue-600' : idx === 1 ? 'bg-indigo-500' : idx === 2 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                          style={{ width: `${Math.max(5, item.percent)}%` }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center font-medium">
                    Nenhum perfil com vouchers gerados.
                  </p>
                )}
              </div>

              <Link
                href="/dashboard/profiles"
                className="w-full py-2 px-3 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors text-center block shadow-xs"
              >
                Gerenciar Perfis
              </Link>
            </div>

            {/* CARD 2: SALE REPORT (REAL BAR CHART) */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Relatório de Vendas
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  Volume mensal de vouchers nos últimos 6 meses
                </p>
              </div>

              {/* Bar Chart */}
              <div className="w-full h-44 my-2">
                {mounted && (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.monthlySales || []} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}>
                      <XAxis dataKey="name" stroke="#64748b" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: 'rgba(0, 132, 255, 0.05)' }}
                        contentStyle={{
                          backgroundColor: '#ffffff',
                          borderRadius: '10px',
                          border: '1px solid #e2e8f0',
                          fontSize: '11px',
                          fontWeight: 600,
                        }}
                      />
                      <Bar dataKey="vendas" name="Vouchers" fill="#0084ff" radius={[4, 4, 0, 0]} maxBarSize={24} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-2 border-t border-slate-100 dark:border-slate-800">
                <span>Período: Últimos 6 meses</span>
                <span className="text-blue-600 dark:text-blue-400 font-bold">Total: {stats.finance.totalVouchers || 0} vouchers</span>
              </div>
            </div>

            {/* CARD 3: PLATFORM OVERVIEW (REAL METRICS) */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Visão Geral da Plataforma
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                  Consolidação em tempo real de vouchers, arrecadação financeira e usuários.
                </p>
              </div>

              {/* 3 Metrics in a row */}
              <div className="grid grid-cols-3 gap-2 my-4">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Vouchers
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{stats.finance.totalVouchers || 0}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Receita (R$)
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{(stats.finance.totalRevenue || 0).toFixed(2)}</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider block">
                    Usuários
                  </span>
                  <p className="text-base font-black text-slate-900 dark:text-white mt-0.5">{stats.totalUsersCount || 0}</p>
                </div>
              </div>

              {/* System summary */}
              <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/80 text-xs text-slate-700 dark:text-slate-300 mb-4 font-medium">
                <span>Roteador: <strong>{stats.identity}</strong> ({stats.model || 'MikroTik'})</span>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={fetchStats}
                  className="py-2 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-sm text-center"
                >
                  Atualizar
                </button>
                <Link
                  href="/dashboard/finance"
                  className="py-2 px-3 border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-bold transition-colors text-center block"
                >
                  Relatório
                </Link>
              </div>
            </div>

          </section>

          {/* ═══════════════════════════════════════════════════════════════
             5. FIFTH SECTION: FULL-WIDTH OPEN INVOICES / FATURAS TABLE
             ═══════════════════════════════════════════════════════════════ */}
          <section className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 shadow-sm rounded-2xl overflow-hidden">
            <div className="p-5 pb-3 border-b border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Faturas & Pagamentos Pix
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Registro de transações comerciais, ativações de planos e pagamentos do portal Hotspot.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href="/dashboard/finance"
                  className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  Ver Financeiro Completo →
                </Link>
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar">
              <table className="saas-table">
                <thead>
                  <tr>
                    <th>Fatura / Código</th>
                    <th>Cliente</th>
                    <th>Plano / Perfil</th>
                    <th>Valor</th>
                    <th>Data</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.recentPayments && stats.recentPayments.length > 0 ? (
                    stats.recentPayments.map((inv: any, idx: number) => (
                      <tr key={idx} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors">
                        <td className="font-mono font-bold text-slate-800 dark:text-slate-200 text-xs">
                          #{inv.id?.slice(0, 8)}
                        </td>
                        <td className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                          {inv.lead?.name || inv.lead?.phone || 'Cliente Hotspot'}
                        </td>
                        <td className="text-xs text-slate-500 dark:text-slate-400">
                          {inv.profile || 'Voucher'}
                        </td>
                        <td className="font-bold text-emerald-600 dark:text-emerald-400 text-xs">
                          R$ {inv.amount?.toFixed(2)}
                        </td>
                        <td className="text-xs text-slate-500 dark:text-slate-400">
                          {new Date(inv.createdAt).toLocaleDateString('pt-BR')}
                        </td>
                        <td>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wide uppercase ${
                            inv.status === 'approved' ? 'bg-emerald-500 text-white' : inv.status === 'pending' ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white'
                          }`}>
                            {inv.status === 'approved' ? 'Aprovado' : inv.status === 'pending' ? 'Pendente' : 'Rejeitado'}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="py-8 text-center text-xs font-bold text-slate-500 dark:text-slate-400">
                        Nenhum pagamento Pix registrado ainda. As vendas geradas pelo portal Hotspot aparecerão aqui automaticamente.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-3.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>Status dos pagamentos integrado ao Mercado Pago e SQLite</span>
              <Link href="/dashboard/finance" className="font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300">
                Histórico Financeiro →
              </Link>
            </div>
          </section>

        </>
      ) : null}

    </main>
  );
}

