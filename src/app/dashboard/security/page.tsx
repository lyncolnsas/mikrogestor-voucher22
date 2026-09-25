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
            <div className="mg-card p-5 md:p-6 flex flex-col justify-between">
              <div>
                <h3 className="mg-card-title mb-1">
                  Criar Regra
                </h3>
                <p className="mg-card-subtitle mb-4 leading-relaxed">
                  Permita ou bloqueie domínios de passarem pelo Hotspot antes de realizar o login.
                </p>
                
                <form onSubmit={handleAddSite} className="space-y-4">
                  <div>
                    <label className="mg-label">Domínio / Host</label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      required
                      placeholder="Ex: google.com"
                      className="mg-input"
                    />
                  </div>

                  <div>
                    <label className="mg-label">Ação</label>
                    <select
                      value={action}
                      onChange={(e) => setAction(e.target.value)}
                      className="mg-select"
                    >
                      <option value="allow">Liberar (Permitir)</option>
                      <option value="deny">Bloquear (Negar)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mg-label">Comentário</label>
                    <input
                      type="text"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Ex: Liberar updates"
                      className="mg-input"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={walledLoading}
                    className="mg-btn mg-btn-primary w-full"
                  >
                    {walledLoading ? 'Processando...' : 'Adicionar Regra'}
                  </button>
                </form>
              </div>

              <div className="pt-4 mt-6 border-t border-[var(--mg-card-border)]">
                <span className="mg-label mb-2">Acesso Rápido</span>
                <button
                  type="button"
                  onClick={handleWhitelistMikroGestor}
                  disabled={walledLoading}
                  className="mg-btn mg-btn-success w-full"
                >
                  ⚡ Liberar Auto Cadastro / API
                </button>
                <p className="text-[11px] text-center mt-2 leading-normal font-medium" style={{ color: 'var(--mg-text-muted)' }}>
                  Libera o IP/Domínio deste painel no Walled Garden e IP Bindings do MikroTik.
                </p>
              </div>
            </div>

            {/* List Section */}
            <div className="mg-card p-5 md:p-6 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="mg-card-title">
                  Regras Ativas
                </h3>
                <span className="mg-badge-primary">
                  {rules.length} REGRAS
                </span>
              </div>
              
              <div className="mg-table-wrap flex-1">
                <div className="max-h-[460px] overflow-auto custom-scrollbar">
                  <table className="mg-table">
                    <thead>
                      <tr>
                        <th>Site / Domínio</th>
                        <th>Ação</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {walledLoading && rules.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center italic font-medium" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                            <div className="inline-block animate-pulse">Consultando regras do Walled Garden...</div>
                          </td>
                        </tr>
                      ) : rules.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center italic font-medium" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                            Nenhuma regra cadastrada no Walled Garden.
                          </td>
                        </tr>
                      ) : (
                        rules.map((rule, index) => (
                          <tr key={`${rule.id || rule.host}-${index}`}>
                            <td className="font-bold text-sm" style={{ color: 'var(--mg-text-heading)' }}>{rule.host}</td>
                            <td>
                              <span className={rule.action === 'allow' ? 'mg-badge-success' : 'mg-badge-danger'}>
                                {rule.action === 'allow' ? 'LIBERADO' : 'BLOQUEADO'}
                              </span>
                            </td>
                            <td className="text-right">
                              <button
                                onClick={() => handleDeleteSite(rule.id)}
                                className="mg-btn mg-btn-danger text-xs"
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
            <div className="mg-card p-5 md:p-6 flex flex-col justify-between">
              <div>
                <h3 className="mg-card-title mb-1">
                  Agendar Bloqueio
                </h3>
                <p className="mg-card-subtitle mb-4 leading-relaxed">
                  Crie janelas de bloqueio temporário para cessar a navegação de hotspot na rede local.
                </p>

                <form onSubmit={handleAddTimeBlock} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="mg-label">Início (Bloqueio)</label>
                      <input
                        type="time"
                        value={startHour}
                        onChange={(e) => setStartHour(e.target.value)}
                        required
                        step="1"
                        className="mg-input font-bold text-rose-700"
                      />
                    </div>
                    <div>
                      <label className="mg-label">Fim (Liberação)</label>
                      <input
                        type="time"
                        value={endHour}
                        onChange={(e) => setEndHour(e.target.value)}
                        required
                        step="1"
                        className="mg-input font-bold text-emerald-700"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="mg-label mb-2">Dias Ativos</label>
                    <div className="flex flex-wrap gap-2">
                      {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(dia => (
                        <label key={dia} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl cursor-pointer border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] hover:opacity-80 transition-colors text-xs font-semibold" style={{ color: 'var(--mg-text-body)' }}>
                          <input type="checkbox" defaultChecked className="rounded border-slate-300 text-[var(--mg-primary)] w-3.5 h-3.5 cursor-pointer" />
                          <span>{dia}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={timeLoading}
                    className="mg-btn mg-btn-danger w-full"
                  >
                    {timeLoading ? 'Aplicando...' : 'Ativar Regra'}
                  </button>
                  <p className="text-[11px] text-center mt-1 font-medium" style={{ color: 'var(--mg-text-muted)' }}>A regra de filtragem drop será aplicada no Forward Chain do Firewall.</p>
                </form>
              </div>
            </div>

            {/* List Section */}
            <div className="mg-card p-5 md:p-6 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="mg-card-title">
                  Bloqueios Agendados
                </h3>
                <span className="mg-badge-warning">
                  {timeRules.length} REGRAS
                </span>
              </div>
              
              <div className="mg-table-wrap flex-1">
                <div className="max-h-[460px] overflow-auto custom-scrollbar">
                  <table className="mg-table">
                    <thead>
                      <tr>
                        <th>Horário de Bloqueio</th>
                        <th>Dias da Semana</th>
                        <th className="text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {timeLoading && timeRules.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center italic font-medium" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                            <div className="inline-block animate-pulse">Consultando agendamentos...</div>
                          </td>
                        </tr>
                      ) : timeRules.length === 0 ? (
                        <tr>
                          <td colSpan={3} className="text-center italic font-medium" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                            Nenhuma regra de bloqueio de horário configurada.
                          </td>
                        </tr>
                      ) : (
                        timeRules.map((rule, index) => {
                          const timeParts = rule.time ? rule.time.split(',') : [];
                          const hours = timeParts[0] || '';
                          const days = timeParts[1] || 'todos';
                          return (
                            <tr key={`${rule.id || index}`}>
                              <td className="font-bold text-rose-700 text-sm tracking-wide">{hours.replace('-', ' às ')}</td>
                              <td>
                                <span className="mg-badge-warning text-[10px]">{days}</span>
                              </td>
                              <td className="text-right">
                                <button
                                  onClick={() => handleDeleteTimeRule(rule.id)}
                                  disabled={timeLoading}
                                  className="mg-btn mg-btn-danger text-xs"
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
            <div className="mg-card p-5 md:p-6 flex flex-col justify-between">
              <div>
                <h3 className="mg-card-title mb-1">
                  Bloquear Conteúdo
                </h3>
                <p className="mg-card-subtitle mb-4 leading-relaxed">
                  Derruba conexões cujo domínio (HTTP Header ou SNI HTTPS) contenha as palavras indicadas.
                </p>
                
                <form onSubmit={handleAddKeyword} className="space-y-4">
                  <div>
                    <label className="mg-label">Palavra-Chave</label>
                    <input
                      type="text"
                      value={keywordInput}
                      onChange={(e) => setKeywordInput(e.target.value)}
                      required
                      placeholder="Ex: torrent, poker, bet"
                      className="mg-input"
                    />
                    <span className="text-[11px] mt-1.5 block leading-normal font-medium" style={{ color: 'var(--mg-text-muted)' }}>
                      Pesquisas no Google continuarão disponíveis, porém domínios diretos com o termo serão bloqueados.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="mg-btn mg-btn-danger w-full"
                  >
                    {actionLoading ? 'Aplicando Regra...' : 'Bloquear Termo'}
                  </button>
                </form>
              </div>
            </div>

            {/* List Section */}
            <div className="mg-card p-5 md:p-6 flex flex-col">
              <div className="flex justify-between items-center mb-4">
                <h3 className="mg-card-title">
                  Termos Bloqueados
                </h3>
                <span className="mg-badge-danger">
                  {keywords.length} TERMOS
                </span>
              </div>
              
              <div className="mg-table-wrap flex-1">
                <div className="max-h-[460px] overflow-auto custom-scrollbar">
                  <table className="mg-table">
                    <thead>
                      <tr>
                        <th>Termo Bloqueado</th>
                        <th>Método de Filtro</th>
                        <th className="text-right">Ações</th>
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
                          <td colSpan={3} className="text-center italic font-medium" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                            Nenhuma palavra-chave bloqueada no firewall.
                          </td>
                        </tr>
                      ) : (
                        keywords.map((kw, index) => (
                          <tr key={`${kw.id || kw.keyword}-${index}`}>
                            <td className="font-bold text-rose-700 text-sm font-mono">{kw.keyword}</td>
                            <td>
                              <div className="flex gap-2">
                                <span className="mg-badge-neutral text-[10px]">HTTP CONTENT</span>
                                <span className="mg-badge-primary text-[10px]">HTTPS TLS-SNI</span>
                              </div>
                            </td>
                            <td className="text-right">
                              <button
                                onClick={() => handleDeleteKeyword(kw.keyword)}
                                disabled={actionLoading}
                                className="mg-btn mg-btn-secondary text-xs"
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
                <h2 className="text-lg font-black" style={{ color: 'var(--mg-text-heading)' }}>🔒 Clientes Bloqueados</h2>
                <p className="text-xs mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>Clientes bloqueados por não pagamento no prazo ou por bloqueio manual. Clique em Desbloquear para liberar o acesso.</p>
              </div>
              <button onClick={fetchBlockedClients} disabled={blacklistLoading}
                className="mg-btn mg-btn-secondary text-xs">
                {blacklistLoading ? <span className="animate-spin">⟳</span> : '↻'} Atualizar
              </button>
            </div>

            {/* Clients Table */}
            <div className="mg-card overflow-hidden">
              <div className="mg-table-wrap">
                <div className="max-h-[500px] overflow-auto">
                  <table className="mg-table">
                    <thead>
                      <tr>
                        <th>Cliente</th>
                        <th>MAC Address</th>
                        <th>CPF / Telefone</th>
                        <th>Motivo</th>
                        <th>Bloqueado em</th>
                        <th className="text-right">Ação</th>
                      </tr>
                    </thead>
                    <tbody>
                      {blacklistLoading && blockedClients.length === 0 ? (
                        <tr><td colSpan={6} className="text-center italic" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                          <div className="inline-block animate-pulse">Carregando clientes bloqueados...</div>
                        </td></tr>
                      ) : blockedClients.length === 0 ? (
                        <tr><td colSpan={6} className="text-center" style={{ padding: '2rem' }}>
                          <div className="flex flex-col items-center gap-2">
                            <span className="text-3xl">✅</span>
                            <p className="font-medium text-sm" style={{ color: 'var(--mg-text-muted)' }}>Nenhum cliente bloqueado</p>
                            <p className="text-xs" style={{ color: 'var(--mg-text-muted)' }}>O sistema bloqueia automaticamente quem não paga no prazo</p>
                          </div>
                        </td></tr>
                      ) : blockedClients.map((c) => (
                        <tr key={c.id}>
                          <td>
                            <div className="font-bold text-sm" style={{ color: 'var(--mg-text-heading)' }}>{c.phone || c.cpf || '—'}</div>
                            {c.cpf && <div className="text-[10px]" style={{ color: 'var(--mg-text-muted)' }}>CPF: {c.cpf}</div>}
                          </td>
                          <td>
                            {c.mac ? (
                              <span className="font-mono text-xs border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] px-2 py-0.5 rounded" style={{ color: 'var(--mg-text-body)' }}>{c.mac}</span>
                            ) : <span className="italic" style={{ color: 'var(--mg-text-muted)' }}>Sem MAC</span>}
                          </td>
                          <td>
                            <div className="space-y-0.5" style={{ color: 'var(--mg-text-body)' }}>
                              {c.cpf && <div>CPF: <span className="font-mono">{c.cpf}</span></div>}
                              {c.phone && <div>📱 {c.phone}</div>}
                            </div>
                          </td>
                          <td>
                            <span className="mg-badge-danger text-[10px]">
                              🚫 {c.reason || 'Não pagou no prazo'}
                            </span>
                          </td>
                          <td style={{ color: 'var(--mg-text-muted)' }}>
                            {c.blockedAt ? new Date(c.blockedAt).toLocaleString('pt-BR') : '—'}
                          </td>
                          <td className="text-right">
                            <button
                              onClick={() => handleUnblock(c.id, c.mac)}
                              disabled={unblockingId === c.id}
                              className="mg-btn mg-btn-success text-xs"
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
            </div>

            {/* Manual Block Form */}
            <div className="mg-card p-5">
              <h3 className="mg-card-title mb-3">➕ Bloquear Manualmente</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <input value={blockMac} onChange={e => setBlockMac(e.target.value)}
                  placeholder="MAC (AA:BB:CC:DD:EE:FF)"
                  className="mg-input font-mono" />
                <input value={blockCpf} onChange={e => setBlockCpf(e.target.value)}
                  placeholder="CPF"
                  className="mg-input" />
                <input value={blockPhone} onChange={e => setBlockPhone(e.target.value)}
                  placeholder="Telefone"
                  className="mg-input" />
                <input value={blockReason} onChange={e => setBlockReason(e.target.value)}
                  placeholder="Motivo (opcional)"
                  className="mg-input" />
              </div>
              <button onClick={handleManualBlock} disabled={blockSubmitting}
                className="mg-btn mg-btn-danger mt-3">
                {blockSubmitting ? <span className="animate-spin">⟳</span> : '🔒'} Bloquear Cliente
              </button>
            </div>

            {/* Grace Period / Trial Unblock Section */}
            <div className="mg-card overflow-hidden border-amber-500/40">
              <div className="p-5 border-b border-[var(--mg-card-border)] bg-amber-500/5 flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">⏱️</span>
                    <h3 className="mg-card-title">Liberação de Carência (15 min expirados)</h3>
                    {trialLeads.length > 0 && (
                      <span className="mg-badge-warning">
                        {trialLeads.length} aguardando
                      </span>
                    )}
                  </div>
                  <p className="mg-card-subtitle mt-1">
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
                      className="mg-input pr-8"
                    />
                    {trialSearch && (
                      <button
                        onClick={() => { setTrialSearch(''); fetchTrialLeads(''); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-xs" style={{ color: 'var(--mg-text-muted)' }}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => fetchTrialLeads(trialSearch)}
                    disabled={trialLoading}
                    className="mg-btn mg-btn-warning text-xs"
                  >
                    {trialLoading ? '⟳' : 'Buscar'}
                  </button>
                </div>
              </div>

              <div className="mg-table-wrap">
                <div className="max-h-[500px] overflow-auto">
                <table className="mg-table">
                  <thead>
                    <tr>
                      <th>Cliente / Contato</th>
                      <th>CPF</th>
                      <th>MAC Address</th>
                      <th>Carência Usada</th>
                      <th>Histórico de Pix</th>
                      <th className="text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialLoading && trialLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center italic" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                          <div className="inline-block animate-pulse">Consultando clientes com carência...</div>
                        </td>
                      </tr>
                    ) : trialLeads.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ padding: '2rem' }}>
                          <div className="flex flex-col items-center gap-2 text-center">
                            <span className="text-3xl">✨</span>
                            <p className="font-medium text-sm" style={{ color: 'var(--mg-text-muted)' }}>Nenhum cliente com carência pendente</p>
                            <p className="text-xs" style={{ color: 'var(--mg-text-muted)' }}>Todos os cadastros recentes efetuaram pagamento ou não atingiram o limite de carência.</p>
                          </div>
                        </td>
                      </tr>
                    ) : trialLeads.map((lead) => (
                      <tr key={lead.id}>
                        <td>
                          <div className="font-bold text-sm" style={{ color: 'var(--mg-text-heading)' }}>{lead.name || 'Sem nome'}</div>
                          <div className="text-[11px] font-mono" style={{ color: 'var(--mg-text-muted)' }}>📱 {lead.phone || 'Sem telefone'}</div>
                        </td>
                        <td>
                          <span className="font-mono" style={{ color: 'var(--mg-text-body)' }}>{lead.cpf || '—'}</span>
                        </td>
                        <td>
                          {lead.mac ? (
                            <span className="font-mono text-xs border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] px-2 py-0.5 rounded" style={{ color: 'var(--mg-text-body)' }}>
                              {lead.mac}
                            </span>
                          ) : (
                            <span className="italic" style={{ color: 'var(--mg-text-muted)' }}>Sem MAC</span>
                          )}
                        </td>
                        <td>
                          {lead.trialGrantedAt ? (
                            <div>
                              <div className="font-bold text-amber-600">15 min expirados</div>
                              <div className="text-[10px]" style={{ color: 'var(--mg-text-muted)' }}>
                                {new Date(lead.trialGrantedAt).toLocaleString('pt-BR')}
                              </div>
                            </div>
                          ) : lead.trialBlocked ? (
                            <span className="mg-badge-danger text-[10px]">
                              Bloqueado
                            </span>
                          ) : '—'}
                        </td>
                        <td>
                          {lead.payments && lead.payments.length > 0 ? (
                            <div className="space-y-1">
                              {lead.payments.map((p: any) => (
                                <div key={p.id} className="text-[10px] flex items-center gap-1.5">
                                  <span className={`px-1.5 py-0.5 rounded font-bold ${
                                    p.status === 'approved' ? 'bg-emerald-500/15 text-emerald-700' :
                                    p.status === 'pending' ? 'bg-amber-500/15 text-amber-700' :
                                    'border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)]'
                                  }`}>
                                    {p.status === 'approved' ? '✓ Pago' : p.status === 'pending' ? '⏳ Pendente' : p.status}
                                  </span>
                                  <span className="font-semibold" style={{ color: 'var(--mg-text-body)' }}>R$ {Number(p.amount).toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="italic text-[11px]" style={{ color: 'var(--mg-text-muted)' }}>Nenhum Pix gerado</span>
                          )}
                        </td>
                        <td className="text-right">
                          <button
                            onClick={() => handleUnlockLead(lead.id, lead.name || lead.phone || lead.cpf || 'Cliente')}
                            disabled={unlockingLeadId === lead.id}
                            className="mg-btn mg-btn-warning text-xs"
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
          </div>
        )}

      </div>
    </main>
  );
}
