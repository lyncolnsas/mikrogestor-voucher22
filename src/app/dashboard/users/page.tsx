/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useState } from 'react';
import RouterOffline from '@/components/RouterOffline';

export default function Users() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [notConnected, setNotConnected] = useState(false);

  // Print & Delete Batch States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchPrintComment, setBatchPrintComment] = useState('');
  const [batchDeleteComment, setBatchDeleteComment] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // Unified Active Tab State
  const [activeTab, setActiveTab] = useState<'list' | 'batch' | 'single' | 'orders'>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get('tab');
      if (tabParam === 'batch' || tabParam === 'single' || tabParam === 'list' || tabParam === 'orders') {
        return tabParam as 'list' | 'batch' | 'single' | 'orders';
      }
    }
    return 'list';
  });

  // Pending Orders State
  const [pendingPix, setPendingPix] = useState<any[]>([]);
  const [pendingMp, setPendingMp] = useState<any[]>([]);
  const [pendingCounts, setPendingCounts] = useState({ total: 0, manual: 0, mercadopago: 0 });
  const [refreshingOrders, setRefreshingOrders] = useState(false);

  // Common Form States (Profiles & Servers Options)
  const [profiles, setProfiles] = useState<any[]>([]);
  const [servers, setServers] = useState<any[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  
  // Single Creation Form States
  const [singleName, setSingleName] = useState('');
  const [singlePass, setSinglePass] = useState('');
  const [singleComment, setSingleComment] = useState('');
  const [singlePrice, setSinglePrice] = useState(0);
  const [singleProfile, setSingleProfile] = useState('');
  const [singleServer, setSingleServer] = useState('all');
  const [creatingSingle, setCreatingSingle] = useState(false);
  const [singleMessage, setSingleMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [newlyCreatedUser, setNewlyCreatedUser] = useState<any | null>(null);

  // Batch Generation Form States
  const [qty, setQty] = useState(10);
  const [mode, setMode] = useState('up'); // up = User=Pass, vc = User & Pass diff
  const [userLen, setUserLen] = useState(5);
  const [prefix, setPrefix] = useState('');
  const [charset, setCharset] = useState('low'); // low, upp, num, mix
  const [genComment, setGenComment] = useState('');
  const [genPrice, setGenPrice] = useState(0);
  const [genServer, setGenServer] = useState('all');
  const [genProfile, setGenProfile] = useState('');
  const [generatingBatch, setGeneratingBatch] = useState(false);
  const [batchMessage, setBatchMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [generatedBatchList, setGeneratedBatchList] = useState<any[]>([]);

  const fetchOptions = async () => {
    try {
      setLoadingOptions(true);
      const res = await fetch('/api/hotspot/profiles');
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setProfiles(data.data.profiles);
          setServers(data.data.servers);
          if (data.data.profiles.length > 0) {
            setSingleProfile(data.data.profiles[0].name);
            setGenProfile(data.data.profiles[0].name);
          }
        }
      }
    } catch (err) {
      console.error('Erro ao buscar perfis:', err);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleCreateSingle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleName) return;
    setCreatingSingle(true);
    setSingleMessage(null);
    setNewlyCreatedUser(null);

    try {
      const payload = { 
        name: singleName, 
        pass: singlePass, 
        server: singleServer, 
        profile: singleProfile, 
        comment: singleComment, 
        price: singlePrice 
      };
      const res = await fetch('/api/hotspot/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSingleMessage({ type: 'success', text: `Voucher avulso "${data.user.name}" criado com sucesso no Mikrotik!` });
        setNewlyCreatedUser(data.user);
        
        // Reset inputs
        setSingleName('');
        setSinglePass('');
        setSingleComment('');
        setSinglePrice(0);
        
        // Reload list
        fetchUsers();
      } else {
        setSingleMessage({ type: 'error', text: data.message || 'Erro ao criar usuário' });
      }
    } catch {
      setSingleMessage({ type: 'error', text: 'Falha na requisição ao criar usuário' });
    } finally {
      setCreatingSingle(false);
    }
  };

  const handleGenerateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingBatch(true);
    setBatchMessage(null);
    setGeneratedBatchList([]);

    try {
      const payload = { 
        qty, 
        server: genServer, 
        mode, 
        userLen, 
        prefix, 
        charset, 
        profile: genProfile, 
        comment: genComment, 
        price: genPrice 
      };
      const res = await fetch('/api/hotspot/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setBatchMessage({ type: 'success', text: `Sucesso! ${data.count} vouchers gerados e enviados ao Mikrotik.` });
        setGeneratedBatchList(data.users);
        // Save to sessionStorage for printing
        sessionStorage.setItem('mikro_vouchers_print', JSON.stringify({
          users: data.users,
          profile: genProfile,
          comment: genComment
        }));
        
        // Clear form values
        setGenComment('');
        setGenPrice(0);
        
        // Refresh users list
        fetchUsers();
      } else {
        setBatchMessage({ type: 'error', text: data.message || 'Erro ao gerar vouchers' });
      }
    } catch {
      setBatchMessage({ type: 'error', text: 'Falha na requisição ao gerar vouchers' });
    } finally {
      setGeneratingBatch(false);
    }
  };

  const handlePrintNewlyCreated = () => {
    if (!newlyCreatedUser) return;
    
    sessionStorage.setItem('mikro_vouchers_print', JSON.stringify({
      users: [{ name: newlyCreatedUser.name, pass: newlyCreatedUser.pass || newlyCreatedUser.name }],
      profile: newlyCreatedUser.profile,
      comment: newlyCreatedUser.comment
    }));
    
    window.open('/dashboard/print', '_blank');
  };

  const handlePrintBatchGenerated = () => {
    if (generatedBatchList.length === 0) return;
    window.open('/dashboard/print', '_blank');
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/hotspot/users');
      if (res.status === 401) {
        setNotConnected(true);
        setLoading(false);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setUsers(data.data);
        setSelectedIds([]); // Clear selection on reload
        setNotConnected(false);
      } else {
        setError(data.message);
      }
    } catch {
      setError('Falha ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const fetchPendingOrders = async (showSpinner = false) => {
    if (showSpinner) setRefreshingOrders(true);
    try {
      const res = await fetch('/api/portal/admin/pending-pix');
      const data = await res.json();
      if (data.success) {
        const grouped = data.grouped || {};
        setPendingPix(grouped.manual || []);
        setPendingMp(grouped.mercadopago || []);
        setPendingCounts(data.counts || { total: 0, manual: 0, mercadopago: 0 });
      }
    } catch {}
    finally { if (showSpinner) setRefreshingOrders(false); }
  };

  const handleApprovePix = async (paymentId: string) => {
    if (!confirm('Tem certeza que recebeu o pagamento e deseja aprovar este pedido?')) return;
    try {
      const res = await fetch('/api/portal/admin/approve-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action: 'approve' })
      });
      const json = await res.json();
      alert(json.message);
      fetchPendingOrders();
    } catch { alert('Erro ao aprovar pagamento.'); }
  };

  const handleRejectPix = async (paymentId: string) => {
    if (!confirm('Tem certeza que deseja REJEITAR este pagamento? O cliente será bloqueado.')) return;
    try {
      const res = await fetch('/api/portal/admin/approve-pix', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentId, action: 'reject' })
      });
      const json = await res.json();
      alert(json.message);
      fetchPendingOrders();
    } catch { alert('Erro ao rejeitar pagamento.'); }
  };

  const formatBRL = (val: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);

  useEffect(() => {
    let isSubscribed = true;
    const initData = async () => {
      await fetchUsers();
      if (!isSubscribed) return;
      await fetchOptions();
      if (!isSubscribed) return;
      await fetchPendingOrders();
    };
    initData();

    // Auto-refresh pedidos a cada 30s
    const interval = setInterval(() => fetchPendingOrders(), 30000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  const handleDeleteUser = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja apagar o usuário ${name}?`)) return;
    
    try {
      const res = await fetch('/api/hotspot/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
      } else {
        alert(data.message);
      }
    } catch {
      alert('Erro ao apagar usuário.');
    }
  };

  const handleBatchDelete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchDeleteComment) return;
    if (!confirm(`CUIDADO: Você vai apagar TODOS os usuários que tenham o Lote/Comentário exatamente igual a "${batchDeleteComment}". Confirmar?`)) return;

    setIsDeleting(true);
    try {
      const res = await fetch('/api/hotspot/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ batchComment: batchDeleteComment })
      });
      const data = await res.json();
      alert(data.message);
      if (data.success) {
        setBatchDeleteComment('');
        fetchUsers();
      }
    } catch {
      alert('Erro ao apagar lote.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Row Selection Handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(filteredUsers.map(u => u.id || u.name));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Printing Handlers
  const handlePrintSelected = () => {
    if (selectedIds.length === 0) return;
    
    // Extract selected user objects
    const selectedUsers = users.filter(u => selectedIds.includes(u.id || u.name));
    
    const firstUser = selectedUsers[0];
    const uniformProfile = selectedUsers.every(u => u.profile === firstUser.profile) ? firstUser.profile : 'Múltiplos';
    const uniformComment = selectedUsers.every(u => u.comment === firstUser.comment) ? (firstUser.comment || 'Lote') : 'Lote Misto';

    // Save print payload to sessionStorage
    sessionStorage.setItem('mikro_vouchers_print', JSON.stringify({
      users: selectedUsers.map(u => ({ name: u.name, pass: u.pass || u.name })),
      profile: uniformProfile,
      comment: uniformComment
    }));

    // Open print page in a new window/tab
    window.open('/dashboard/print', '_blank');
  };

  const handlePrintBatch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!batchPrintComment) return;

    // Filter loaded users list by comment/lote
    const batchUsers = users.filter(u => String(u.comment || '').toLowerCase() === batchPrintComment.toLowerCase());
    
    if (batchUsers.length === 0) {
      alert(`Nenhum voucher encontrado com o lote/comentário "${batchPrintComment}"`);
      return;
    }

    const firstUser = batchUsers[0];
    const uniformProfile = batchUsers.every(u => u.profile === firstUser.profile) ? firstUser.profile : 'Múltiplos';

    // Save to sessionStorage
    sessionStorage.setItem('mikro_vouchers_print', JSON.stringify({
      users: batchUsers.map(u => ({ name: u.name, pass: u.pass || u.name })),
      profile: uniformProfile,
      comment: batchPrintComment
    }));

    // Open print page
    window.open('/dashboard/print', '_blank');
  };

  const filteredUsers = users.filter(u => {
    const name = String(u.name || '');
    const comment = String(u.comment || '');
    return name.toLowerCase().includes(search.toLowerCase()) || 
           comment.toLowerCase().includes(search.toLowerCase());
  });

  if (notConnected) {
    return (
      <RouterOffline 
        title="Usuários Hotspot" 
        description="Gerencie os acessos e limpe vouchers antigos" 
      />
    );
  }

  const isAllSelected = filteredUsers.length > 0 && filteredUsers.every(u => selectedIds.includes(u.id || u.name));

  return (
    <main className="mg-page-container relative pb-24">
      {/* Header */}
      <header className="mg-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_#2563eb]" />
            <span className="text-[11px] font-black text-blue-700 dark:text-blue-400 uppercase tracking-widest">
              HOTSPOT // CENTRAL DE ACESSO & VOUCHERS
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-950 dark:text-white tracking-tight">
            Central de Vouchers
          </h1>
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-400 mt-0.5">
            Geração, gerenciamento e monitoramento de vouchers de acesso no MikroTik.
          </p>
        </div>
        
        <div className="mg-tabs-container shrink-0 flex-wrap">
          <button 
            onClick={() => { setActiveTab('list'); setError(''); }}
            className={`mg-tab-item ${activeTab === 'list' ? 'active' : ''}`}
          >
            📋 Lista de Vouchers
          </button>
          <button 
            onClick={() => { setActiveTab('batch'); setBatchMessage(null); }}
            className={`mg-tab-item ${activeTab === 'batch' ? 'active' : ''}`}
          >
            ⚡ Gerar em Lote
          </button>
          <button 
            onClick={() => { setActiveTab('single'); setSingleMessage(null); }}
            className={`mg-tab-item ${activeTab === 'single' ? 'active' : ''}`}
          >
            👤 Criar Avulso
          </button>
          <button 
            onClick={() => { setActiveTab('orders'); fetchPendingOrders(true); }}
            className={`mg-tab-item relative ${activeTab === 'orders' ? 'active' : ''}`}
          >
            📦 Pedidos
            {pendingCounts.total > 0 && (
              <span className="ml-1.5 px-1.5 py-0.2 rounded-full text-[10px] font-black bg-rose-500 text-white shadow">
                {pendingCounts.total}
              </span>
            )}
          </button>
        </div>
      </header>

      {error && (
        <div className="mg-alert mg-alert-danger animate-pulse">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
          <span className="text-xs font-bold font-mono">
            SYSTEM_DATABASE_ERROR // {error}
          </span>
        </div>
      )}

      {/* Tab Panels */}
      {activeTab === 'list' ? (
        /* ==================== TAB 1: LIST MANAGEMENT ==================== */
        <div className="space-y-6 animate-fade-in">
          {/* Control Cards (Search, Print Batch, Delete Batch) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Search */}
            <div className="mg-card p-5 md:col-span-2 lg:col-span-2 space-y-2">
              <span className="block text-xs font-black mg-label">Buscar Usuário</span>
              <input 
                type="text" 
                placeholder="Buscar por nome ou lote..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="mg-input text-xs"
              />
            </div>

            {/* Print Batch */}
            <div className="mg-card p-5 space-y-2">
              <span className="block text-xs font-black" style={{ color: 'var(--mg-success)' }}>Imprimir Lote (Comentário)</span>
              <form onSubmit={handlePrintBatch} className="flex gap-2 w-full">
                <input 
                  type="text" 
                  placeholder="Ex: dez-2023" 
                  value={batchPrintComment}
                  onChange={(e) => setBatchPrintComment(e.target.value)}
                  className="mg-input text-xs flex-1"
                />
                <button 
                  disabled={!batchPrintComment} 
                  type="submit" 
                  className="mg-btn mg-btn-success text-xs shrink-0 disabled:opacity-50"
                >
                  Imprimir
                </button>
              </form>
            </div>

            {/* Delete Batch */}
            <div className="mg-card p-5 space-y-2">
              <span className="block text-xs font-black" style={{ color: 'var(--mg-danger)' }}>Excluir Lote (Comentário)</span>
              <form onSubmit={handleBatchDelete} className="flex gap-2 w-full">
                <input 
                  type="text" 
                  placeholder="Ex: dez-2023" 
                  value={batchDeleteComment}
                  onChange={(e) => setBatchDeleteComment(e.target.value)}
                  className="mg-input text-xs flex-1"
                />
                <button 
                  disabled={!batchDeleteComment || isDeleting} 
                  type="submit" 
                  className="mg-btn mg-btn-danger text-xs shrink-0 disabled:opacity-50"
                >
                  {isDeleting ? 'Apagando...' : 'Apagar'}
                </button>
              </form>
            </div>
          </div>

          {/* Users Table */}
          <div className="mg-card overflow-hidden">
            <div className="mg-card-header">
              <div>
                <h2 className="mg-card-title">Vouchers Registrados no Roteador</h2>
                <p className="mg-card-desc mt-0.5">Exibindo registros correspondentes aos filtros ativos</p>
              </div>
              <span className="mg-badge-primary tracking-wider uppercase self-start sm:self-auto shrink-0">
                {filteredUsers.length} VOUCHERS
              </span>
            </div>
            
            <div className="p-0">
              <div className="overflow-x-auto w-full max-h-[500px] custom-scrollbar">
                <table className="mg-table whitespace-nowrap">
                  <thead style={{ zIndex: 10 }}>
                    <tr>
                      <th className="px-6 py-3.5 w-12 text-center">
                        <input 
                          type="checkbox"
                          checked={isAllSelected}
                          onChange={handleSelectAll}
                          className="w-4 h-4 rounded cursor-pointer"
                        />
                      </th>
                      <th>Servidor</th>
                      <th>Nome (Voucher)</th>
                      <th>Perfil</th>
                      <th>Uptime</th>
                      <th>Comentário / Lote</th>
                      <th className="text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-600 dark:text-slate-400 font-bold italic">
                          <div className="inline-block animate-pulse">Carregando base de vouchers do Mikrotik...</div>
                        </td>
                      </tr>
                    ) : filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-6 py-8 text-center text-slate-600 dark:text-slate-400 font-bold italic">
                          Nenhum voucher localizado.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((user, index) => {
                        const isChecked = selectedIds.includes(user.id || user.name);
                        
                        return (
                          <tr key={`${user.id || user.name}-${index}`}>
                            <td className="px-6 py-3.5 text-center">
                              <input 
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleSelectRow(user.id || user.name)}
                                className="w-4 h-4 rounded cursor-pointer"
                              />
                            </td>
                            <td className="uppercase font-black text-xs">{user.server}</td>
                            <td className="font-black text-sm tracking-wide" style={{ color: 'var(--mg-text-heading)' }}>{user.name}</td>
                            <td>
                              <span className="mg-badge-primary text-xs">
                                {user.profile}
                              </span>
                            </td>
                            <td className="font-bold text-xs">{user.uptime}</td>
                            <td className="font-bold text-xs">{user.comment || '-'}</td>
                            <td className="text-right">
                              <button 
                                onClick={() => handleDeleteUser(user.id, user.name)} 
                                className="mg-btn mg-btn-danger text-xs py-1"
                              >
                                Excluir
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
      ) : activeTab === 'batch' ? (
        /* ==================== TAB 2: BATCH GENERATION ==================== */
        <div className="mg-card max-w-3xl overflow-hidden animate-fade-in">
          <div className="mg-card-header">
            <div>
              <h2 className="mg-card-title">Gerador de Vouchers em Lote</h2>
              <p className="mg-card-desc mt-0.5">Crie múltiplos vouchers de forma automatizada e sincronizada com o MikroTik</p>
            </div>
          </div>

          <div className="p-6">
            {batchMessage && (
              <div className={`p-4 mb-6 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${batchMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'}`}>
                <div>
                  <span className="block text-[10px] uppercase font-bold tracking-wider mb-0.5 text-slate-500 dark:text-slate-400">Status da Operação:</span>
                  <span className="font-bold text-xs">{batchMessage.text}</span>
                </div>
                {generatedBatchList.length > 0 && (
                  <button 
                    onClick={handlePrintBatchGenerated}
                    className="py-2 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    🖨️ Imprimir Lote ({generatedBatchList.length})
                  </button>
                )}
              </div>
            )}

            {loadingOptions ? (
              <div className="animate-pulse space-y-4 py-6">
                <div className="h-10 mg-card-subtle rounded-xl"></div>
                <div className="h-10 mg-card-subtle rounded-xl"></div>
                <div className="h-10 mg-card-subtle rounded-xl"></div>
              </div>
            ) : (
              <form onSubmit={handleGenerateBatch} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mg-label">Quantidade de Vouchers</label>
                    <input 
                      type="number" 
                      min="1" 
                      max="1000" 
                      value={qty} 
                      onChange={(e) => setQty(Number(e.target.value))} 
                      className="mg-input text-xs" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="mg-label">Servidor Hotspot</label>
                    <select 
                      value={genServer} 
                      onChange={(e) => setGenServer(e.target.value)} 
                      className="mg-select text-xs"
                    >
                      <option value="all">Todos os Servidores (all)</option>
                      {servers.map((s, idx) => <option key={`${s.id || s.name}-${idx}`} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mg-label">Modo de Login</label>
                    <select 
                      value={mode} 
                      onChange={(e) => setMode(e.target.value)} 
                      className="mg-select text-xs"
                    >
                      <option value="up">Usuário = Senha</option>
                      <option value="vc">Usuário e Senha Diferentes</option>
                    </select>
                  </div>
                  <div>
                    <label className="mg-label">Tamanho do Código</label>
                    <input 
                      type="number" 
                      min="3" 
                      max="12" 
                      value={userLen} 
                      onChange={(e) => setUserLen(Number(e.target.value))} 
                      className="mg-input text-xs" 
                      required 
                    />
                  </div>

                  <div>
                    <label className="mg-label">Prefixo do Código (Opcional)</label>
                    <input 
                      type="text" 
                      value={prefix} 
                      onChange={(e) => setPrefix(e.target.value)} 
                      placeholder="Ex: VIP-" 
                      className="mg-input text-xs" 
                    />
                  </div>
                  <div>
                    <label className="mg-label">Tipo de Caracteres</label>
                    <select 
                      value={charset} 
                      onChange={(e) => setCharset(e.target.value)} 
                      className="mg-select text-xs"
                    >
                      <option value="low">Letras Minúsculas (a-z)</option>
                      <option value="upp">Letras Maiúsculas (A-Z)</option>
                      <option value="num">Apenas Números (0-9)</option>
                      <option value="mix">Misto (a-Z, 0-9)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mg-label">Perfil de Velocidade (Profile)</label>
                    <select 
                      value={genProfile} 
                      onChange={(e) => setGenProfile(e.target.value)} 
                      className="mg-select text-xs"
                    >
                      {profiles.map((p, idx) => <option key={`${p.id || p.name}-${idx}`} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mg-label">Lote / Comentário Identificador</label>
                    <input 
                      type="text" 
                      value={genComment} 
                      onChange={(e) => setGenComment(e.target.value)} 
                      placeholder="Ex: dez-2023" 
                      className="mg-input text-xs" 
                      required 
                    />
                  </div>
                  
                  <div className="sm:col-span-2">
                    <label className="mg-label">Preço de Venda Unitário (R$) - Opcional</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      value={genPrice} 
                      onChange={(e) => setGenPrice(Number(e.target.value))} 
                      placeholder="Ex: 5.00" 
                      className="mg-input text-xs" 
                    />
                    <p className="text-[10px] mt-1.5 leading-none" style={{ color: 'var(--mg-text-muted)' }}>Este valor será utilizado no financeiro para o cálculo de faturamento.</p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--mg-card-border)]">
                  <button 
                    type="submit" 
                    disabled={generatingBatch}
                    className="mg-btn mg-btn-primary w-full text-xs uppercase tracking-wider disabled:opacity-50"
                  >
                    {generatingBatch ? 'Gerando Lote...' : 'Gerar Vouchers em Lote Agora'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : activeTab === 'single' ? (
        /* ==================== TAB 3: SINGLE CREATION ==================== */
        <div className="mg-card max-w-3xl overflow-hidden animate-fade-in">
          <div className="mg-card-header">
            <div>
              <h2 className="mg-card-title">Criar Voucher Avulso</h2>
              <p className="mg-card-desc mt-0.5">Provisione uma credencial individual no Hotspot</p>
            </div>
          </div>

          <div className="p-6">
            {singleMessage && (
              <div className={`p-4 mb-6 rounded-xl border flex flex-col sm:flex-row justify-between items-center gap-4 ${singleMessage.type === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/60 text-rose-800 dark:text-rose-300'}`}>
                <div>
                  <span className="block text-[10px] uppercase font-bold tracking-wider mb-0.5 text-slate-500 dark:text-slate-400">Status da Criação:</span>
                  <span className="font-bold text-xs">{singleMessage.text}</span>
                </div>
                {newlyCreatedUser && (
                  <button 
                    onClick={handlePrintNewlyCreated}
                    className="py-2 px-3.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-colors shrink-0 cursor-pointer"
                  >
                    🖨️ Imprimir Voucher
                  </button>
                )}
              </div>
            )}

            {loadingOptions ? (
              <div className="animate-pulse space-y-4 py-6">
                <div className="h-10 mg-card-subtle rounded-xl"></div>
                <div className="h-10 mg-card-subtle rounded-xl"></div>
                <div className="h-10 mg-card-subtle rounded-xl"></div>
              </div>
            ) : (
              <form onSubmit={handleCreateSingle} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="mg-label">Nome de Usuário (Login)</label>
                    <input 
                      type="text" 
                      value={singleName} 
                      onChange={(e) => setSingleName(e.target.value)} 
                      placeholder="Ex: pedro ou vip-cliente" 
                      className="mg-input text-xs" 
                      required 
                    />
                  </div>
                  <div>
                    <label className="mg-label">Senha (Opcional)</label>
                    <input 
                      type="text" 
                      value={singlePass} 
                      onChange={(e) => setSinglePass(e.target.value)} 
                      placeholder="Igual ao login se em branco" 
                      className="mg-input text-xs" 
                    />
                  </div>

                  <div>
                    <label className="mg-label">Servidor Hotspot</label>
                    <select 
                      value={singleServer} 
                      onChange={(e) => setSingleServer(e.target.value)} 
                      className="mg-select text-xs"
                    >
                      <option value="all">Todos os Servidores (all)</option>
                      {servers.map((s, idx) => <option key={`${s.id || s.name}-${idx}`} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mg-label">Perfil de Velocidade (Profile)</label>
                    <select 
                      value={singleProfile} 
                      onChange={(e) => setSingleProfile(e.target.value)} 
                      className="mg-select text-xs"
                    >
                      {profiles.map((p, idx) => <option key={`${p.id || p.name}-${idx}`} value={p.name}>{p.name}</option>)}
                    </select>
                  </div>

                  <div>
                    <label className="mg-label">Comentário / Lote Identificador</label>
                    <input 
                      type="text" 
                      value={singleComment} 
                      onChange={(e) => setSingleComment(e.target.value)} 
                      placeholder="Ex: VIP-Ana ou avulso" 
                      className="mg-input text-xs" 
                    />
                  </div>
                  <div>
                    <label className="mg-label">Preço de Venda (R$) - Opcional</label>
                    <input 
                      type="number" 
                      step="0.01" 
                      min="0" 
                      value={singlePrice} 
                      onChange={(e) => setSinglePrice(Number(e.target.value))} 
                      placeholder="Ex: 10.00" 
                      className="mg-input text-xs" 
                    />
                  </div>
                </div>

                <div className="pt-4 border-t border-[var(--mg-card-border)]">
                  <button 
                    type="submit" 
                    disabled={creatingSingle}
                    className="mg-btn mg-btn-primary w-full text-xs uppercase tracking-wider disabled:opacity-50"
                  >
                    {creatingSingle ? 'Criando Usuário...' : 'Criar Usuário Avulso Agora'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : activeTab === 'orders' ? (
        /* ==================== TAB 4: PENDING ORDERS ==================== */
        <div className="space-y-5 animate-fade-in">

          {/* Header da aba */}
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-extrabold" style={{ color: 'var(--mg-text-heading)' }}>
                📦 {pendingCounts.total} Pedido{pendingCounts.total !== 1 ? 's' : ''} Pendente{pendingCounts.total !== 1 ? 's' : ''}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>
                {pendingCounts.manual > 0 && <span className="text-amber-600 font-semibold">{pendingCounts.manual} aguardam aprovação manual</span>}
                {pendingCounts.manual > 0 && pendingCounts.mercadopago > 0 && <span className="mx-1">·</span>}
                {pendingCounts.mercadopago > 0 && <span style={{ color: 'var(--mg-primary)' }} className="font-semibold">{pendingCounts.mercadopago} aguardam webhook MP</span>}
                {pendingCounts.total === 0 && <span style={{ color: 'var(--mg-success)' }} className="font-semibold">Nenhum pedido pendente ✓</span>}
              </p>
            </div>
            <button
              onClick={() => fetchPendingOrders(true)}
              disabled={refreshingOrders}
              className="mg-btn mg-btn-secondary text-xs disabled:opacity-50"
            >
              <svg className={`w-3.5 h-3.5 ${refreshingOrders ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/>
              </svg>
              Atualizar
            </button>
          </div>

          {pendingCounts.total === 0 && (
            <div className="mg-card p-12 text-center">
              <div className="text-5xl mb-3">✅</div>
              <p className="font-extrabold text-lg" style={{ color: 'var(--mg-text-heading)' }}>Tudo em dia!</p>
              <p className="text-sm mt-1" style={{ color: 'var(--mg-text-muted)' }}>Não há pedidos pendentes de aprovação ou pagamento.</p>
              <p className="text-xs mt-2" style={{ color: 'var(--mg-text-subtle)' }}>Esta lista atualiza automaticamente a cada 30 segundos.</p>
            </div>
          )}

          {/* Grupo 1: PIX Manual */}
          {pendingPix.length > 0 && (
            <div className="mg-card p-5 border-amber-500/40">
              <div className="flex items-center gap-2 mb-4">
                <span className="mg-badge-warning">
                  ✋ PIX MANUAL — AGUARDA APROVAÇÃO
                </span>
                <span className="text-xs font-medium" style={{ color: 'var(--mg-warning-text)' }}>Confirme o recebimento no seu banco antes de aprovar</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingPix.map((p) => (
                  <div key={p.id} className="mg-card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-sm leading-tight" style={{ color: 'var(--mg-text-heading)' }}>{p.clientName || p.username}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>@{p.username}</p>
                        {p.clientPhone && <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--mg-primary)' }}>📱 {p.clientPhone}</p>}
                        {p.clientCpf && <p className="text-[11px] mt-0.5" style={{ color: 'var(--mg-text-subtle)' }}>CPF: {p.clientCpf}</p>}
                      </div>
                      <span className="text-[10px] whitespace-nowrap font-medium shrink-0" style={{ color: 'var(--mg-text-muted)' }}>{p.formattedDate}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)]" style={{ color: 'var(--mg-text-body)' }}>🎟️ {p.plan}</span>
                      {p.isVoucher && <span className="mg-badge-primary text-[11px]">Voucher</span>}
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
                          <button onClick={() => navigator.clipboard?.writeText(p.pixPayload)} className="text-slate-400 hover:text-blue-600 shrink-0 p-1 rounded" title="Copiar">📋</button>
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

          {/* Grupo 2: Mercado Pago */}
          {pendingMp.length > 0 && (
            <div className="mg-card p-5 border-blue-500/40">
              <div className="flex items-center gap-2 mb-4">
                <span className="mg-badge-primary">
                  🤖 MERCADO PAGO — AGUARDANDO CONFIRMAÇÃO AUTOMÁTICA
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {pendingMp.map((p) => (
                  <div key={p.id} className="mg-card p-4 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-black text-sm leading-tight" style={{ color: 'var(--mg-text-heading)' }}>{p.clientName || p.username}</p>
                        <p className="text-[11px] font-mono mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>@{p.username}</p>
                        {p.clientPhone && <p className="text-[11px] font-semibold mt-0.5" style={{ color: 'var(--mg-primary)' }}>📱 {p.clientPhone}</p>}
                      </div>
                      <span className="text-[10px] whitespace-nowrap font-medium shrink-0" style={{ color: 'var(--mg-text-muted)' }}>{p.formattedDate}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-lg border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)]" style={{ color: 'var(--mg-text-body)' }}>🎟️ {p.plan}</span>
                      {p.isVoucher && <span className="mg-badge-primary text-[11px]">Voucher</span>}
                      {p.giftTo && <span className="mg-badge-primary text-[11px]">🎁 Para: {p.giftTo}</span>}
                    </div>
                    <div className="flex items-center justify-between border border-blue-500/30 bg-blue-500/10 rounded-lg px-3 py-2">
                      <span className="text-xs font-bold" style={{ color: 'var(--mg-text-muted)' }}>Valor esperado:</span>
                      <span className="text-lg font-black" style={{ color: 'var(--mg-primary)' }}>{formatBRL(p.amount)}</span>
                    </div>
                    <div className="flex items-center gap-2 border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] rounded-lg px-3 py-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse shrink-0"></span>
                      <span className="text-[11px]" style={{ color: 'var(--mg-text-muted)' }}>MP ID: <code className="font-mono" style={{ color: 'var(--mg-text-body)' }}>{p.pixId}</code></span>
                    </div>
                    <div className="flex gap-2 mt-auto pt-1">
                      <button onClick={() => handleRejectPix(p.id)} className="mg-btn mg-btn-danger flex-1 text-xs py-1.5">✕ Cancelar</button>
                      <button onClick={() => handleApprovePix(p.id)} className="mg-btn mg-btn-primary flex-1 text-xs py-1.5" title="Aprovar manualmente caso o webhook não tenha chegado">⚡ Forçar Aprovação</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      ) : null}

      {/* Floating Sticky Print Bar */}
      {selectedIds.length > 0 && activeTab === 'list' && (
        <div 
          className="fixed bottom-6 left-1/2 -translate-x-1/2 p-4 rounded-2xl flex items-center justify-between gap-6 shadow-2xl z-50 animate-scale-up max-w-[90vw] md:max-w-xl w-full mg-card"
        >
          <div className="flex items-center gap-2 text-xs font-bold" style={{ color: 'var(--mg-text-body)' }}>
            <span className="w-2.5 h-2.5 rounded-full animate-pulse shrink-0" style={{ backgroundColor: 'var(--mg-primary)' }} />
            <span>
              {selectedIds.length} {selectedIds.length === 1 ? 'voucher selecionado' : 'vouchers selecionados'}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <button 
              onClick={() => setSelectedIds([])}
              className="mg-btn mg-btn-secondary text-xs"
            >
              Limpar
            </button>
            <button 
              onClick={handlePrintSelected}
              className="mg-btn mg-btn-primary text-xs"
            >
              🖨️ Imprimir Selecionados
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
