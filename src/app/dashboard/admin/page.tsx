"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminSettings() {
  const [dbStatus] = useState('Conectado');
  const [currentUsername, setCurrentUsername] = useState('');
  const [username, setUsername] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const [routers, setRouters] = useState<any[]>([]);
  const [loadingRouters, setLoadingRouters] = useState(true);
  const [showRouterForm, setShowRouterForm] = useState(false);
  const [connectingId, setConnectingId] = useState<string | null>(null);

  // Scanner State
  const [scanning, setScanning] = useState(false);
  const [scannedRouters, setScannedRouters] = useState<any[]>([]);
  const [showScanner, setShowScanner] = useState(false);

  // Router Form
  const [rName, setRName] = useState('');
  const [rHost, setRHost] = useState('');
  const [rUser, setRUser] = useState('');
  const [rPass, setRPass] = useState('');

  // Free Wifi Mode
  const [freeWifiMode, setFreeWifiMode] = useState(false);
  const [savingFreeWifi, setSavingFreeWifi] = useState(false);

  // Max Users Limit
  const [maxUsers, setMaxUsers] = useState<string>('0');
  const [savingMaxUsers, setSavingMaxUsers] = useState(false);

  // 2FA WhatsApp & Emergency Tokens
  const [adminPhone, setAdminPhone] = useState('');
  const [savingPhone, setSavingPhone] = useState(false);
  const [emergencyTokens, setEmergencyTokens] = useState<string[]>([]);
  const [tokenStatus, setTokenStatus] = useState<{ available: number; used: number }>({ available: 0, used: 0 });
  const [generatingTokens, setGeneratingTokens] = useState(false);
  const [tokenMessage, setTokenMessage] = useState('');

  const fetchSystemConfig = async () => {
    try {
      const res = await fetch('/api/config/system');
      const data = await res.json();
      if (data.success && data.data) {
        setFreeWifiMode(data.data.free_wifi_mode === 'true');
        setMaxUsers(data.data.MAX_HOTSPOT_USERS || '0');
        setAdminPhone(data.data.ADMIN_WHATSAPP_PHONE || '');
      }
    } catch {}

    // Busca usuário atual autenticado
    try {
      const res = await fetch('/api/system/users');
      const data = await res.json();
      if (data.success && data.currentUser) {
        setCurrentUsername(data.currentUser.username);
        setUsername(data.currentUser.username);
      }
    } catch {}

    // Busca status dos tokens de emergência
    try {
      const res = await fetch('/api/auth/emergency-tokens');
      const data = await res.json();
      if (data.success) {
        setTokenStatus({ available: data.available, used: data.used });
      }
    } catch {}
  };

  const handleSaveAdminPhone = async () => {
    setSavingPhone(true);
    try {
      const res = await fetch('/api/config/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ADMIN_WHATSAPP_PHONE', value: adminPhone.trim() })
      });
      const data = await res.json();
      if (data.success) {
        alert('Telefone do Administrador atualizado com sucesso para 2FA!');
      } else {
        alert('Erro ao salvar telefone.');
      }
    } catch {
      alert('Erro de conexão ao salvar telefone.');
    } finally {
      setSavingPhone(false);
    }
  };

  const handleGenerateEmergencyTokens = async () => {
    if (!confirm('Deseja gerar novos Tokens de Emergência? Os tokens não utilizados anteriores serão invalidados e uma cópia será enviada ao seu grupo de segurança do WhatsApp.')) return;
    setGeneratingTokens(true);
    setTokenMessage('');
    try {
      const res = await fetch('/api/auth/emergency-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendToGroup: true })
      });
      const data = await res.json();
      if (data.success) {
        setEmergencyTokens(data.tokens || []);
        setTokenStatus({ available: data.tokens?.length || 8, used: 0 });
        if (data.sentToGroup) {
          setTokenMessage('✅ 8 novos tokens gerados e enviados para o grupo do WhatsApp!');
        } else {
          setTokenMessage('⚠️ Tokens gerados! Anote-os agora (não foi possível enviar ao grupo: ' + (data.groupMessageError || 'grupo não configurado') + ').');
        }
      } else {
        alert(data.message || 'Erro ao gerar tokens.');
      }
    } catch {
      alert('Erro de conexão ao gerar tokens de emergência.');
    } finally {
      setGeneratingTokens(false);
    }
  };


  const handleToggleFreeWifi = async () => {
    setSavingFreeWifi(true);
    const newValue = !freeWifiMode;
    try {
      const res = await fetch('/api/config/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'free_wifi_mode', value: newValue ? 'true' : 'false' })
      });
      const data = await res.json();
      if (data.success) {
        setFreeWifiMode(newValue);
      }
    } catch {} finally {
      setSavingFreeWifi(false);
    }
  };

  const handleSaveMaxUsers = async () => {
    setSavingMaxUsers(true);
    try {
      const res = await fetch('/api/config/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'MAX_HOTSPOT_USERS', value: maxUsers })
      });
      const data = await res.json();
      if (data.success) {
        alert('Limite atualizado!');
      }
    } catch {
      alert('Erro ao salvar limite.');
    } finally {
      setSavingMaxUsers(false);
    }
  };

  const fetchRouters = async () => {
    try {
      const res = await fetch('/api/system/routers');
      const data = await res.json();
      if (data.success) {
        setRouters(data.routers);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingRouters(false);
    }
  };

  useEffect(() => {
    let ignore = false;
    const init = async () => {
      if (ignore) return;
      await fetchRouters();
      if (ignore) return;
      await fetchSystemConfig();
    };
    init();
    return () => { ignore = true; };
  }, []);

  const handleScanNetwork = async () => {
    setScanning(true);
    setScannedRouters([]);
    setShowScanner(true);
    setShowRouterForm(false);
    try {
      const res = await fetch('/api/hotspot/scan');
      const data = await res.json();
      if (data.success) {
        setScannedRouters(data.routers || []);
      } else {
        alert('Erro ao escanear a rede: ' + data.error);
      }
    } catch {
      alert('Erro de conexão ao escanear a rede.');
    } finally {
      setScanning(false);
    }
  };

  const handleUserUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      alert('Informe sua senha atual para confirmar a alteração de segurança.');
      return;
    }
    if (!password || password.length < 8) {
      alert('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/system/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newUsername: username.trim(),
          currentPassword,
          newPassword: password.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Credenciais atualizadas com sucesso! Você será redirecionado para a tela de login.');
        window.location.assign('/');
      } else {
        alert(data.message || 'Erro ao atualizar credenciais.');
      }
    } catch {
      alert('Erro de conexão ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddRouter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/system/routers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: rName, host: rHost, user: rUser, password: rPass })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        setRName(''); setRHost(''); setRUser(''); setRPass('');
        setShowRouterForm(false);
        fetchRouters();
      }
    } catch {
      alert('Erro de conexão ao salvar router.');
    }
  };

  const handleDeleteRouter = async (id: string) => {
    if (!confirm('Deseja excluir este Mikrotik do sistema?')) return;
    try {
      const res = await fetch('/api/system/routers', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) fetchRouters();
      else alert(data.message);
    } catch {
      alert('Erro ao excluir.');
    }
  };

  const connectToRouter = async (router: any) => {
    setConnectingId(router.id);
    const targetIp = router.vpnEnabled && router.vpnIp ? router.vpnIp : router.host;
    try {
      const res = await fetch('/api/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ip: targetIp, user: router.user, pass: router.password })
      });
      const data = await res.json();
      if (data.success) {
        alert('Conectado com sucesso a ' + router.name + '!');
        window.location.assign('/dashboard');
      } else {
        alert('Erro ao conectar: ' + data.message);
      }
    } catch {
      alert('Erro de rede ao conectar.');
    } finally {
      setConnectingId(null);
    }
  };

  return (
    <main className="w-full p-4 md:p-8 max-w-6xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <header className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded">
              SYSTEM // HARDWARE ROUTERS & USERS CONFIG
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Roteadores e Sistema
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gerencie roteadores MikroTik integrados e credenciais de acesso locais do painel
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        
        {/* Routers List — Main area */}
        <div className="lg:col-span-3 bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 md:p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-slate-900">
                Unidades MikroTik Cadastradas
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={handleScanNetwork}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  🔍 Scan / Winbox
                </button>
                <button
                  onClick={() => setShowRouterForm(!showRouterForm)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2 px-3.5 rounded-xl transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  {showRouterForm ? 'Fechar Form' : '+ Adicionar Roteador'}
                </button>
              </div>
            </div>

            {/* VPN Banner */}
            <div className="mg-card p-4 mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-[var(--mg-card-border)] bg-[var(--mg-card-bg)] shadow-[var(--mg-shadow-card)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--mg-primary-light)] text-[var(--mg-primary)] border border-[var(--mg-primary-border)] flex items-center justify-center text-base shrink-0">
                  🛡️
                </div>
                <div>
                  <h4 className="text-xs font-black uppercase tracking-wider" style={{ color: 'var(--mg-text-heading)' }}>Acesso Remoto sem IP Público</h4>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--mg-text-muted)' }}>Seu MikroTik está em CGNAT ou rede interna? Conecte-o à VPS com túnel WireGuard.</p>
                </div>
              </div>
              <Link
                href="/dashboard/vpn"
                className="mg-btn mg-btn-primary text-xs uppercase tracking-wider shrink-0"
              >
                Configurar VPN →
              </Link>
            </div>

            <div className="space-y-4">
              {showScanner && (
                <div className="mg-card p-4 space-y-3 bg-[var(--mg-card-bg-subtle)] border-[var(--mg-card-border)]">
                  <div className="flex justify-between items-center">
                    <h4 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--mg-text-heading)' }}>Scanner de Rede (MNDP)</h4>
                    <button onClick={() => setShowScanner(false)} className="text-slate-500 hover:text-slate-800 text-xs font-bold cursor-pointer">✕</button>
                  </div>
                  {scanning ? (
                    <p className="text-center text-xs py-4 animate-pulse" style={{ color: 'var(--mg-text-muted)' }}>Buscando MikroTiks na rede local...</p>
                  ) : scannedRouters.length === 0 ? (
                    <p className="text-center text-xs py-4" style={{ color: 'var(--mg-text-muted)' }}>Nenhum equipamento encontrado na rede.</p>
                  ) : (
                    <div className="space-y-2">
                      {scannedRouters.map((r, i) => (
                        <div key={i} className="mg-card p-3 flex items-center justify-between hover:bg-[var(--mg-card-bg-subtle)] cursor-pointer transition-colors" onClick={() => {
                          setRName(r.identity || 'MikroTik Local');
                          setRHost(r.ipAddress || r.macAddress);
                          setRUser('admin');
                          setShowRouterForm(true);
                          setShowScanner(false);
                        }}>
                          <div>
                            <p className="text-xs font-bold" style={{ color: 'var(--mg-text-heading)' }}>{r.identity || 'MikroTik'} <span className="text-[10px] font-normal" style={{ color: 'var(--mg-text-muted)' }}>({r.board || r.platform})</span></p>
                            <p className="text-[10px] font-mono mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>IP: {r.ipAddress || '0.0.0.0'} | MAC: {r.macAddress}</p>
                          </div>
                          <span className="mg-badge-primary text-[10px]">Usar</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showRouterForm && (
                <form onSubmit={handleAddRouter} className="mg-card p-4 space-y-3 bg-[var(--mg-card-bg-subtle)] border-[var(--mg-card-border)]">
                  <h4 className="font-bold text-xs uppercase tracking-wider" style={{ color: 'var(--mg-text-heading)' }}>Cadastrar Novo Roteador</h4>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--mg-text-heading)' }}>Nome de Identificação</label>
                    <input type="text" value={rName} onChange={e => setRName(e.target.value)} required placeholder="Ex: Mikrotik Matriz" className="mg-input w-full" />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--mg-text-heading)' }}>IP ou Host</label>
                    <input type="text" value={rHost} onChange={e => setRHost(e.target.value)} required placeholder="Ex: 192.168.88.1" className="mg-input w-full font-mono" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--mg-text-heading)' }}>Usuário API</label>
                      <input type="text" value={rUser} onChange={e => setRUser(e.target.value)} required placeholder="admin" className="mg-input w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider mb-1" style={{ color: 'var(--mg-text-heading)' }}>Senha</label>
                      <input type="password" value={rPass} onChange={e => setRPass(e.target.value)} placeholder="••••" className="mg-input w-full" />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button type="button" onClick={() => setShowRouterForm(false)} className="mg-btn mg-btn-secondary text-xs">Cancelar</button>
                    <button type="submit" className="mg-btn mg-btn-primary text-xs">Salvar Roteador</button>
                  </div>
                </form>
              )}

              <div className="space-y-4">
                {loadingRouters ? (
                  <p className="text-center font-bold text-xs py-6 animate-pulse" style={{ color: 'var(--mg-text-muted)' }}>Carregando unidades de hardware...</p>
                ) : routers.length === 0 ? (
                  <div className="mg-card p-6 text-center space-y-4 bg-[var(--mg-card-bg-subtle)]">
                    <div className="w-10 h-10 rounded-full bg-[var(--mg-card-bg)] border border-[var(--mg-card-border)] flex items-center justify-center mx-auto shadow-xs">
                      <span className="text-slate-700 text-sm">🖧</span>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-black" style={{ color: 'var(--mg-text-heading)' }}>Nenhum Roteador Cadastrado</p>
                      <p className="text-xs font-semibold leading-normal" style={{ color: 'var(--mg-text-muted)' }}>Cadastre um MikroTik no botão &quot;+ Adicionar Roteador&quot; acima para inicializar a integração do painel.</p>
                    </div>
                    <span className="mg-badge-warning">
                      BANCO: {dbStatus}
                    </span>
                  </div>
                ) : (
                  routers.map(router => (
                    <div key={router.id} className="mg-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[var(--mg-primary-border)] transition-all">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[var(--mg-card-bg-subtle)] border border-[var(--mg-card-border)] shadow-xs shrink-0">
                          <span className="text-slate-700 text-sm">📟</span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-black text-xs uppercase tracking-wider" style={{ color: 'var(--mg-text-heading)' }}>{router.name}</h4>
                            {router.active && (
                              <span className="mg-badge-primary text-[9px] py-0.5">Ativo</span>
                            )}
                          </div>
                          <p className="text-xs font-mono font-bold mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>
                            {router.host} · {router.user}
                          </p>
                          {router.vpnEnabled && router.vpnIp ? (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="mg-badge-success text-[10px] py-0.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                VPN: {router.vpnIp}
                              </span>
                              <Link href="/dashboard/vpn" className="text-[10px] font-bold text-blue-600 hover:underline">
                                Gerenciar VPN
                              </Link>
                            </div>
                          ) : (
                            <div className="mt-1">
                              <Link href="/dashboard/vpn" className="text-[10px] font-bold text-blue-600 hover:underline">
                                + Conectar via VPN WireGuard
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <button
                          onClick={() => connectToRouter(router)}
                          disabled={connectingId === router.id}
                          className="mg-btn mg-btn-primary text-xs py-2 px-3.5"
                        >
                          {connectingId === router.id ? 'Conectando...' : '⚡ Conectar'}
                        </button>
                        <button
                          onClick={() => handleDeleteRouter(router.id)}
                          className="mg-btn mg-btn-danger text-xs py-2 px-3.5"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column settings panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Free Wi-Fi Mode Card */}
          <div
            className={`rounded-2xl p-5 md:p-6 transition-all duration-300 ${freeWifiMode ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-lg shadow-emerald-500/30 text-white' : 'bg-white border border-slate-200/80 shadow-sm'}`}
          >
            {/* Header row */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div
                  className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center text-lg transition-all duration-300 border ${
                    freeWifiMode
                      ? 'bg-white/20 border-white/30'
                      : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
                >
                  {freeWifiMode ? '🎉' : '🎟️'}
                </div>
                <div className="min-w-0">
                  <h3 className={`text-sm font-bold leading-tight ${freeWifiMode ? 'text-white' : 'text-slate-900'}`}>
                    Modo Evento / Wi-Fi Gratuito
                  </h3>
                  <p className={`text-xs leading-relaxed mt-0.5 ${freeWifiMode ? 'text-white/70' : 'text-slate-600'}`}>
                    Desabilita a cobrança de PIX. Clientes receberão vouchers grátis imediatamente.
                  </p>
                </div>
              </div>

              {/* Toggle */}
              <button
                type="button"
                onClick={handleToggleFreeWifi}
                disabled={savingFreeWifi}
                className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border-2 transition-all duration-300 focus:outline-none cursor-pointer ${
                  savingFreeWifi ? 'opacity-50 cursor-not-allowed' : ''
                } ${
                  freeWifiMode
                    ? 'bg-emerald-500 border-emerald-400'
                    : 'bg-slate-200 border-slate-300 hover:border-slate-400'
                }`}
                title={freeWifiMode ? 'Clique para desativar' : 'Clique para ativar'}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full shadow-md transition-transform duration-300 ${
                    freeWifiMode ? 'translate-x-6 bg-white' : 'translate-x-1 bg-white'
                  }`}
                />
              </button>
            </div>

            {/* Status badge row */}
            <div className="mt-4 pt-3 border-t border-slate-200/80 flex items-center justify-between">
              <div className="flex items-center gap-2">
                {savingFreeWifi ? (
                  <span className="text-xs text-slate-500 flex items-center gap-1.5">
                    <svg className="w-3 h-3 animate-spin text-slate-500" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Salvando...
                  </span>
                ) : freeWifiMode ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-white/20 border border-white/30 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                    MODO GRATUITO ATIVO
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    COBRANÇA PIX NORMAL
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-mono ${freeWifiMode ? 'text-white/50' : 'text-slate-500'}`}>
                free_wifi_mode
              </span>
            </div>
          </div>

          {/* Capacidade Máxima Card */}
          <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 md:p-6 flex flex-col justify-between">
            <h3 className="text-sm font-bold text-slate-900 mb-1">
              Limite de Capacidade (Fila)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Defina o número máximo de usuários ativos (0 = sem limite). Se atingido, novos clientes entrarão em uma fila de espera no WhatsApp.
            </p>
            <div className="flex gap-2">
              <input 
                type="number" 
                value={maxUsers} 
                onChange={(e) => setMaxUsers(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:bg-white dark:focus:bg-[#141d30] focus:border-blue-500 outline-none" 
                placeholder="Ex: 50"
              />
              <button 
                onClick={handleSaveMaxUsers} 
                disabled={savingMaxUsers}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                {savingMaxUsers ? '...' : 'Salvar'}
              </button>
            </div>
          </div>

          {/* Panel User Card */}
          <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 md:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <h3 className="text-sm font-bold text-slate-900">
                  Credenciais de Acesso
                </h3>
                {currentUsername && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200">
                    Ativo: <b>{currentUsername}</b>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Atualize o login do administrador. Por segurança, requer sua senha atual e desconecta as sessões antigas.
              </p>

              <form onSubmit={handleUserUpdate} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Novo Nome de Usuário</label>
                  <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} required placeholder="Ex: lyncoln" className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:bg-white dark:focus:bg-[#141d30] focus:border-blue-500 outline-none font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Senha Atual (Confirmação)</label>
                  <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required placeholder="Sua senha atual" className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:bg-white dark:focus:bg-[#141d30] focus:border-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nova Senha Forte</label>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="Mínimo 8 caracteres" className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:bg-white dark:focus:bg-[#141d30] focus:border-blue-500 outline-none" />
                </div>
                <button type="submit" disabled={saving} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 mt-1">
                  {saving ? 'Atualizando e Protegendo...' : 'Salvar Novas Credenciais'}
                </button>
              </form>
            </div>
          </div>

          {/* 2FA WhatsApp OTP Card */}
          <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 md:p-6 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">🔐</span>
                <h3 className="text-sm font-bold text-slate-900">
                  Autenticação de Dois Fatores (2FA WhatsApp)
                </h3>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Ao fazer login, um código OTP de 6 dígitos será enviado ao WhatsApp do administrador.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                    Número do WhatsApp (com DDI e DDD)
                  </label>
                  <input
                    type="text"
                    value={adminPhone}
                    onChange={(e) => setAdminPhone(e.target.value)}
                    placeholder="Ex: 5511999998888"
                    className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 rounded-xl px-3 py-2 text-xs focus:bg-white dark:focus:bg-[#141d30] focus:border-blue-500 outline-none"
                  />
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    {adminPhone.trim() ? '✅ 2FA ativo para este número' : '⚠️ Deixe vazio para desativar o 2FA'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleSaveAdminPhone}
                  disabled={savingPhone}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingPhone ? 'Salvando...' : 'Salvar Número 2FA'}
                </button>
              </div>
            </div>
          </div>

          {/* Tokens de Emergência Offline Card */}
          <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 md:p-6 flex flex-col justify-between border-amber-300/60 bg-amber-50/20">
            <div>
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-lg">📴</span>
                  <h3 className="text-sm font-bold text-slate-900">
                    Tokens de Emergência Offline
                  </h3>
                </div>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  {tokenStatus.available} disponíveis
                </span>
              </div>
              <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Proteção máxima contra invasores que desconectem todos os WhatsApps. Tokens de uso único enviados para o grupo privado de backup.
              </p>

              {tokenMessage && (
                <div className="mb-3 p-2.5 rounded-xl bg-amber-100 border border-amber-300 text-xs font-semibold text-amber-900 leading-relaxed">
                  {tokenMessage}
                </div>
              )}

              {emergencyTokens.length > 0 && (
                <div className="mb-4 p-3 bg-slate-900 text-white rounded-xl font-mono text-xs space-y-1 max-h-48 overflow-y-auto">
                  <p className="text-[10px] text-amber-400 font-bold uppercase mb-2">Guarde estes tokens agora (exibição única):</p>
                  {emergencyTokens.map((tok, idx) => (
                    <div key={idx} className="flex justify-between items-center py-0.5 border-b border-slate-800">
                      <span className="text-slate-400">{idx + 1}.</span>
                      <span className="font-bold text-emerald-400">{tok}</span>
                      <span className="text-[10px] text-slate-500">1x uso</span>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateEmergencyTokens}
                disabled={generatingTokens}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs py-2.5 rounded-xl transition-all shadow-sm cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {generatingTokens ? (
                  <span>Gerando e enviando para o grupo...</span>
                ) : (
                  <span>🔄 Gerar Novos Tokens & Enviar ao WhatsApp</span>
                )}
              </button>
            </div>
          </div>


          {/* DB Status Card */}
          <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-50 border border-emerald-200 shrink-0">
              <span className="text-emerald-600">🖴</span>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Banco de Dados Local</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0 animate-pulse" />
                <p className="text-xs text-slate-600">SQLite: <span className="font-bold text-slate-800">{dbStatus}</span> — dados persistidos offline</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
