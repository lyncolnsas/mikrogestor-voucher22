/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @next/next/no-img-element */
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';

const DEMO_COLORS = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#64748b'];
const NEUTRAL_COLOR = '#cbd5e1';

interface LeadsWorkspaceProps {
  embedded?: boolean;
  activeHubTab?: 'editor' | 'leads' | 'provisioning';
  onTabChange?: (tab: 'editor' | 'leads' | 'provisioning') => void;
  hideHeader?: boolean;
}

export default function LeadsWorkspace({
  hideHeader = false
}: LeadsWorkspaceProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Time & Demographic sub-tabs
  const [timeTab, setTimeTab] = useState<'month' | 'week' | 'hour'>('month');
  const [demoTab, setDemoTab] = useState<'age' | 'gender' | 'device'>('age');

  // Table filters & pagination
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [deletingLeadId, setDeletingLeadId] = useState<string | null>(null);
  const [syncingAvatars, setSyncingAvatars] = useState(false);
  const [mounted, setMounted] = useState(false);

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch('/api/dashboard/leads');
      const json = await res.json();
      if (json.success) {
        setData(json.data);
      } else {
        setError(json.message || 'Erro ao carregar dados dos leads.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha de comunicação ao carregar leads.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setMounted(true));
    let ignore = false;
    const run = async () => {
      if (!ignore) {
        await fetchLeads();
      }
    };
    run();
    return () => {
      cancelAnimationFrame(frame);
      ignore = true;
    };
  }, [fetchLeads]);

  const handleDeleteLead = async (id: string) => {
    if (!window.confirm('Deseja realmente deletar este lead? Esta ação também removerá o usuário do hotspot no MikroTik.')) {
      return;
    }
    setDeletingLeadId(id);
    try {
      const res = await fetch(`/api/dashboard/leads?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        await fetchLeads();
      } else {
        alert(json.message || 'Erro ao deletar lead.');
      }
    } catch {
      alert('Erro de rede ao deletar lead.');
    } finally {
      setDeletingLeadId(null);
    }
  };

  const handleSyncAvatars = async () => {
    setSyncingAvatars(true);
    try {
      const res = await fetch('/api/dashboard/leads/avatar-sync', { method: 'POST' });
      const json = await res.json();
      if (json.success) {
        await fetchLeads();
      } else {
        alert(json.message || 'Erro ao sincronizar fotos.');
      }
    } catch {
      alert('Erro de conexão ao sincronizar fotos.');
    } finally {
      setSyncingAvatars(false);
    }
  };

  const exportLeadsToCSV = () => {
    if (!data || !data.leads || data.leads.length === 0) {
      alert('Sem dados para exportar.');
      return;
    }
    const headers = ['Nome', 'WhatsApp', 'E-mail', 'CPF', 'Gênero', 'Data de Nascimento', 'Senha do Hotspot', 'Resposta Customizada', 'Data do Cadastro'];
    const rows = data.leads.map((l: any) => [
      l.name,
      l.phone,
      l.email || '',
      l.cpf || '',
      l.gender || '',
      l.birthDate ? new Date(l.birthDate).toLocaleDateString('pt-BR') : '',
      l.password || '',
      l.customFieldValue || '',
      new Date(l.createdAt).toLocaleString('pt-BR')
    ]);

    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" 
      + [headers.join(','), ...rows.map((e: any) => e.map((val: any) => `"${String(val).replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `leads_hotspot_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportLeadsToPDF = () => {
    if (!data || !data.leads || data.leads.length === 0) {
      alert('Sem dados para exportar.');
      return;
    }
    const leads = data.leads;
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita popups para exportar em PDF.');
      return;
    }

    const html = `
      <html>
      <head>
        <title>Relatório de Leads - Hotspot Studio</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; color: #1e293b; }
          h1 { text-align: center; font-size: 20px; margin-bottom: 4px; color: #0f172a; }
          p.meta { text-align: center; font-size: 11px; color: #64748b; margin-bottom: 24px; }
          table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 11px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
          th { background-color: #f8fafc; font-weight: 700; color: #475569; }
          tr:nth-child(even) { background-color: #f8fafc; }
        </style>
      </head>
      <body>
        <h1>Relatório de Cadastros & Leads do Hotspot</h1>
        <p class="meta">Gerado em ${new Date().toLocaleString('pt-BR')} • Total de registros: ${leads.length}</p>
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>WhatsApp</th>
              <th>E-mail</th>
              <th>CPF</th>
              <th>Gênero</th>
              <th>Nascimento</th>
              <th>Senha</th>
              <th>Resposta</th>
              <th>Cadastro em</th>
            </tr>
          </thead>
          <tbody>
            ${leads.map((l: any) => `
              <tr>
                <td><strong>${l.name}</strong></td>
                <td>${l.phone || '-'}</td>
                <td>${l.email || '-'}</td>
                <td>${l.cpf || '-'}</td>
                <td>${l.gender || '-'}</td>
                <td>${l.birthDate ? new Date(l.birthDate).toLocaleDateString('pt-BR') : '-'}</td>
                <td>${l.password || '-'}</td>
                <td>${l.customFieldValue || '-'}</td>
                <td>${new Date(l.createdAt).toLocaleString('pt-BR')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <script>
          window.onload = function() {
            window.print();
            window.close();
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  // Filtered leads
  const filteredLeads = useMemo(() => {
    if (!data?.leads) return [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return data.leads.filter((lead: any) => {
      // Date filter
      const leadDate = new Date(lead.createdAt);
      if (dateFilter === 'today') {
        if (leadDate.toISOString().split('T')[0] !== todayStr) return false;
      } else if (dateFilter === 'week') {
        if (leadDate < sevenDaysAgo) return false;
      } else if (dateFilter === 'month') {
        if (leadDate < firstDayOfMonth) return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const matchName = (lead.name || '').toLowerCase().includes(q);
        const matchUser = (lead.hotspotUser || '').toLowerCase().includes(q);
        const matchPhone = (lead.phone || '').includes(q);
        const matchEmail = (lead.email || '').toLowerCase().includes(q);
        const matchCpf = (lead.cpf || '').includes(q);
        if (!matchName && !matchUser && !matchPhone && !matchEmail && !matchCpf) return false;
      }

      return true;
    });
  }, [data, search, dateFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredLeads.length / pageSize));
  const paginatedLeads = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredLeads.slice(start, start + pageSize);
  }, [filteredLeads, page, pageSize]);

  // Active demographic dataset
  const currentDemoChart = useMemo(() => {
    if (!data?.demographics) return [];
    if (demoTab === 'gender') return data.demographics.gender || [];
    if (demoTab === 'device') return data.demographics.devices || [];
    return data.demographics.age || [];
  }, [data, demoTab]);

  return (
    <div className="space-y-6 animate-fade-in relative pb-12">
      {!hideHeader && (
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1 pb-2">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">
              HOTSPOT STUDIO // WORKSPACE
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
            Leads & Cadastros
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Personalize o design do hotspot, gerencie leads capturados e configure regras de roteamento.
          </p>
        </div>

        {/* Primary Header Action */}
        <div className="flex items-center gap-2.5">
          <Link
            href="/dashboard/leads/sorteio"
            className="text-xs font-black py-2 px-4 rounded-xl bg-gradient-to-r from-red-500 via-red-600 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-md shadow-red-500/25 hover:shadow-red-500/35 transition-all flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
            title="Abrir Sorteador de Leads Nexus DRAW"
          >
            <span>🎲</span>
            <span>Sortear Lead</span>
          </Link>

          <button
            type="button"
            onClick={fetchLeads}
            disabled={loading}
            className="text-xs font-bold py-2 px-3.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 hover:text-slate-900 dark:hover:text-white transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
            title="Atualizar dados de leads e sessões ativas"
          >
            <span className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-ping' : 'bg-emerald-500'}`} />
            {loading ? 'Atualizando...' : 'Atualizar Dados'}
          </button>
        </div>
      </header>
      )}

      {/* Loading state */}
      {loading ? (
        <div className="flex h-[50vh] items-center justify-center bg-white dark:bg-[#111726] rounded-2xl border border-slate-200/80 dark:border-slate-800 p-8 shadow-sm">
          <div className="flex flex-col items-center gap-3">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
            <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold animate-pulse">Carregando inteligência de leads...</p>
          </div>
        </div>
      ) : error || !data ? (
        <div className="bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 p-6 rounded-2xl border border-rose-200 dark:border-rose-800/60 shadow-sm text-xs flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <div>
            <p className="font-bold text-rose-800 dark:text-rose-200">Falha ao Carregar Leads</p>
            <p className="text-[11px] text-rose-600 dark:text-rose-400 mt-0.5">{error || 'Não foi possível carregar os dados.'}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI Cards Grid (5 Cards) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Card 1: Total de Cadastros */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Total de Cadastros</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                  REGISTRADOS
                </span>
              </div>
              <div className="my-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.total}</span>
                <span className="text-xs text-slate-400 dark:text-slate-500 font-medium">acumulado</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-emerald-600 dark:text-emerald-400 font-bold">
                  ↑ +{data.growthMonthPct || 0}% este mês
                </span>
                <span className="text-slate-500 dark:text-slate-400 font-medium truncate max-w-[120px]" title={`${data.validWhatsAppPct}% com WhatsApp válido`}>
                  {data.validWhatsAppPct}% WhatsApp
                </span>
              </div>
            </div>

            {/* Card 2: Novos Hoje */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Cadastros Hoje</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                  HOJE
                </span>
              </div>
              <div className="my-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.today}</span>
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-bold">novos</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500 dark:text-slate-400 font-medium">
                  {data.todayDiff >= 0 ? `+${data.todayDiff} vs. ontem` : `${data.todayDiff} vs. ontem`}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 px-1.5 py-0.5 rounded border border-emerald-200 dark:border-emerald-800/60">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Tempo Real
                </span>
              </div>
            </div>

            {/* Card 3: Taxa de Conversão */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Conversão do Portal</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60">
                  CONVERSÃO
                </span>
              </div>
              <div className="my-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.conversionRate}%</span>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-bold">efetividade</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Sessões abertas vs. cadastros
              </div>
            </div>

            {/* Card 4: Retorno & Recorrência */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Recorrência</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60">
                  RETORNO
                </span>
              </div>
              <div className="my-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.retentionRate}%</span>
                <span className="text-xs text-indigo-600 dark:text-indigo-400 font-bold">retorno</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Conectaram mais de 1 vez
              </div>
            </div>

            {/* Card 5: Tempo Médio de Permanência */}
            <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-col justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-slate-500 dark:text-slate-400 text-[11px] font-bold uppercase tracking-wider">Tempo Médio</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800/60">
                  TEMPO MÉDIO
                </span>
              </div>
              <div className="my-1 flex items-baseline justify-between">
                <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">{data.avgSessionMinutes} min</span>
                <span className="text-xs text-purple-600 dark:text-purple-400 font-bold">duração</span>
              </div>
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                Permanência por sessão ativa
              </div>
            </div>
          </div>

          {/* Intermediate Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Chart: Comportamento Temporal (7 cols) */}
            <div className="lg:col-span-7 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
                <div>
                  <h3 className="text-slate-900 dark:text-white text-xs font-bold uppercase tracking-wider">
                    Evolução & Comportamento Temporal
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    {timeTab === 'month' && 'Cadastros novos e recorrentes nos últimos 6 meses'}
                    {timeTab === 'week' && 'Fluxo diário de visitantes na última semana'}
                    {timeTab === 'hour' && 'Curva de horários de pico de acesso na rede'}
                  </p>
                </div>
                {/* Switcher tabs */}
                <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setTimeTab('month')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      timeTab === 'month' ? 'bg-white dark:bg-[#111726] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Mês
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeTab('week')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      timeTab === 'week' ? 'bg-white dark:bg-[#111726] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Semana
                  </button>
                  <button
                    type="button"
                    onClick={() => setTimeTab('hour')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      timeTab === 'hour' ? 'bg-white dark:bg-[#111726] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Dia / Horário
                  </button>
                </div>
              </div>

              <div className="h-[260px] w-full">
                {mounted && (
                  timeTab === 'hour' ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.temporal?.hourly || []}>
                        <defs>
                          <linearGradient id="hourGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#2563eb" stopOpacity={0.4}/>
                            <stop offset="95%" stopColor="#2563eb" stopOpacity={0.0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 10, fontWeight: 'bold'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} />
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Area type="monotone" dataKey="cadastros" stroke="#2563eb" strokeWidth={2.5} fillOpacity={1} fill="url(#hourGradient)" name="Cadastros / Acessos" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={timeTab === 'week' ? (data.temporal?.weekly || []) : (data.temporal?.monthly || [])}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 11, fontWeight: 'bold'}} />
                        <Tooltip 
                          cursor={{fill: '#f8fafc', opacity: 0.8}}
                          contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                        <Bar dataKey="novos" fill="#2563eb" radius={[6, 6, 0, 0]} barSize={22} name="Novos Visitantes" />
                        <Bar dataKey="recorrentes" fill="#10b981" radius={[6, 6, 0, 0]} barSize={22} name="Recorrentes" />
                      </BarChart>
                    </ResponsiveContainer>
                  )
                )}
              </div>

              {/* Legend & Summary */}
              <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-600 dark:text-slate-400">
                {timeTab !== 'hour' ? (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-md bg-[#2563eb]" />
                      <span>Novos Visitantes</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-md bg-[#10b981]" />
                      <span>Visitantes Recorrentes</span>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                    <span>Fluxo por Faixa de Horário (Picos do Dia)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Right Chart: Inteligência Demográfica (5 cols) */}
            <div className="lg:col-span-5 bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 shadow-xs flex flex-col">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h3 className="text-slate-900 dark:text-white text-xs font-bold uppercase tracking-wider">
                    Inteligência Demográfica
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">Perfil dos leads capturados</p>
                </div>
                {/* Switcher selector */}
                <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setDemoTab('age')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      demoTab === 'age' ? 'bg-white dark:bg-[#111726] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Idade
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoTab('gender')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      demoTab === 'gender' ? 'bg-white dark:bg-[#111726] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Gênero
                  </button>
                  <button
                    type="button"
                    onClick={() => setDemoTab('device')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      demoTab === 'device' ? 'bg-white dark:bg-[#111726] text-blue-600 dark:text-blue-400 shadow-xs' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    Dispositivo
                  </button>
                </div>
              </div>

              {/* Donut with centered text */}
              <div className="h-[210px] w-full relative flex items-center justify-center">
                {mounted && currentDemoChart.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={currentDemoChart}
                          cx="50%"
                          cy="50%"
                          innerRadius={65}
                          outerRadius={90}
                          paddingAngle={3}
                          dataKey="value"
                          labelLine={false}
                        >
                          {currentDemoChart.map((entry: any, index: number) => {
                            const isNeutral = entry.name.toLowerCase().includes('não informado') || entry.name.toLowerCase().includes('outros');
                            return (
                              <Cell 
                                key={`demo-cell-${index}`} 
                                fill={isNeutral ? NEUTRAL_COLOR : DEMO_COLORS[index % DEMO_COLORS.length]} 
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip 
                          contentStyle={{borderRadius: '12px', border: '1px solid #e2e8f0', backgroundColor: '#ffffff', color: '#0f172a', fontSize: 12, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Centered stat inside donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      {demoTab === 'age' ? (
                        <>
                          <span className="text-2xl font-extrabold text-slate-900 dark:text-white">
                            {data.averageAge > 0 ? `${data.averageAge}` : '—'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Média Anos
                          </span>
                        </>
                      ) : demoTab === 'gender' ? (
                        <>
                          <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                            {data.total}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Perfis
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xl font-extrabold text-slate-900 dark:text-white">
                            Mobile
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Predominante
                          </span>
                        </>
                      )}
                    </div>
                  </>
                ) : (
                  <p className="text-slate-400 dark:text-slate-500 text-xs italic">Dados insuficientes para visualização.</p>
                )}
              </div>

              {/* Badges list */}
              <div className="flex flex-wrap justify-center gap-2.5 mt-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                {currentDemoChart.map((entry: any, index: number) => {
                  const isNeutral = entry.name.toLowerCase().includes('não informado') || entry.name.toLowerCase().includes('outros');
                  return (
                    <div key={index} className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 font-medium">
                      <span 
                        className="w-2.5 h-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: isNeutral ? NEUTRAL_COLOR : DEMO_COLORS[index % DEMO_COLORS.length] }} 
                      />
                      <span>{entry.name}</span>
                      <span className="font-bold text-slate-900 dark:text-white">({entry.value})</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Compact Additional Block: Qualidade dos Dados Capturados */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Qualidade e Integridade dos Dados Capturados
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">Completude cadastral dos campos obrigatórios e complementares</p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                Base Total: {data.total} Leads
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* WhatsApp progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                    Telefones / WhatsApp Válidos
                  </span>
                  <span className="text-emerald-700 dark:text-emerald-400 font-bold">{data.dataQuality?.phonePct || 0}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-emerald-500 rounded-full transition-all duration-500" 
                    style={{ width: `${data.dataQuality?.phonePct || 0}%` }} 
                  />
                </div>
              </div>

              {/* Email progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    E-mails Cadastrados
                  </span>
                  <span className="text-blue-700 dark:text-blue-400 font-bold">{data.dataQuality?.emailPct || 0}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-500 rounded-full transition-all duration-500" 
                    style={{ width: `${data.dataQuality?.emailPct || 0}%` }} 
                  />
                </div>
              </div>

              {/* CPF progress */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500" />
                    CPFs Informados
                  </span>
                  <span className="text-indigo-700 dark:text-indigo-400 font-bold">{data.dataQuality?.cpfPct || 0}%</span>
                </div>
                <div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-indigo-500 rounded-full transition-all duration-500" 
                    style={{ width: `${data.dataQuality?.cpfPct || 0}%` }} 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Grid Recent Table */}
          <div className="bg-white dark:bg-[#111726] border border-slate-200/80 dark:border-slate-800 rounded-2xl shadow-xs overflow-hidden">
            {/* Header & Actions Toolbar */}
            <div className="px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111726] flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/50 border border-blue-100 dark:border-blue-800/60 flex items-center justify-center shrink-0">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="text-slate-900 dark:text-white font-bold text-sm">Cadastros Recentes</h3>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60">
                      {filteredLeads.length} registros
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Usuários capturados pelo portal captivo do hotspot</p>
                </div>
              </div>

              {/* Filters & Actions toolbar */}
              <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto justify-start lg:justify-end">
                {/* Instant search input */}
                <div className="relative min-w-[200px] flex-1 sm:flex-initial">
                  <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </span>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Buscar nome, WhatsApp, CPF..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-[#0e1524] border border-slate-200 dark:border-slate-700 rounded-xl focus:bg-white dark:focus:bg-[#0e1524] focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-500 text-slate-900 dark:text-slate-100"
                  />
                </div>

                {/* Quick Date filter */}
                <select
                  value={dateFilter}
                  onChange={(e: any) => { setDateFilter(e.target.value); setPage(1); }}
                  className="px-2.5 py-1.5 text-xs font-semibold bg-slate-50 dark:bg-[#0e1524] border border-slate-200 dark:border-slate-700 rounded-xl text-slate-700 dark:text-slate-300 focus:outline-none cursor-pointer"
                >
                  <option value="all">Todas as datas</option>
                  <option value="today">Cadastros de hoje</option>
                  <option value="week">Últimos 7 dias</option>
                  <option value="month">Este mês</option>
                </select>

                {/* Export buttons */}
                <button
                  onClick={handleSyncAvatars}
                  disabled={syncingAvatars}
                  title="Buscar e salvar fotos de perfil do WhatsApp para os contatos"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 text-emerald-700 dark:text-emerald-400 shadow-xs cursor-pointer transition-colors disabled:opacity-50"
                >
                  <svg className={`w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 ${syncingAvatars ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  {syncingAvatars ? 'Buscando...' : 'Fotos WhatsApp'}
                </button>
                <button
                  onClick={exportLeadsToCSV}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-xs cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  CSV
                </button>
                <button
                  onClick={exportLeadsToPDF}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 shadow-xs cursor-pointer transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  PDF
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[960px]">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800">
                  <tr>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Usuário</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">WhatsApp</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">E-mail</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">CPF</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Gênero</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Nascimento</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Senha</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Campo Extra</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider whitespace-nowrap">Cadastrado</th>
                    <th className="px-4 py-3 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider text-center whitespace-nowrap">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#111726]">
                  {paginatedLeads.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center">
                            <svg className="w-6 h-6 text-slate-400 dark:text-slate-500" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
                            </svg>
                          </div>
                          <p className="text-slate-500 dark:text-slate-400 text-xs font-semibold">Nenhum cadastro encontrado.</p>
                          {(search || dateFilter !== 'all') && (
                            <button
                              onClick={() => { setSearch(''); setDateFilter('all'); }}
                              className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                            >
                              Limpar filtros de busca
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedLeads.map((lead: any) => {
                      const cleanPhone = (lead.phone || '').replace(/\D/g, '');
                      const waLink = cleanPhone ? `https://wa.me/55${cleanPhone}` : null;
                      
                      let genderLabel = '';
                      let genderClass = 'bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700';
                      if (lead.gender === 'M') {
                        genderLabel = 'Masc';
                        genderClass = 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800/60';
                      } else if (lead.gender === 'F') {
                        genderLabel = 'Fem';
                        genderClass = 'bg-pink-50 dark:bg-pink-950/50 text-pink-700 dark:text-pink-400 border-pink-200 dark:border-pink-800/60';
                      } else if (lead.gender === 'O') {
                        genderLabel = 'Outro';
                        genderClass = 'bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-400 border-purple-200 dark:border-purple-800/60';
                      }

                      return (
                        <tr key={lead.id} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors">
                          {/* User / Name */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-3">
                              {lead.avatarUrl ? (
                                <img
                                  src={lead.avatarUrl}
                                  alt={lead.name}
                                  className="w-8 h-8 rounded-xl object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-500 to-indigo-600 flex items-center justify-center text-white text-xs font-extrabold shrink-0 shadow-xs">
                                  {lead.name ? lead.name.charAt(0).toUpperCase() : 'U'}
                                </div>
                              )}
                              <div className="flex flex-col">
                                <span className="font-bold text-slate-800 dark:text-slate-200 text-xs flex items-center gap-1.5">
                                  {lead.name || 'Sem nome'}
                                  {lead.isOnline && (
                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                      Online
                                    </span>
                                  )}
                                </span>
                                <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                                  {lead.hotspotUser}
                                </span>
                              </div>
                            </div>
                          </td>

                          {/* WhatsApp */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {waLink ? (
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Abrir conversa no WhatsApp"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 border border-emerald-200 dark:border-emerald-800/60 transition-colors"
                              >
                                <svg className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="currentColor" viewBox="0 0 24 24">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
                                </svg>
                                {lead.phone}
                              </a>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* E-mail */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {lead.email ? (
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">{lead.email}</span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* CPF */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {lead.cpf ? (
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-300 font-medium">{lead.cpf}</span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* Gender */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {genderLabel ? (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold ${genderClass}`}>
                                {genderLabel}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* Birth Date */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {lead.birthDate ? (
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                                {new Date(lead.birthDate).toLocaleDateString('pt-BR')}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* Password */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {lead.password ? (
                              <span className="font-mono text-xs text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-2 py-0.5 rounded-md">
                                {lead.password}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* Custom Field */}
                          <td className="px-4 py-3">
                            {lead.customFieldValue ? (
                              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium truncate max-w-[130px] block" title={lead.customFieldValue}>
                                {lead.customFieldValue}
                              </span>
                            ) : (
                              <span className="text-xs text-slate-400 dark:text-slate-600 italic">—</span>
                            )}
                          </td>

                          {/* Date */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                                {new Date(lead.createdAt).toLocaleDateString('pt-BR')}
                              </span>
                              <span className="text-[10px] text-slate-400 dark:text-slate-500">
                                {new Date(lead.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                          </td>

                          {/* Delete Action */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => handleDeleteLead(lead.id)}
                              disabled={deletingLeadId === lead.id}
                              title="Remover cadastro"
                              className="w-8 h-8 inline-flex items-center justify-center rounded-xl text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-transparent hover:border-rose-200 dark:hover:border-rose-800/60 disabled:opacity-40 cursor-pointer transition-colors"
                            >
                              {deletingLeadId === lead.id ? (
                                <div className="w-3.5 h-3.5 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                              ) : (
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              )}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer with counts and pagination */}
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-slate-400 font-semibold">
                <span>
                  Mostrando {paginatedLeads.length} de {filteredLeads.length} cadastro{filteredLeads.length !== 1 ? 's' : ''}
                </span>
                <span className="text-slate-300 dark:text-slate-600">|</span>
                <span className="text-slate-400 dark:text-slate-500 font-normal">
                  Atualizado às {new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Pagination controls */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 mr-2">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">Por página:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                    className="text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300 font-bold focus:outline-none"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300 px-1">
                  {page} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="px-2.5 py-1 rounded-lg text-xs font-bold border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
                >
                  Próximo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
