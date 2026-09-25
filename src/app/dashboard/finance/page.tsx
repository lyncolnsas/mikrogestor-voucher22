"use client";

import { useEffect, useState, useCallback } from 'react';
import RouterOffline from '@/components/RouterOffline';

export default function FinanceReport() {
  const [financeData, setFinanceData] = useState<any>(null);
  const [pendingPix, setPendingPix] = useState<any[]>([]);       // manual PIX
  const [pendingMp, setPendingMp] = useState<any[]>([]);          // Mercado Pago aguardando webhook
  const [pendingCounts, setPendingCounts] = useState({ total: 0, manual: 0, mercadopago: 0 });
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [refreshingOrders, setRefreshingOrders] = useState(false);

  // Mercado Pago State
  const [mpToken, setMpToken] = useState('');
  const [manualPixKey, setManualPixKey] = useState('');
  const [mpSaving, setMpSaving] = useState(false);

  // Filter States
  const [search, setSearch] = useState('');
  const [selectedProfile, setSelectedProfile] = useState('all');
  const [selectedMonth, setSelectedMonth] = useState('all');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const fetchFinance = useCallback(async () => {
    try {
      const res = await fetch('/api/finance');
      if (res.status === 401 || res.status === 503) {
        setNotConnected(true);
        setLoading(false);
        return;
      }
      const json = await res.json();
      if (json.success) {
        setFinanceData(json.data);
        setNotConnected(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchMpConfig = useCallback(async () => {
    try {
      const res = await fetch('/api/config/mercadopago');
      const data = await res.json();
      if (data.success) {
        setMpToken(data.token);
        setManualPixKey(data.manualPixKey || '');
      }
    } catch {}
  }, []);

  const fetchPendingPix = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshingOrders(true);
    try {
      const res = await fetch('/api/portal/admin/pending-pix');
      const data = await res.json();
      if (data.success) {
        // Use grouped response
        const grouped = data.grouped || {};
        setPendingPix(grouped.manual || data.data?.filter((p: any) => p.isManualPix) || []);
        setPendingMp(grouped.mercadopago || data.data?.filter((p: any) => p.isMercadoPago) || []);
        setPendingCounts(data.counts || { total: 0, manual: 0, mercadopago: 0 });
      }
    } catch {}
    finally { if (showSpinner) setRefreshingOrders(false); }
  }, []);

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      if (ignore) return;
      await fetchFinance();
      if (ignore) return;
      await fetchMpConfig();
      if (ignore) return;
      await fetchPendingPix();
    };
    init();

    // Auto-refresh MP payments every 30s (webhook may arrive at any time)
    const interval = setInterval(() => {
      if (!ignore) fetchPendingPix();
    }, 30000);

    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, [fetchFinance, fetchMpConfig, fetchPendingPix]);

  const handleApprovePix = async (paymentId: string) => {
    if (!confirm('Tem certeza que recebeu o pagamento e deseja aprovar este voucher?')) return;
    try {
      const res = await fetch('/api/portal/admin/approve-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action: 'approve' })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchPendingPix();
        fetchFinance(); // Refresh transactions just in case
      } else {
        alert(json.message);
      }
    } catch {
      alert('Erro ao aprovar pagamento.');
    }
  };

  const handleRejectPix = async (paymentId: string) => {
    if (!confirm('Tem certeza que deseja REJEITAR este pagamento? O cliente não será habilitado.')) return;
    try {
      const res = await fetch('/api/portal/admin/approve-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action: 'reject' })
      });
      const json = await res.json();
      if (json.success) {
        alert(json.message);
        fetchPendingPix();
      } else {
        alert(json.message);
      }
    } catch {
      alert('Erro ao rejeitar pagamento.');
    }
  };

  const handleSaveMpToken = async () => {
    setMpSaving(true);
    try {
      const res = await fetch('/api/config/mercadopago', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: mpToken, manualPixKey })
      });
      const data = await res.json();
      if (data.success) {
        alert('Chave API do Mercado Pago salva com sucesso!');
        fetchMpConfig();
      } else {
        alert('Erro ao salvar a chave.');
      }
    } catch {
      alert('Erro de conexão ao salvar chave.');
    } finally {
      setMpSaving(false);
    }
  };

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  // Log cleaning execution
  const handleClearLogs = async (monthOwner: string | null = null, monthLabel: string = '') => {
    const confirmMsg = monthOwner
      ? `Tem certeza que deseja apagar permanentemente todas as transações de ${monthLabel} salvas no MikroTik?`
      : 'Tem certeza que deseja apagar permanentemente TODO o histórico de vendas salvo no MikroTik?';

    if (!confirm(confirmMsg)) return;

    setClearing(true);
    try {
      const url = monthOwner ? `/api/finance?month=${monthOwner}` : '/api/finance';
      const res = await fetch(url, { method: 'DELETE' });
      const resJson = await res.json();
      if (resJson.success) {
        alert(`Sucesso! ${resJson.count} registros de venda foram removidos.`);
        await fetchFinance(); // reload data
      } else {
        alert('Erro ao limpar histórico: ' + resJson.message);
      }
    } catch {
      alert('Erro na conexão com o roteador.');
    } finally {
      setClearing(false);
    }
  };

  // CSV Export handler
  const handleExportCSV = (filteredTransactions: any[]) => {
    if (filteredTransactions.length === 0) {
      alert('Nenhuma transação disponível para exportação.');
      return;
    }

    const headers = ['Data', 'Hora', 'Usuario', 'Preco (R$)', 'Validade', 'Perfil', 'MAC Address', 'IP Address', 'Lote/Comentario'];
    const csvRows = [headers.join(';')];

    filteredTransactions.forEach(t => {
      const row = [
        t.formattedDate,
        t.time,
        t.username,
        t.price.toFixed(2),
        t.validity,
        t.profile,
        t.mac,
        t.ip,
        t.comment
      ];
      csvRows.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'));
    });

    const csvContent = '\uFEFF' + csvRows.join('\n'); // Add BOM for correct encoding in Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `relatorio_vendas_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (notConnected) {
    return (
      <RouterOffline 
        title="Financeiro e Vendas (Mikhmon v3)" 
        description="Faturamento consolidado em tempo real lido das transações persistidas no MikroTik" 
      />
    );
  }

  if (loading) {
    return (
      <main className="p-4 md:p-6 space-y-6">
        <header className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-sm flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <div>
              <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded tracking-wider uppercase">
                Financeiro // Carregando Registros
              </span>
              <h1 className="text-xl md:text-2xl font-black text-slate-900 mt-1">
                Financeiro e Vendas
              </h1>
            </div>
          </div>
        </header>
        <div className="animate-pulse space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="h-28 bg-slate-200/80 rounded-2xl border border-slate-200"></div>
            <div className="h-28 bg-slate-200/80 rounded-2xl border border-slate-200"></div>
            <div className="h-28 bg-slate-200/80 rounded-2xl border border-slate-200"></div>
            <div className="h-28 bg-slate-200/80 rounded-2xl border border-slate-200"></div>
          </div>
          <div className="h-96 bg-slate-200/80 rounded-2xl border border-slate-200"></div>
        </div>
      </main>
    );
  }

  // Filtering transactions
  const allTransactions = financeData?.transactions || [];
  const filteredTransactions = allTransactions.filter((t: any) => {
    const username = String(t.username || '');
    const mac = String(t.mac || '');
    const comment = String(t.comment || '');
    const matchesSearch = 
      username.toLowerCase().includes(search.toLowerCase()) ||
      mac.toLowerCase().includes(search.toLowerCase()) ||
      comment.toLowerCase().includes(search.toLowerCase());

    const matchesProfile = selectedProfile === 'all' || t.profile === selectedProfile;

    // Filter by month key. Date format stored in transactions is year-month (represented by owner/data)
    let matchesMonth = true;
    if (selectedMonth !== 'all') {
      const yearMonthKey = selectedMonth; // e.g. "2026-05"
      const dateParts = t.date.split('/'); // may/22/2026
      
      const monthsMap: Record<string, string> = {
        jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
        jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
      };

      let tYear = '';
      let tMonth = '';

      if (dateParts.length === 3) {
        tYear = dateParts[2].length === 2 ? `20${dateParts[2]}` : dateParts[2];
        const monthAbbrev = dateParts[0].toLowerCase().substring(0, 3);
        tMonth = monthsMap[monthAbbrev] || '01';
      } else if (t.date.includes('-')) {
        const partsHyphen = t.date.split('-');
        if (partsHyphen.length === 3) {
          if (partsHyphen[0].length === 4) {
            tYear = partsHyphen[0];
            tMonth = partsHyphen[1];
          } else {
            tYear = partsHyphen[2].length === 2 ? `20${partsHyphen[2]}` : partsHyphen[2];
            tMonth = partsHyphen[1];
          }
        }
      }
      
      const compKey = `${tYear}-${tMonth}`;
      matchesMonth = compKey === yearMonthKey;
    }

    return matchesSearch && matchesProfile && matchesMonth;
  });

  // Calculate stats on currently filtered items
  const filteredRevenue = filteredTransactions.reduce((acc: number, curr: any) => acc + curr.price, 0);

  // Pagination Logic
  const totalItems = filteredTransactions.length;
  const totalPages = Math.ceil(totalItems / pageSize);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedTransactions = filteredTransactions.slice(startIndex, endIndex);

  return (
    <main className="mg-page-container">
      {/* ── Pending Orders Section ──────────────────────────────────── */}
      {(pendingPix.length > 0 || pendingMp.length > 0) && (
        <section className="space-y-4 mb-2">

          {/* Header comum */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl border border-amber-500/30 bg-amber-500/10 text-amber-500 shrink-0">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                </svg>
              </div>
              <div>
                <h2 className="text-base font-extrabold" style={{ color: 'var(--mg-text-heading)' }}>
                  📋 {pendingCounts.total} Pedido{pendingCounts.total !== 1 ? 's' : ''} Pendente{pendingCounts.total !== 1 ? 's' : ''}
                </h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>
                  {pendingCounts.manual > 0 && <span className="text-amber-500 font-semibold">{pendingCounts.manual} aguardam aprovação manual</span>}
                  {pendingCounts.manual > 0 && pendingCounts.mercadopago > 0 && <span className="mx-1">·</span>}
                  {pendingCounts.mercadopago > 0 && <span className="text-blue-500 font-semibold">{pendingCounts.mercadopago} aguardam webhook MP</span>}
                </p>
              </div>
            </div>
            <button
              onClick={() => fetchPendingPix(true)}
              disabled={refreshingOrders}
              className="mg-btn mg-btn-secondary text-xs"
            >
              <svg className={`w-3.5 h-3.5 ${refreshingOrders ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Atualizar
            </button>
          </div>

          {/* Grupo 1: PIX Manual — requer aprovação do admin */}
          {pendingPix.length > 0 && (
            <div className="mg-card p-5 border-amber-500/40">
              <div className="flex items-center gap-2 mb-4">
                <span className="mg-badge-warning">
                  ✋ PIX MANUAL — AGUARDA APROVAÇÃO
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--mg-text-muted)' }}>Confira o recebimento no seu banco antes de aprovar</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingPix.map((p) => (
                  <div key={p.id} className="mg-card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-sm leading-tight" style={{ color: 'var(--mg-text-heading)' }}>{p.clientName || p.username}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>@{p.username}</p>
                        {p.clientPhone && <p className="text-[11px] text-blue-500 font-semibold mt-0.5">📱 {p.clientPhone}</p>}
                        {p.clientCpf && <p className="text-[11px] mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>CPF: {p.clientCpf}</p>}
                      </div>
                      <span className="text-[10px] whitespace-nowrap font-medium shrink-0" style={{ color: 'var(--mg-text-muted)' }}>{p.formattedDate}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)]">🎟️ {p.plan}</span>
                      {p.isVoucher && <span className="mg-badge-purple text-[11px]">Voucher</span>}
                      {p.giftTo && <span className="mg-badge-primary text-[11px]">🎁 Para: {p.giftTo}</span>}
                    </div>
                    <div className="flex items-center justify-between border border-emerald-500/30 bg-emerald-500/10 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--mg-text-muted)' }}>Valor a receber:</span>
                      <span className="text-lg font-black text-emerald-500">{formatBRL(p.amount)}</span>
                    </div>
                    {p.pixPayload && (
                      <div className="border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] rounded-lg px-3 py-2">
                        <p className="text-[10px] font-black uppercase tracking-wide mb-1" style={{ color: 'var(--mg-text-muted)' }}>Chave PIX enviada ao cliente:</p>
                        <div className="flex items-center gap-2">
                          <code className="text-[11px] font-mono break-all flex-1">{p.pixPayload}</code>
                          <button onClick={() => navigator.clipboard?.writeText(p.pixPayload)} className="text-slate-400 hover:text-blue-500 shrink-0 p-1 rounded" title="Copiar">📋</button>
                        </div>
                      </div>
                    )}
                    <div className="flex gap-2 mt-auto pt-1">
                      <button onClick={() => handleRejectPix(p.id)} className="mg-btn mg-btn-danger flex-1 text-xs py-1.5">✕ Rejeitar</button>
                      <button onClick={() => handleApprovePix(p.id)} className="mg-btn mg-btn-success flex-1 text-xs py-1.5">✓ Aprovar e Liberar</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Grupo 2: Mercado Pago — aguardando webhook automático */}
          {pendingMp.length > 0 && (
            <div className="mg-card p-5 border-blue-500/40">
              <div className="flex items-center gap-2 mb-4">
                <span className="mg-badge-primary">
                  🤖 MERCADO PAGO — AGUARDANDO CONFIRMAÇÃO AUTOMÁTICA
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--mg-text-muted)' }}>O sistema confirma automaticamente via webhook quando o cliente pagar</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingMp.map((p) => (
                  <div key={p.id} className="mg-card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-sm leading-tight" style={{ color: 'var(--mg-text-heading)' }}>{p.clientName || p.username}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>@{p.username}</p>
                        {p.clientPhone && <p className="text-[11px] text-blue-500 font-semibold mt-0.5">📱 {p.clientPhone}</p>}
                      </div>
                      <span className="text-[10px] whitespace-nowrap font-medium shrink-0" style={{ color: 'var(--mg-text-muted)' }}>{p.formattedDate}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)]">🎟️ {p.plan}</span>
                      {p.isVoucher && <span className="mg-badge-purple text-[11px]">Voucher</span>}
                      {p.giftTo && <span className="mg-badge-primary text-[11px]">🎁 Para: {p.giftTo}</span>}
                    </div>
                    <div className="flex items-center justify-between border border-blue-500/30 bg-blue-500/10 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--mg-text-muted)' }}>Valor esperado:</span>
                      <span className="text-lg font-black text-blue-500">{formatBRL(p.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] rounded-lg px-3 py-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0"></span>
                      <span className="text-[11px]" style={{ color: 'var(--mg-text-muted)' }}>MP ID: <code className="font-mono">{p.pixId}</code></span>
                    </div>
                    {/* Admin pode forçar aprovação manual em caso de webhook perdido */}
                    <div className="flex gap-2 mt-auto pt-1">
                      <button onClick={() => handleRejectPix(p.id)} className="mg-btn mg-btn-danger flex-1 text-xs py-1.5">✕ Cancelar</button>
                      <button onClick={() => handleApprovePix(p.id)} className="mg-btn mg-btn-primary flex-1 text-xs py-1.5" title="Aprovar manualmente caso o webhook não tenha chegado">⚡ Forçar Aprovação</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </section>
      )}

      {/* ── Page Header ────────────────────────────────────────────── */}
      <header className="mg-page-header-row">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="mg-badge-success">
              Auditoria Financeira
            </span>
          </div>
          <h1 className="mg-page-title">
            Financeiro e Vendas
          </h1>
          <p className="mg-page-subtitle">
            Faturamento consolidado em tempo real lido das transações persistidas no MikroTik
          </p>
        </div>
        
        <div className="flex items-center gap-3 self-start sm:self-auto">
          <button
            onClick={() => handleExportCSV(filteredTransactions)}
            disabled={filteredTransactions.length === 0}
            className="mg-btn mg-btn-success text-xs flex items-center gap-2"
          >
            <span>📥</span> Exportar CSV
          </button>
          <button
            onClick={() => handleClearLogs(null)}
            disabled={clearing || allTransactions.length === 0}
            className="mg-btn mg-btn-danger text-xs flex items-center gap-2"
          >
            <span>🗑️</span> Limpar Tudo
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="mg-stat-card mg-stat-blue">
          <span className="mg-stat-label">TOTAL FATURAMENTO</span>
          <p className="mg-stat-value text-blue-500">
            {formatBRL(financeData?.totalRevenue || 0)}
          </p>
          <span className="text-xs font-semibold mt-auto" style={{ color: 'var(--mg-text-muted)' }}>Persistido no script do MikroTik</span>
        </div>
        
        <div className="mg-stat-card mg-stat-emerald">
          <span className="mg-stat-label">FATURAMENTO DO MÊS</span>
          <p className="mg-stat-value text-emerald-500">
            {formatBRL(financeData?.monthlyRevenue || 0)}
          </p>
          <span className="text-xs font-semibold mt-auto" style={{ color: 'var(--mg-text-muted)' }}>Vendas do mês atual</span>
        </div>

        <div className="mg-stat-card mg-stat-amber">
          <span className="mg-stat-label">FATURAMENTO HOJE</span>
          <p className="mg-stat-value text-amber-500">
            {formatBRL(financeData?.todayRevenue || 0)}
          </p>
          <span className="text-xs font-semibold mt-auto" style={{ color: 'var(--mg-text-muted)' }}>Vendas nas últimas 24h</span>
        </div>

        <div className="mg-stat-card mg-stat-purple">
          <span className="mg-stat-label">TOTAL DE VOUCHERS</span>
          <p className="mg-stat-value">
            {financeData?.salesCount || 0}
          </p>
          <span className="text-xs font-semibold mt-auto" style={{ color: 'var(--mg-text-muted)' }}>Vouchers gerados no sistema</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Aggregated Panels */}
        <div className="space-y-6 lg:col-span-1">
          {/* Revenue by Profile */}
          <div className="mg-card p-5 md:p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="mg-card-title">
                Faturamento por Plano
              </h3>
            </div>
            
            <div className="overflow-hidden rounded-xl border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] divide-y divide-[var(--mg-card-border)] max-h-60 overflow-y-auto">
              {financeData?.profilesArray.map((p: any, idx: number) => (
                <div key={`${p.name}-${idx}`} className="px-4 py-3 flex justify-between items-center hover:bg-[var(--mg-card-bg-hover)] transition-colors">
                  <div>
                    <span className="font-bold text-sm block" style={{ color: 'var(--mg-text-heading)' }}>{p.name}</span>
                    <span className="block text-[11px] font-medium" style={{ color: 'var(--mg-text-muted)' }}>{p.count} transações</span>
                  </div>
                  <span className="font-extrabold text-sm text-emerald-500">{formatBRL(p.revenue)}</span>
                </div>
              ))}
              {(!financeData?.profilesArray || financeData.profilesArray.length === 0) && (
                <div className="px-4 py-6 text-center text-xs font-medium" style={{ color: 'var(--mg-text-muted)' }}>
                  Nenhum dado consolidado por plano.
                </div>
              )}
            </div>
          </div>
          
          {/* Integração de Pagamento */}
          <div className="mg-card p-5 md:p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="mg-card-title">
                  Opções de Pagamento e PIX
                </h3>
                <p className="mg-card-subtitle">Credenciais e chave bancária</p>
              </div>
            </div>
            
            {/* Mercado Pago API */}
            <label className="mg-label">API Mercado Pago (Automático)</label>
            <div className="flex flex-col gap-2 mb-4">
              <input 
                type="password" 
                className="mg-input" 
                placeholder="APP_USR-XXXXXXXXX-XXXXX..." 
                value={mpToken} 
                onChange={e => setMpToken(e.target.value)} 
              />
            </div>

            {/* Chave Manual */}
            <label className="mg-label">Chave PIX Manual (Modo de Confiança)</label>
            <p className="text-[11px] mb-2 font-medium" style={{ color: 'var(--mg-text-muted)' }}>Utilizado quando o cliente seleciona chave manual no portal.</p>
            <div className="flex flex-col gap-3">
              <input 
                type="text" 
                className="mg-input" 
                placeholder="ex: seu-email@gmail.com, CPF, Telefone..." 
                value={manualPixKey} 
                onChange={e => setManualPixKey(e.target.value)} 
              />
              <button 
                className="mg-btn mg-btn-primary w-full mt-1" 
                onClick={handleSaveMpToken}
                disabled={mpSaving}
              >
                {mpSaving ? 'Salvando...' : 'Salvar Configurações de Pagamento'}
              </button>
            </div>
          </div>

          {/* Revenue by Month & Deletion Controls */}
          <div className="mg-card p-5 md:p-6 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="mg-card-title">
                Fechamentos Consolidados
              </h3>
            </div>
            
            <div className="overflow-hidden rounded-xl border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] divide-y divide-[var(--mg-card-border)] max-h-64 overflow-y-auto">
              {financeData?.monthsArray.map((m: any, idx: number) => {
                const monthsNames: Record<string, string> = {
                  '01': 'jan', '02': 'feb', '03': 'mar', '04': 'apr', '05': 'may', '06': 'jun',
                  '07': 'jul', '08': 'aug', '09': 'sep', '10': 'oct', '11': 'nov', '12': 'dec'
                };
                const [year, month] = m.key.split('-');
                const monthName = monthsNames[month] || 'jan';
                const ownerString = `${monthName}${year}`;

                return (
                  <div key={`${m.key}-${idx}`} className="px-4 py-3 flex justify-between items-center hover:bg-[var(--mg-card-bg-hover)] transition-colors">
                    <div>
                      <span className="font-bold text-sm block" style={{ color: 'var(--mg-text-heading)' }}>{m.label}</span>
                      <span className="block text-[11px] font-medium" style={{ color: 'var(--mg-text-muted)' }}>{m.count} vendas</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-extrabold text-sm text-emerald-500">{formatBRL(m.revenue)}</span>
                      <button
                        onClick={() => handleClearLogs(ownerString, m.label)}
                        title={`Limpar histórico de ${m.label}`}
                        className="p-1 text-rose-500 hover:text-rose-700 hover:scale-110 transition-all cursor-pointer"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
              {(!financeData?.monthsArray || financeData?.monthsArray.length === 0) && (
                <div className="p-6 text-center text-xs italic font-medium" style={{ color: 'var(--mg-text-muted)' }}>Nenhum fechamento consolidado.</div>
              )}
            </div>
          </div>
        </div>

        {/* Interactive Transaction Log Table */}
        <div className="mg-card p-5 md:p-6 lg:col-span-2 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="mg-card-title">
                Histórico de Transações
              </h3>
              <p className="mg-card-subtitle">Listagem dinâmica com filtragem instantânea</p>
            </div>
            
            <div className="text-right">
              <span className="text-[11px] font-extrabold uppercase tracking-wider block" style={{ color: 'var(--mg-text-muted)' }}>Total Filtrado</span>
              <span className="text-xl font-black text-emerald-500">
                {formatBRL(filteredRevenue)}
              </span>
            </div>
          </div>

          {/* Filters Bar */}
          <div className="flex flex-col md:flex-row gap-3">
            <div className="flex-1">
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                placeholder="Buscar por usuário, MAC ou lote..."
                className="mg-input"
              />
            </div>
            
            <div className="w-full md:w-44">
              <select
                value={selectedProfile}
                onChange={(e) => { setSelectedProfile(e.target.value); setCurrentPage(1); }}
                className="mg-select"
              >
                <option value="all">Todos os Perfis</option>
                {financeData?.profilesArray.map((p: any) => (
                  <option key={p.name} value={p.name}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="w-full md:w-44">
              <select
                value={selectedMonth}
                onChange={(e) => { setSelectedMonth(e.target.value); setCurrentPage(1); }}
                className="mg-select"
              >
                <option value="all">Todos os Meses</option>
                {financeData?.monthsArray.map((m: any) => (
                  <option key={m.key} value={m.key}>{m.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Table Container */}
          <div className="mg-table-wrap">
            <table className="mg-table whitespace-nowrap">
              <thead>
                <tr>
                  <th>Data / Hora</th>
                  <th>Usuário</th>
                  <th>Plano</th>
                  <th>Preço</th>
                  <th>Vencimento</th>
                  <th>MAC Address</th>
                  <th>Lote/Comentário</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTransactions.map((t: any, idx: number) => (
                  <tr key={`${t.id}-${idx}`}>
                    <td>
                      <span className="font-black block text-xs" style={{ color: 'var(--mg-text-heading)' }}>{t.formattedDate}</span>
                      <span className="block text-xs font-mono font-bold leading-none mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>{t.time}</span>
                    </td>
                    <td className="font-black text-xs" style={{ color: 'var(--mg-primary)' }}>{t.username}</td>
                    <td className="font-bold text-xs" style={{ color: 'var(--mg-text-body)' }}>{t.profile}</td>
                    <td className="font-black text-xs text-emerald-500">{formatBRL(t.price)}</td>
                    <td className="font-mono font-bold text-xs" style={{ color: 'var(--mg-text-muted)' }}>{t.validity || 'indefinida'}</td>
                    <td className="font-mono font-bold text-xs" style={{ color: 'var(--mg-text-muted)' }}>{t.mac || 'bypassed/trial'}</td>
                    <td className="font-medium text-xs max-w-xs overflow-hidden text-ellipsis" style={{ color: 'var(--mg-text-muted)' }} title={t.comment}>
                      {t.comment || '-'}
                    </td>
                  </tr>
                ))}
                {paginatedTransactions.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center italic font-bold" style={{ color: 'var(--mg-text-muted)' }}>
                      Nenhuma transação financeira corresponde aos filtros selecionados.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-4 border-t border-[var(--mg-card-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <span className="font-medium" style={{ color: 'var(--mg-text-muted)' }}>
                Exibindo {startIndex + 1} - {endIndex} de {totalItems} transações
              </span>
              
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="mg-btn mg-btn-secondary !py-1 !px-2.5 text-xs"
                >
                  Anterior
                </button>
                
                {Array.from({ length: totalPages }).map((_, i) => {
                  const pageNum = i + 1;
                  if (pageNum === 1 || pageNum === totalPages || Math.abs(pageNum - currentPage) <= 1) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setCurrentPage(pageNum)}
                        className={`text-xs font-bold py-1 px-2.5 rounded-lg transition-all ${
                          currentPage === pageNum
                            ? 'mg-btn mg-btn-primary !py-1 !px-2.5'
                            : 'mg-btn mg-btn-secondary !py-1 !px-2.5'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  if (pageNum === 2 || pageNum === totalPages - 1) {
                    return <span key={pageNum} className="text-slate-400 px-0.5">...</span>;
                  }
                  return null;
                })}

                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="mg-btn mg-btn-secondary !py-1 !px-2.5 text-xs"
                >
                  Próxima
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
