"use client";

import { useEffect, useState, useCallback } from 'react';
import RouterOffline from '@/components/RouterOffline';
import Link from 'next/link';

export default function ProfilesManage() {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [pools, setPools] = useState<string[]>([]);
  const [queues, setQueues] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [notConnected, setNotConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [routerError, setRouterError] = useState('');

  // Form State
  const [name, setName] = useState('');
  const [sharedUsers, setSharedUsers] = useState('1');
  const [rateLimit, setRateLimit] = useState('');
  const [expmode, setExpmode] = useState('0');
  const [validity, setValidity] = useState('');
  const [graceperiod, setGraceperiod] = useState('5m');
  const [price, setPrice] = useState('0');
  const [sprice, setSprice] = useState('0');
  const [lockunlock, setLockunlock] = useState('Disable');
  const [ppool, setPpool] = useState('none');
  const [parent, setParent] = useState('none');

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch('/api/hotspot/profiles');
      
      // Session/connection errors → show RouterOffline banner
      if (res.status === 401 || res.status === 503) {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.message || '');
        setNotConnected(true);
        setLoading(false);
        return;
      }
      
      // RouterOS API error → show inline error
      if (res.status === 422) {
        const data = await res.json().catch(() => ({}));
        setRouterError(data.message || 'Erro ao executar comando no MikroTik.');
        setLoading(false);
        return;
      }
      
      const data = await res.json();
      if (data.success) {
        setProfiles(data.data.profiles);
        setPools(data.data.pools || []);
        setQueues(data.data.queues || []);
        setNotConnected(false);
        setRouterError('');
        setErrorMessage('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!ignore) {
        await fetchProfiles();
      }
    };
    run();
    return () => { ignore = true; };
  }, [fetchProfiles]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        name,
        sharedUsers,
        rateLimit,
        expmode,
        validity: expmode !== '0' ? validity : '',
        graceperiod: expmode !== '0' ? graceperiod : '',
        price,
        sprice,
        lockunlock,
        ppool,
        parent
      };

      const res = await fetch('/api/hotspot/profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        alert('Perfil de Acesso salvo com sucesso!');
        setName('');
        setRateLimit('');
        setExpmode('0');
        setValidity('');
        setGraceperiod('5m');
        setPrice('0');
        setSprice('0');
        setLockunlock('Disable');
        setPpool('none');
        setParent('none');
        fetchProfiles(); // Refresh table
      } else {
        alert('Erro ao salvar perfil: ' + data.message);
      }
    } catch {
      alert('Erro na conexão com a API.');
    } finally {
      setCreating(false);
    }
  };

  if (notConnected) {
    return (
      <RouterOffline 
        title="Perfis de Acesso (Profiles)" 
        description="Crie planos de banda, limites e regras de expiração idênticas ao Mikhmon"
        errorMessage={errorMessage}
      />
    );
  }

  if (routerError) {
    return (
      <main className="mg-page-container">
        <header className="mg-card p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
            <div>
              <span className="mg-badge-warning">
                Hotspot // Erro de Roteamento
              </span>
              <h1 className="mg-page-title mt-1">
                Perfis de Acesso (Profiles)
              </h1>
            </div>
          </div>
        </header>

        {/* Diagnostic module box */}
        <div className="mg-card overflow-hidden">
          <div className="mg-card-header">
            <span className="font-mono text-xs font-bold uppercase" style={{ color: 'var(--mg-text-muted)' }}>AUDITORIA DE SERVIÇOS DO ROTEADOR</span>
          </div>
          
          <div className="p-6 md:p-8 space-y-6">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0 border border-amber-500/30 bg-amber-500/10">
                <span className="text-amber-500 text-2xl">⚠️</span>
              </div>
              <div className="space-y-3 text-center md:text-left flex-1">
                <h3 className="text-base font-bold uppercase tracking-wider" style={{ color: 'var(--mg-text-heading)' }}>Hotspot não configurado no Roteador</h3>
                <p className="text-xs leading-relaxed max-w-xl font-medium" style={{ color: 'var(--mg-text-muted)' }}>
                  O roteador está conectado com sucesso, porém o servidor de hotspot e seus serviços correlatos não foram localizados. É necessário provisioná-los antes de gerenciar planos.
                </p>
                <div className="mg-alert mg-alert-warning font-mono text-xs">
                  {routerError}
                </div>
                <div className="pt-2">
                  <Link href="/dashboard/portal?tab=provisioning" className="mg-btn mg-btn-warning inline-flex items-center gap-2">
                    ⚙️ Provisionar Hotspot Agora
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mg-page-container">
      {/* Page Header */}
      <header className="mg-page-header-row">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="mg-badge-primary">
              Gerenciador de Perfis & Planos
            </span>
          </div>
          <h1 className="mg-page-title">
            Planos / Perfis
          </h1>
          <p className="mg-page-subtitle">
            Gerencie perfis de acesso e limites de velocidade no MikroTik
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Form Container */}
        <div className="mg-card overflow-hidden lg:col-span-2">
          <div className="mg-card-header">
            <h2 className="mg-card-title">Novo Perfil de Acesso</h2>
            <p className="mg-card-subtitle">Defina limites, validade e valores para os vouchers</p>
          </div>

          <form onSubmit={handleCreate} className="p-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="mg-label">Nome do Plano</label>
                <input 
                  type="text" 
                  value={name} 
                  onChange={(e) => setName(e.target.value.replace(/\s/g, '-'))} 
                  required 
                  placeholder="Ex: 1-Hora-R$2" 
                  className="mg-input" 
                />
              </div>
              
              <div>
                <label className="mg-label">IP Pool (Address Pool)</label>
                <select 
                  value={ppool} 
                  onChange={(e) => setPpool(e.target.value)} 
                  className="mg-select"
                >
                  <option value="none">none (Padrão do Hotspot)</option>
                  {pools.map((p, idx) => <option key={`${p}-${idx}`} value={p}>{p}</option>)}
                </select>
              </div>

              <div>
                <label className="mg-label">Limite de Velocidade (Rate Limit)</label>
                <input 
                  type="text" 
                  value={rateLimit} 
                  onChange={(e) => setRateLimit(e.target.value)} 
                  placeholder="Ex: 512k/2M ou 1M/5M" 
                  className="mg-input uppercase font-bold" 
                />
                <p className="text-[11px] mt-1 leading-none font-medium" style={{ color: 'var(--mg-text-muted)' }}>Upload/Download. Vazio para ilimitado.</p>
              </div>

              <div>
                <label className="mg-label">Usuários Simultâneos (Shared)</label>
                <input 
                  type="number" 
                  min="1" 
                  value={sharedUsers} 
                  onChange={(e) => setSharedUsers(e.target.value)} 
                  required
                  className="mg-input" 
                />
              </div>

              <div>
                <label className="mg-label">Modo de Expiração</label>
                <select 
                  value={expmode} 
                  onChange={(e) => setExpmode(e.target.value)} 
                  className="mg-select"
                >
                  <option value="0">Nenhum (Voucher não expira)</option>
                  <option value="rem">Remover (Apaga voucher expirado)</option>
                  <option value="ntf">Aviso (Bloqueia e mostra tela de expirado)</option>
                  <option value="remc">Remover e Registrar (Apaga e grava faturamento)</option>
                  <option value="ntfc">Aviso e Registrar (Bloqueia e grava faturamento)</option>
                </select>
              </div>

              {expmode !== '0' ? (
                <>
                  <div>
                    <label className="mg-label">Validade (Validity)</label>
                    <input 
                      type="text" 
                      value={validity} 
                      onChange={(e) => setValidity(e.target.value)} 
                      required 
                      placeholder="Ex: 1d, 12h, 30m" 
                      className="mg-input" 
                    />
                    <p className="text-[11px] mt-1 leading-none font-medium" style={{ color: 'var(--mg-text-muted)' }}>Duração após o primeiro login.</p>
                  </div>
                  <div>
                    <label className="mg-label">Período de Graça</label>
                    <input 
                      type="text" 
                      value={graceperiod} 
                      onChange={(e) => setGraceperiod(e.target.value)} 
                      required 
                      placeholder="Ex: 5m" 
                      className="mg-input" 
                    />
                  </div>
                </>
              ) : (
                <div className="hidden sm:block"></div>
              )}

              <div>
                <label className="mg-label">Preço de Custo (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={price} 
                  onChange={(e) => setPrice(e.target.value)} 
                  required
                  className="mg-input" 
                />
              </div>

              <div>
                <label className="mg-label">Preço de Venda (R$)</label>
                <input 
                  type="number" 
                  step="0.01" 
                  min="0"
                  value={sprice} 
                  onChange={(e) => setSprice(e.target.value)} 
                  required
                  className="mg-input" 
                />
              </div>

              <div>
                <label className="mg-label">Vincular ao MAC (Lock User)</label>
                <select 
                  value={lockunlock} 
                  onChange={(e) => setLockunlock(e.target.value)} 
                  className="mg-select"
                >
                  <option value="Disable">Desativado (Multi-aparelho)</option>
                  <option value="Enable">Ativado (Trava no primeiro login)</option>
                </select>
              </div>

              <div>
                <label className="mg-label">Fila Pai (Parent Queue)</label>
                <select 
                  value={parent} 
                  onChange={(e) => setParent(e.target.value)} 
                  className="mg-select"
                >
                  <option value="none">none (Nenhuma Fila Pai)</option>
                  {queues.map((q, idx) => <option key={`${q}-${idx}`} value={q}>{q}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-4 border-t border-[var(--mg-card-border)]">
              <button 
                type="submit" 
                disabled={creating} 
                className="mg-btn mg-btn-primary w-full"
              >
                {creating ? 'Salvando Configurações...' : 'Salvar Perfil de Acesso'}
              </button>
            </div>
          </form>
        </div>

        {/* Readme Panel */}
        <div className="mg-card overflow-hidden h-fit lg:col-span-1">
          <div className="mg-card-header">
            <h2 className="mg-card-title">Documentação</h2>
            <p className="mg-card-subtitle">Parâmetros de configuração</p>
          </div>
          
          <div className="p-6 space-y-4 text-xs">
            <h3 className="font-extrabold text-sm uppercase tracking-wider pb-1.5 border-b border-[var(--mg-card-border)]" style={{ color: 'var(--mg-text-heading)' }}>
              Guia Rápido
            </h3>
            
            <div className="space-y-4 leading-relaxed font-medium" style={{ color: 'var(--mg-text-muted)' }}>
              <div>
                <strong className="block mb-1 font-bold" style={{ color: 'var(--mg-primary)' }}>1. NOME DO PLANO:</strong>
                <p>Evite espaços em branco. O sistema substitui automaticamente espaços vazios por hífens (`-`).</p>
              </div>
              <div>
                <strong className="block mb-1 font-bold" style={{ color: 'var(--mg-primary)' }}>2. FORMATO DE VALIDADE:</strong>
                <p>Duração total da navegação a partir do primeiro login.</p>
                <ul className="list-disc pl-4 mt-2 space-y-1">
                  <li><strong>30m</strong> = 30 minutos</li>
                  <li><strong>12h</strong> = 12 horas</li>
                  <li><strong>1d</strong> = 1 dia</li>
                  <li><strong>30d</strong> = 30 dias</li>
                </ul>
              </div>
              <div>
                <strong className="block mb-1 font-bold" style={{ color: 'var(--mg-primary)' }}>3. MODOS DE REGISTRO:</strong>
                <p>Opte por registros contendo <strong>&quot;Registrar&quot;</strong> para habilitar gravação persistente de transações financeiras em scripts de log no MikroTik, garantindo relatórios completos.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Profiles List */}
      <div className="mg-card overflow-hidden">
        <div className="mg-card-header flex justify-between items-center">
          <div>
            <h2 className="mg-card-title">Perfis Cadastrados no MikroTik</h2>
            <p className="mg-card-subtitle">Planos ativos e configurados no roteador</p>
          </div>
          <span className="mg-badge-primary">
            {profiles.length} PERFIS
          </span>
        </div>

        <div className="p-4">
          <div className="mg-table-wrap">
            <table className="mg-table">
              <thead>
                <tr>
                  <th>Nome (Profile)</th>
                  <th>Usuários Simultâneos</th>
                  <th>Banda (Rate Limit)</th>
                  <th className="text-right">Pool de IPs</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={4} className="text-center italic font-medium" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                      Carregando profiles cadastrados...
                    </td>
                  </tr>
                ) : profiles.map((p, index) => (
                  <tr key={`${p.id || p.name}-${index}`}>
                    <td className="font-bold text-sm" style={{ color: 'var(--mg-primary)' }}>{p.name}</td>
                    <td className="font-medium" style={{ color: 'var(--mg-text-body)' }}>{p['shared-users'] || '1'}</td>
                    <td className="font-mono" style={{ color: 'var(--mg-text-muted)' }}>{p['rate-limit'] || 'Ilimitada'}</td>
                    <td className="font-mono text-right" style={{ color: 'var(--mg-text-muted)' }}>{p['address-pool'] || 'none'}</td>
                  </tr>
                ))}
                {(!loading && profiles.length === 0) && (
                  <tr>
                    <td colSpan={4} className="text-center italic font-medium" style={{ color: 'var(--mg-text-muted)', padding: '2rem' }}>
                      Nenhum perfil de Hotspot encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
