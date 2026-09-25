"use client";

import { useEffect, useState } from 'react';
import RouterOffline from '@/components/RouterOffline';

export default function SecurityControl() {
  const [activeTab, setActiveTab] = useState<'walled-garden' | 'time-block' | 'keywords' | 'blacklist'>('walled-garden');
  const [notConnected, setNotConnected] = useState(false);
  
  // Walled Garden States
  const [rules, setRules] = useState<any[]>([]);
  const [walledLoading, setWalledLoading] = useState(true);
  const [host, setHost] = useState('');
  const [action, setAction] = useState('allow');
  const [comment, setComment] = useState('');
  
  // Time Block States
  const [startHour, setStartHour] = useState('22:00:00');
  const [endHour, setEndHour] = useState('06:00:00');
  const [timeLoading, setTimeLoading] = useState(false);
  const [timeRules, setTimeRules] = useState<any[]>([]);

  // Keywords States
  const [keywords, setKeywords] = useState<any[]>([]);
  const [keywordInput, setKeywordInput] = useState('');
  const [keywordsLoading, setKeywordsLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Blacklist States
  const [blockedClients, setBlockedClients] = useState<any[]>([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [unblockingId, setUnblockingId] = useState<string | null>(null);
  const [blockMac, setBlockMac] = useState('');
  const [blockCpf, setBlockCpf] = useState('');
  const [blockPhone, setBlockPhone] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockSubmitting, setBlockSubmitting] = useState(false);

  const fetchBlockedClients = async () => {
    setBlacklistLoading(true);
    try {
      const res = await fetch('/api/portal/admin/blacklist');
      const data = await res.json();
      if (data.success) setBlockedClients(data.data);
    } catch (e) { console.error(e); }
    finally { setBlacklistLoading(false); }
  };

  const handleUnblock = async (id: string, mac?: string) => {
    if (!confirm('Desbloquear este cliente? O MAC será removido do ip-binding do MikroTik e o cliente poderá se recadastrar.')) return;
    setUnblockingId(id);
    try {
      const params = mac ? `?mac=${encodeURIComponent(mac)}` : `?id=${id}`;
      const res = await fetch(`/api/portal/admin/blacklist${params}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setBlockedClients(prev => prev.filter(c => c.id !== id));
        alert('✅ Cliente desbloqueado com sucesso!' + (data.data?.mkUnblocked ? '\nMAC removido do MikroTik.' : '\nAviso: não foi possível remover do MikroTik.'));
      } else {
        alert('Erro: ' + data.message);
      }
    } catch { alert('Erro ao desbloquear cliente'); }
    finally { setUnblockingId(null); }
  };

  const handleManualBlock = async () => {
    if (!blockMac && !blockCpf && !blockPhone) { alert('Informe pelo menos um identificador.'); return; }
    setBlockSubmitting(true);
    try {
      const res = await fetch('/api/portal/admin/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: blockMac, cpf: blockCpf, phone: blockPhone, reason: blockReason || 'Bloqueio manual pelo admin' })
      });
      const data = await res.json();
      if (data.success) {
        setBlockMac(''); setBlockCpf(''); setBlockPhone(''); setBlockReason('');
        fetchBlockedClients();
      } else {
        alert('Erro: ' + data.message);
      }
    } catch { alert('Erro ao bloquear'); }
    finally { setBlockSubmitting(false); }
  };

  // Trial / Grace-period leads (carência usada sem pagamento)
  const [trialLeads, setTrialLeads] = useState<any[]>([]);
  const [trialLoading, setTrialLoading] = useState(false);
  const [trialSearch, setTrialSearch] = useState('');
  const [unlockingLeadId, setUnlockingLeadId] = useState<string | null>(null);

  const fetchTrialLeads = async (search = '') => {
    setTrialLoading(true);
    try {
      const params = search ? `?blocked=true&search=${encodeURIComponent(search)}` : '?blocked=true';
      const res = await fetch(`/api/portal/admin/leads${params}`);
      const data = await res.json();
      if (data.success) {
        // Only show leads with expired trial (used grace, no approved payment)
        const expired = (data.data as any[]).filter(l => l.trialUsed && !l.hasApproved);
        setTrialLeads(expired);
      }
    } catch (e) { console.error(e); }
    finally { setTrialLoading(false); }
  };

  const handleUnlockLead = async (leadId: string, name: string) => {
    if (!confirm(`Liberar "${name}"? A carência será resetada, pagamentos pendentes cancelados e o MAC desbloqueado no MikroTik.`)) return;
    setUnlockingLeadId(leadId);
    try {
      const res = await fetch(`/api/portal/admin/leads?id=${leadId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setTrialLeads(prev => prev.filter(l => l.id !== leadId));
        alert('✅ ' + data.message);
      } else {
        alert('Erro: ' + data.message);
      }
    } catch { alert('Erro ao liberar cliente'); }
    finally { setUnlockingLeadId(null); }
  };

  const fetchWalledGardenRules = async () => {
    setWalledLoading(true);
    try {
      const res = await fetch('/api/security/walled-garden');
      if (res.status === 401) {
        setNotConnected(true);
        setWalledLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setRules(data.data);
        setNotConnected(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setWalledLoading(false);
    }
  };

  const fetchKeywords = async () => {
    setKeywordsLoading(true);
    try {
      const res = await fetch('/api/security/keywords');
      if (res.status === 401) {
        setNotConnected(true);
        setKeywordsLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setKeywords(data.data);
        setNotConnected(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setKeywordsLoading(false);
    }
  };

  const fetchTimeRules = async () => {
    setTimeLoading(true);
    try {
      const res = await fetch('/api/security/time-block');
      if (res.status === 401) {
        setNotConnected(true);
        setTimeLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setTimeRules(data.data);
        setNotConnected(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeLoading(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      fetchWalledGardenRules();
      fetchKeywords();
      fetchTimeRules();
      fetchBlockedClients();
      fetchTrialLeads();
    }, 0);
  }, []);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setWalledLoading(true);
    try {
      await fetch('/api/security/walled-garden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, host, comment })
      });
      setHost('');
      setComment('');
      fetchWalledGardenRules();
    } catch {
      setWalledLoading(false);
    }
  };

  const handleWhitelistMikroGestor = async () => {
    setWalledLoading(true);
    try {
      // 1. Fetch server LAN IP and MAC from backend
      const ipRes = await fetch('/api/system/network');
      const ipData = await ipRes.json();
      let targetIp = window.location.hostname;
      let targetMac = '';
      
      if (ipData.success && ipData.ip && ipData.ip !== '127.0.0.1') {
        targetIp = ipData.ip;
        targetMac = ipData.mac || '';
      }
      
      // 2. Add rule to Walled Garden & Auto-Create IP Binding
      await fetch('/api/security/walled-garden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'allow', 
          host: targetIp, 
          mac: targetMac,
          comment: 'MikroGestor Auto-Cadastro / API' 
        })
      });
      alert(`Servidor ${targetIp} (MAC: ${targetMac || 'N/A'}) liberado com sucesso no Walled Garden e IP Bindings!`);
      fetchWalledGardenRules();
    } catch {
      alert('Erro ao liberar servidor.');
      setWalledLoading(false);
    }
  };

  const handleDeleteSite = async (id: string) => {
    setWalledLoading(true);
    try {
      await fetch('/api/security/walled-garden', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      fetchWalledGardenRules();
    } catch {
      setWalledLoading(false);
    }
  };

  const handleAddTimeBlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setTimeLoading(true);
    const activeDays = 'sun,mon,tue,wed,thu,fri,sat';
    
    try {
      const res = await fetch('/api/security/time-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ startTime: startHour, endTime: endHour, days: activeDays, comment: 'Bloqueio Geral' })
      });
      const data = await res.json();
      if (data.success) {
        alert('Regra de bloqueio de horário ativada com sucesso no MikroTik!');
        fetchTimeRules();
      } else {
        alert('Erro ao criar regra: ' + data.message);
      }
    } catch {
      alert('Erro ao criar regra de bloqueio.');
    } finally {
      setTimeLoading(false);
    }
  };

  const handleDeleteTimeRule = async (id: string) => {
    setTimeLoading(true);
    try {
      const res = await fetch('/api/security/time-block', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchTimeRules();
      } else {
        alert(data.message || 'Erro ao remover regra.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setTimeLoading(false);
    }
  };

  const handleAddKeyword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!keywordInput.trim()) return;
    setActionLoading(true);
    try {
      const res = await fetch('/api/security/keywords', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keywordInput })
      });
      const data = await res.json();
      if (data.success) {
        setKeywordInput('');
        fetchKeywords();
      } else {
        alert(data.message || 'Erro ao adicionar palavra-chave.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteKeyword = async (keyword: string) => {
    setActionLoading(true);
    try {
      const res = await fetch('/api/security/keywords', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      });
      const data = await res.json();
      if (data.success) {
        fetchKeywords();
      } else {
        alert(data.message || 'Erro ao remover palavra-chave.');
      }
    } catch (err) {
      console.error(err);
    } finally {
      setActionLoading(false);
    }
  };

  if (notConnected) {
    return (
      <RouterOffline 
        title="Segurança e Acessos" 
        description="Gerencie firewalls, sites liberados pré-login e bloqueio por palavras-chave" 
      />
    );
  }

  return (
    <main className="mg-page-container max-w-6xl mx-auto">
      {/* Page Header */}
      <header className="mg-page-header-row">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="mg-badge-danger">
              Firewall & Acessos
            </span>
          </div>
          <h1 className="mg-page-title">
            Segurança e Acessos
          </h1>
          <p className="mg-page-subtitle">
            Gerencie firewalls, sites liberados pré-login no Hotspot e bloqueio por palavras-chave
          </p>
        </div>
      </header>

      {/* Tabs Menu */}
      <nav className="mg-tabs-container">
        <button
          onClick={() => setActiveTab('walled-garden')}
          className={`mg-tab-item ${activeTab === 'walled-garden' ? 'active' : ''}`}
        >
          🌐 Sites Walled Garden
        </button>
        <button
          onClick={() => setActiveTab('time-block')}
          className={`mg-tab-item ${activeTab === 'time-block' ? 'active' : ''}`}
        >
          🕒 Bloqueio de Horário
        </button>
        <button
          onClick={() => setActiveTab('keywords')}
          className={`mg-tab-item ${activeTab === 'keywords' ? 'active' : ''}`}
        >
          🚫 Palavras-Chave
        </button>
        <button
          onClick={() => { setActiveTab('blacklist'); fetchBlockedClients(); fetchTrialLeads(); }}
          className={`mg-tab-item ${activeTab === 'blacklist' ? 'active' : ''}`}
        >
          🔒 Bloqueios & Carência
          {(blockedClients.length + trialLeads.length) > 0 && (
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-500">
              {blockedClients.length + trialLeads.length}
            </span>
          )}
        </button>
      </nav>

      {/* Tab Content Cabinet */}
      <div className="space-y-6">
        
        {/* Walled Garden Tab */}
        {activeTab === 'walled-garden' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-1">
                  Criar Regra
                </h3>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">
                  Permita ou bloqueie domínios de passarem pelo Hotspot antes de realizar o login.
                </p>
                
                <form onSubmit={handleAddSite} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5">Domínio / Host</label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      required
                      placeholder="Ex: google.com"
                      className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-blue-600 rounded-xl p-2.5 text-xs font-medium text-slate-900 outline-none shadow-sm placeholder:text-slate-400"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5">Ação</label>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-blue-600 rounded-xl p-2.5 text-xs font-semibold text-slate-800 outline-none shadow-sm"
                    >
                      <option value="allow">Liberar (Permitir)</option>
                      <option value="deny">Bloquear (Negar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5">Comentário</label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ex: Liberar updates"
                      className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-blue-600 rounded-xl p-2.5 text-xs font-medium text-slate-900 outline-none shadow-sm placeholder:text-slate-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={walledLoading}
                    className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {walledLoading ? 'Processando...' : 'Adicionar Regra'}
                  </button>
                </form>
              </div>

              <div className="pt-4 mt-6 border-t border-slate-200">
                <span className="block text-xs font-bold uppercase text-slate-700 tracking-wider mb-2">Acesso Rápido</span>
                <button
                  type="button"
                  onClick={handleWhitelistMikroGestor}
                  disabled={walledLoading}
                  className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  ⚡ Liberar Auto Cadastro / API
                </button>
                <p className="text-[11px] text-slate-500 text-center mt-2 leading-normal font-medium">
                  Libera o IP/Domínio deste painel no Walled Garden e IP Bindings do MikroTik.
                </p>
              </div>
            </div>

            {/* List Section */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-black text-slate-900">
                  Regras Ativas
                </h3>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1">
                  {rules.length} REGRAS
                </span>
              </div>
              
              <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[460px] overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3">Site / Domínio</th>
                        <th className="px-5 py-3">Ação</th>
                        <th className="px-5 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {walledLoading && rules.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-slate-500 italic font-medium">
                            <div className="inline-block animate-pulse">Consultando regras do Walled Garden...</div>
                          </td>
                        </tr>
                      ) : rules.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-slate-500 italic font-medium">
                            Nenhuma regra cadastrada no Walled Garden.
                          </td>
                        </tr>
                      ) : (
                        rules.map((rule, index) => (
                          <tr key={`${rule.id || rule.host}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-slate-900 text-sm">{rule.host}</td>
                            <td className="px-5 py-3.5">
                              <span className={rule.action === 'allow' ? 'mg-badge-success' : 'mg-badge-danger'}>
                                {rule.action === 'allow' ? 'LIBERADO' : 'BLOQUEADO'}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteSite(rule.id)}
                                className="mg-btn-danger text-xs px-3 py-1.5 rounded-lg font-bold"
                              >
                                Remover
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Time Blocking Tab */}
        {activeTab === 'time-block' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-1">
                  Agendar Bloqueio
                </h3>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">
                  Crie janelas de bloqueio temporário para cessar a navegação de hotspot na rede local.
                </p>

                <form onSubmit={handleAddTimeBlock} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5">Início (Bloqueio)</label>
                      <input
                        type="time"
                        value={startHour}
                        onChange={(e) => setStartHour(e.target.value)}
                        required
                        step="1"
                        className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-rose-600 rounded-xl p-2.5 text-xs font-bold text-rose-700 outline-none shadow-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5">Fim (Liberação)</label>
                      <input
                        type="time"
                        value={endHour}
                        onChange={(e) => setEndHour(e.target.value)}
                        required
                        step="1"
                        className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-600 rounded-xl p-2.5 text-xs font-bold text-emerald-700 outline-none shadow-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 tracking-wider mb-2">Dias Ativos</label>
                    <div className="flex flex-wrap gap-2">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                        <label key={dia} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-semibold text-slate-700">
                          <input type="checkbox" defaultChecked className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer" />
                          <span>{dia}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={timeLoading}
                    className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {timeLoading ? 'Aplicando...' : 'Ativar Regra'}
                  </button>
                  <p className="text-[11px] text-slate-500 text-center mt-1 font-medium">A regra de filtragem drop será aplicada no Forward Chain do Firewall.</p>
                </form>
              </div>
            </div>

            {/* List Section */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-black text-slate-900">
                  Bloqueios Agendados
                </h3>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1">
                  {timeRules.length} REGRAS
                </span>
              </div>
              
              <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[460px] overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3">Horário de Bloqueio</th>
                        <th className="px-5 py-3">Dias da Semana</th>
                        <th className="px-5 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {timeLoading && timeRules.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-slate-500 italic font-medium">
                            <div className="inline-block animate-pulse">Consultando agendamentos...</div>
                          </td>
                        </tr>
                      ) : timeRules.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-slate-500 italic font-medium">
                            Nenhuma regra de bloqueio de horário configurada.
                          </td>
                        </tr>
                      ) : (
                        timeRules.map((rule, index) => {
                          const timeParts = rule.time ? rule.time.split(',') : [];
                          const hours = timeParts[0] || '';
                          const days = timeParts[1] || 'todos';
                          return (
                            <tr key={`${rule.id || index}`} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-5 py-3.5 font-bold text-rose-700 text-sm tracking-wide">{hours.replace('-', ' às ')}</td>
                              <td className="px-5 py-3.5 text-xs">
                                <span className="inline-flex items-center text-[10px] font-bold px-2.5 py-0.5 rounded-full border bg-amber-50 text-amber-700 border-amber-200">{days}</span>
                              </td>
                              <td className="px-5 py-3.5 text-right">
                                <button
                                  onClick={() => handleDeleteTimeRule(rule.id)}
                                  disabled={timeLoading}
                                  className="mg-btn-danger text-xs px-3 py-1.5 rounded-lg font-bold"
                                >
                                  Remover
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Keywords Blocking Tab */}
        {activeTab === 'keywords' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Form Section */}
            <div className="lg:col-span-1 bg-white border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 mb-1">
                  Bloquear Conteúdo
                </h3>
                <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">
                  Derruba conexões cujo domínio (HTTP Header ou SNI HTTPS) contenha as palavras indicadas.
                </p>
                
                <form onSubmit={handleAddKeyword} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5">Palavra-Chave</label>
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      required
                      placeholder="Ex: torrent, poker, bet"
                      className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-blue-600 rounded-xl p-2.5 text-xs font-medium text-slate-900 outline-none shadow-sm placeholder:text-slate-400"
                    />
                    <span className="text-[11px] text-slate-500 mt-1.5 block leading-normal font-medium">
                      Pesquisas no Google continuarão disponíveis, porém domínios diretos com o termo serão bloqueados.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="w-full py-2.5 px-4 text-xs font-bold rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {actionLoading ? 'Aplicando Regra...' : 'Bloquear Termo'}
                  </button>
                </form>
              </div>
            </div>

            {/* List Section */}
            <div className="lg:col-span-2 bg-white border border-slate-200/80 rounded-2xl p-5 md:p-6 shadow-sm flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-base font-black text-slate-900">
                  Termos Bloqueados
                </h3>
                <span className="bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-lg px-2.5 py-1">
                  {keywords.length} TERMOS
                </span>
              </div>
              
              <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="max-h-[460px] overflow-auto custom-scrollbar">
                  <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                        <th className="px-5 py-3">Termo Bloqueado</th>
                        <th className="px-5 py-3">Método de Filtro</th>
                        <th className="px-5 py-3 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {keywordsLoading && keywords.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-slate-500 italic font-medium">
                            <div className="inline-block animate-pulse">Lendo palavras bloqueadas...</div>
                          </td>
                        </tr>
                      ) : keywords.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="px-5 py-8 text-center text-slate-500 italic font-medium">
                            Nenhuma palavra-chave bloqueada no firewall.
                          </td>
                        </tr>
                      ) : (
                        keywords.map((kw, index) => (
                          <tr key={`${kw.id || kw.keyword}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-5 py-3.5 font-bold text-rose-700 text-sm font-mono">{kw.keyword}</td>
                            <td className="px-5 py-3.5">
                              <div className="flex gap-2">
                                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-indigo-50 text-indigo-700 border-indigo-200">HTTP CONTENT</span>
                                <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full border bg-sky-50 text-sky-700 border-sky-200">HTTPS TLS-SNI</span>
                              </div>
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                onClick={() => handleDeleteKeyword(kw.keyword)}
                                disabled={actionLoading}
                                className="px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors shadow-xs"
                              >
                                🔓 Desbloquear
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Blacklist Tab */}
        {activeTab === 'blacklist' && (
          <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">🔒 Clientes Bloqueados</h2>
                <p className="text-xs text-slate-500 mt-0.5">Clientes bloqueados por não pagamento no prazo ou por bloqueio manual. Clique em Desbloquear para liberar o acesso.</p>
              </div>
              <button onClick={fetchBlockedClients} disabled={blacklistLoading}
                className="flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 border border-slate-200 text-slate-700 transition-colors">
                {blacklistLoading ? <span className="animate-spin">⟳</span> : '↻'} Atualizar
              </button>
            </div>

            {/* Clients Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <th className="px-4 py-3">Cliente</th>
                      <th className="px-4 py-3">MAC Address</th>
                      <th className="px-4 py-3">CPF / Telefone</th>
                      <th className="px-4 py-3">Motivo</th>
                      <th className="px-4 py-3">Bloqueado em</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {blacklistLoading && blockedClients.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">
                        <div className="inline-block animate-pulse">Carregando clientes bloqueados...</div>
                      </td></tr>
                    ) : blockedClients.length === 0 ? (
                      <tr><td colSpan={6} className="px-4 py-10 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="text-3xl">✅</span>
                          <p className="text-slate-500 font-medium text-sm">Nenhum cliente bloqueado</p>
                          <p className="text-slate-400 text-xs">O sistema bloqueia automaticamente quem não paga no prazo</p>
                        </div>
                      </td></tr>
                    ) : blockedClients.map((c) => (
                      <tr key={c.id} className="hover:bg-red-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{c.phone || c.cpf || '—'}</div>
                          {c.cpf && <div className="text-[10px] text-slate-400">CPF: {c.cpf}</div>}
                        </td>
                        <td className="px-4 py-3">
                          {c.mac ? (
                            <span className="font-mono text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded">{c.mac}</span>
                          ) : <span className="text-slate-400 italic">Sem MAC</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="space-y-0.5">
                            {c.cpf && <div className="text-slate-600">CPF: <span className="font-mono">{c.cpf}</span></div>}
                            {c.phone && <div className="text-slate-600">📱 {c.phone}</div>}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-1 rounded-full bg-red-50 border border-red-200 text-red-700">
                            🚫 {c.reason || 'Não pagou no prazo'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500">
                          {c.blockedAt ? new Date(c.blockedAt).toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleUnblock(c.id, c.mac)}
                            disabled={unblockingId === c.id}
                            className="flex items-center gap-1.5 ml-auto px-3 py-1.5 text-xs font-bold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors shadow-sm disabled:opacity-50"
                          >
                            {unblockingId === c.id ? <span className="animate-spin">⟳</span> : '🔓'}
                            Desbloquear
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Manual Block Form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-5">
              <h3 className="font-black text-slate-800 mb-3 text-sm">➕ Bloquear Manualmente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input value={blockMac} onChange={e => setBlockMac(e.target.value)}
                  placeholder="MAC (AA:BB:CC:DD:EE:FF)"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                <input value={blockCpf} onChange={e => setBlockCpf(e.target.value)}
                  placeholder="CPF"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                <input value={blockPhone} onChange={e => setBlockPhone(e.target.value)}
                  placeholder="Telefone"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30" />
                <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="border border-slate-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-500/30" />
              </div>
              <button onClick={handleManualBlock} disabled={blockSubmitting}
                className="mt-3 flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors shadow-sm disabled:opacity-50">
                {blockSubmitting ? <span className="animate-spin">⟳</span> : '🔒'} Bloquear Cliente
              </button>
            </div>

            {/* Grace Period / Trial Unblock Section */}
            <div className="bg-white border border-amber-200 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-5 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-100 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⏱️</span>
                    <h3 className="font-black text-slate-900 text-base">Liberação de Carência (15 min expirados)</h3>
                    {trialLeads.length > 0 && (
                      <span className="bg-amber-100 text-amber-800 text-[10px] font-black px-2 py-0.5 rounded-full border border-amber-300">
                        {trialLeads.length} aguardando
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-600 mt-1">
                    Clientes que utilizaram o tempo de carência de 15 minutos sem efetuar o pagamento. Clique em <strong>Liberar Carência</strong> para resetar o tempo, remover da lista negra e permitir que o cliente gere um novo Pix ou navegue novamente.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 md:w-64">
                    <input
                      value={trialSearch}
                      onChange={e => setTrialSearch(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') fetchTrialLeads(trialSearch); }}
                      placeholder="Buscar CPF, telefone, MAC..."
                      className="w-full bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                    />
                    {trialSearch && (
                      <button
                        onClick={() => { setTrialSearch(''); fetchTrialLeads(''); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => fetchTrialLeads(trialSearch)}
                    disabled={trialLoading}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-xs"
                  >
                    {trialLoading ? '⟳' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div className="max-h-[500px] overflow-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <th className="px-4 py-3">Cliente / Contato</th>
                      <th className="px-4 py-3">CPF</th>
                      <th className="px-4 py-3">MAC Address</th>
                      <th className="px-4 py-3">Carência Usada</th>
                      <th className="px-4 py-3">Histórico de Pix</th>
                      <th className="px-4 py-3 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {trialLoading && trialLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-400 italic">
                          <div className="inline-block animate-pulse">Consultando clientes com carência...</div>
                        </td>
                      </tr>
                    ) : trialLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center">
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-3xl">✨</span>
                            <p className="text-slate-600 font-medium text-sm">Nenhum cliente com carência pendente</p>
                            <p className="text-slate-400 text-xs">Todos os cadastros recentes efetuaram pagamento ou não atingiram o limite de carência.</p>
                          </div>
                        </td>
                      </tr>
                    ) : trialLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-amber-50/40 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-bold text-slate-800">{lead.name || 'Sem nome'}</div>
                          <div className="text-[11px] text-slate-500 font-mono">📱 {lead.phone || 'Sem telefone'}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-slate-700">{lead.cpf || '—'}</span>
                        </td>
                        <td className="px-4 py-3">
                          {lead.mac ? (
                            <span className="font-mono text-xs bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded">
                              {lead.mac}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Sem MAC</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {lead.trialGrantedAt ? (
                            <div>
                              <div className="font-bold text-amber-700">15 min expirados</div>
                              <div className="text-[10px] text-slate-400">
                                {new Date(lead.trialGrantedAt).toLocaleString('pt-BR')}
                              </div>
                            </div>
                          ) : lead.trialBlocked ? (
                            <span className="inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              Bloqueado
                            </span>
                          ) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          {lead.payments && lead.payments.length > 0 ? (
                            <div className="space-y-1">
                              {lead.payments.map((p: any) => (
                                <div key={p.id} className="text-[10px] flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.2 rounded font-bold ${
                                    p.status === 'approved' ? 'bg-emerald-100 text-emerald-700' :
                                    p.status === 'pending' ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-slate-600'
                                  }`}>
                                    {p.status === 'approved' ? '✓ Pago' : p.status === 'pending' ? '⏳ Pendente' : p.status}
                                  </span>
                                  <span className="font-semibold text-slate-700">R$ {Number(p.amount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">Nenhum Pix gerado</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleUnlockLead(lead.id, lead.name || lead.phone || lead.cpf || 'Cliente')}
                            disabled={unlockingLeadId === lead.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-600 hover:bg-amber-700 text-white transition-colors shadow-sm disabled:opacity-50"
                          >
                            {unlockingLeadId === lead.id ? <span className="animate-spin">⟳</span> : '🔓'}
                            Liberar Carência
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </main>
  );
}
