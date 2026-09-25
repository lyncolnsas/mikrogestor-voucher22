/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface Plan {
  id: string;
  title: string;
  profile: string;
  price: number;
  uptimeLimit: string | null;
}

interface Voucher {
  id: string;
  status: string;
  amount: number;
  profile: string | null;
  voucherCode: string | null;
  giftTo: string | null;
  uptimeLimit: string | null;
  voucherActivatedAt: string | null;
  pixQrCodeBase64: string | null;
  pixPayload: string | null;
  createdAt: string;
  usage?: {
    uptimeRaw: string;
    limitRaw: string;
    uptimeFormatted: string;
    limitFormatted: string;
  };
}

interface CustomerData {
  id: string;
  name: string | null;
  hotspotUser: string;
  whatsappNumber: string | null;
  vouchers: Voucher[];
}

type View = 'login' | 'dashboard' | 'buy' | 'awaiting' | 'voucher-ready' | 'limit';
type LoginTab = 'credentials' | 'whatsapp';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatDuration(uptimeLimit: string | null): string {
  if (!uptimeLimit || uptimeLimit === 'none') return 'Ilimitado';
  const dayMatch = uptimeLimit.match(/(\d+)d/);
  const timeMatch = uptimeLimit.match(/(\d+):(\d+):(\d+)/);
  if (dayMatch && Number(dayMatch[1]) >= 1) {
    const d = Number(dayMatch[1]);
    return d === 1 ? '1 Dia' : `${d} Dias`;
  }
  if (timeMatch) {
    const h = Number(timeMatch[1]);
    const m = Number(timeMatch[2]);
    if (h === 0 && m > 0) return `${m} min`;
    if (m === 0) return h === 1 ? '1 Hora' : `${h} Horas`;
    return `${h}h${m.toString().padStart(2, '0')}min`;
  }
  return uptimeLimit;
}

function formatPrice(price: number): string {
  return price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function voucherStatusLabel(v: Voucher): { label: string; color: string } {
  if (v.status === 'approved' && v.voucherActivatedAt) return { label: 'Ativo', color: '#10b981' };
  if (v.status === 'approved') return { label: 'Disponível', color: '#006eff' };
  if (v.status === 'pending') return { label: 'Aguard. Pagamento', color: '#f59e0b' };
  return { label: 'Expirado', color: '#6b7280' };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-Components
// ─────────────────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
      <div style={{
        width: 36, height: 36,
        border: '3px solid rgba(0,110,255,0.15)',
        borderTop: '3px solid #006eff',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
    </div>
  );
}

function WifiBanner({ networkName }: { networkName: string }) {
  return (
    <div style={{
      background: 'rgba(245,158,11,0.1)',
      border: '1px solid rgba(245,158,11,0.3)',
      borderRadius: 10,
      padding: '10px 14px',
      fontSize: 12,
      color: '#fbbf24',
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      marginBottom: 20,
    }}>
      <span>📶</span>
      <span>Este portal funciona apenas conectado ao <strong>{networkName}</strong>.</span>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Component
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  dnsName?: string;
  networkName: string;
}

export default function PlanosClientPage({ networkName }: Props) {
  const [view, setView] = useState<View>('buy');
  const [loginTab, setLoginTab] = useState<LoginTab>('credentials');
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Waiting list state
  const [waitingListSuccess, setWaitingListSuccess] = useState('');
  const [waitingListLoading, setWaitingListLoading] = useState(false);

  // Login form
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [whatsapp, setWhatsapp] = useState('');

  // Buy form
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [voucherQty, setVoucherQty] = useState(1);
  const [forFriend, setForFriend] = useState(false);
  const [friendName, setFriendName] = useState('');

  // Awaiting / voucher ready
  const [pendingPayment, setPendingPayment] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling for dashboard updates (every 10 seconds)
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    
    const fetchCustomer = async () => {
      try {
        const res = await fetch('/api/portal/customer/me', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          if (json.success) setCustomer(json.data);
        }
      } catch { /* ignore */ }
    };

    if (view === 'dashboard') {
      interval = setInterval(fetchCustomer, 10000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [view]);

  // Refresh immediately when returning to the tab (visibilitychange)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && view === 'dashboard') {
        fetch('/api/portal/customer/me', { credentials: 'include' })
          .then(res => res.json())
          .then(json => {
            if (json.success) setCustomer(json.data);
          })
          .catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [view]);

  // Check existing session and system status on mount
  useEffect(() => {
    void (async () => {
      try {
        // 1. Check if capacity limit is reached
        const statusRes = await fetch('/api/portal/status');
        if (statusRes.ok) {
          const statusJson = await statusRes.json();
          if (statusJson.success && statusJson.limitReached) {
            setView('limit');
            return; // STOP! Limit reached, show Fila de Espera
          }
        }

        // 2. If no limit, check if user is logged in
        const res = await fetch('/api/portal/customer/me', { credentials: 'include' });
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            setCustomer(json.data);
            setView('dashboard');
          }
        }
      } catch { /* ignore */ }
    })();
  }, []);

  // Load plans when entering buy view
  useEffect(() => {
    if (view !== 'buy' || plans.length > 0) return;
    void (async () => {
      const res = await fetch('/api/portal/customer/plans', { credentials: 'include' });
      const json = await res.json();
      if (json.success) {
        setPlans(json.data);
      }
    })();
  }, [view, plans.length]);

  // Polling for payment approval
  const startPolling = useCallback((paymentId: string) => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/portal/customer/voucher-status?paymentId=${paymentId}`, { credentials: 'include' });
        const json = await res.json();
        if (json.success && json.data.isApproved) {
          clearInterval(pollingRef.current!);
          pollingRef.current = null;
          setPendingPayment(json.data);
          setView('voucher-ready');
          // Refresh customer data
          const meRes = await fetch('/api/portal/customer/me', { credentials: 'include' });
          const meJson = await meRes.json();
          if (meJson.success) setCustomer(meJson.data);
        }
      } catch { /* ignore */ }
    }, 3000);
  }, []);

  useEffect(() => {
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const body = loginTab === 'whatsapp'
        ? { whatsapp }
        : { username, password };

      const res = await fetch('/api/portal/customer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        credentials: 'include',
      });
      const json = await res.json();
      if (!json.success) { setError(json.message); return; }

      // Login response already includes full customer data + vouchers
      setCustomer(json.data);
      setView('dashboard');
    } catch {
      setError('Erro de conexão. Verifique sua rede.');
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await fetch('/api/portal/customer/me', { method: 'DELETE', credentials: 'include' });
    setCustomer(null);
    setView('login');
  }

  async function handleJoinWaitingList(e: React.FormEvent) {
    e.preventDefault();
    if (!whatsapp) { setError('Informe seu WhatsApp'); return; }
    setWaitingListLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/waiting-list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ whatsapp })
      });
      const json = await res.json();
      if (!json.success) {
        setError(json.message);
      } else {
        setWaitingListSuccess(json.message);
      }
    } catch {
      setError('Erro ao enviar.');
    } finally {
      setWaitingListLoading(false);
    }
  }

  async function handleBuyVoucher(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPlan) { setError('Selecione um plano.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/portal/customer/buy-voucher', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId: selectedPlan.id,
          forFriend,
          friendName: forFriend ? friendName : undefined,
          qty: voucherQty,
        }),
        credentials: 'include',
      });
      if (res.status === 401) {
        setView('login');
        return;
      }
      const json = await res.json();
      if (!json.success) { setError(json.message); return; }
      setPendingPayment(json.data);
      if (json.data.amount === 0) {
        setView('voucher-ready');
        // Refresh customer data
        const meRes = await fetch('/api/portal/customer/me', { credentials: 'include' });
        const meJson = await meRes.json();
        if (meJson.success) setCustomer(meJson.data);
      } else {
        setView('awaiting');
        startPolling(json.data.paymentId);
      }
    } catch {
      setError('Erro ao criar pagamento. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

  function copyPix() {
    if (pendingPayment?.pixPayload) {
      navigator.clipboard.writeText(pendingPayment.pixPayload).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      });
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────

  const s = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f172a 0%, #0a1628 50%, #0d1f3c 100%)',
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'flex-start',
      padding: '24px 16px 48px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      color: '#e2e8f0',
    },
    card: {
      background: 'rgba(15, 25, 50, 0.85)',
      backdropFilter: 'blur(20px)',
      border: '1px solid rgba(0, 110, 255, 0.18)',
      borderRadius: 20,
      padding: '32px 28px',
      width: '100%',
      maxWidth: 440,
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.5)',
    },
    header: {
      textAlign: 'center' as const,
      marginBottom: 28,
    },
    logo: {
      width: 52,
      height: 52,
      background: 'linear-gradient(135deg, #006eff, #2563eb)',
      borderRadius: 14,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      margin: '0 auto 14px',
      fontSize: 24,
      boxShadow: '0 0 24px rgba(0,110,255,0.4)',
    },
    title: {
      fontSize: 22,
      fontWeight: 700,
      color: '#f1f5f9',
      margin: 0,
    },
    subtitle: {
      fontSize: 13,
      color: '#64748b',
      marginTop: 4,
    },
    tab: (active: boolean) => ({
      flex: 1,
      padding: '10px 0',
      background: active ? 'rgba(0,110,255,0.2)' : 'transparent',
      border: 'none',
      borderBottom: active ? '2px solid #006eff' : '2px solid transparent',
      color: active ? '#006eff' : '#64748b',
      fontWeight: active ? 600 : 400,
      fontSize: 14,
      cursor: 'pointer',
      transition: 'all 0.2s',
      borderRadius: '6px 6px 0 0',
    }),
    input: {
      width: '100%',
      padding: '13px 14px',
      background: 'rgba(255,255,255,0.06)',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: 10,
      color: '#e2e8f0',
      fontSize: 15,
      outline: 'none',
      boxSizing: 'border-box' as const,
      transition: 'border-color 0.2s',
    },
    label: {
      fontSize: 12,
      fontWeight: 600,
      color: '#94a3b8',
      marginBottom: 6,
      display: 'block',
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
    },
    btn: (variant: 'primary' | 'ghost' | 'danger' = 'primary') => ({
      width: '100%',
      padding: '14px 20px',
      borderRadius: 10,
      border: 'none',
      fontWeight: 700,
      fontSize: 15,
      cursor: 'pointer',
      transition: 'all 0.2s',
      background: variant === 'primary'
        ? 'linear-gradient(135deg, #006eff, #2563eb)'
        : variant === 'danger'
        ? 'rgba(239,68,68,0.15)'
        : 'rgba(255,255,255,0.06)',
      color: variant === 'primary' ? '#fff' : variant === 'danger' ? '#ef4444' : '#94a3b8',
      boxShadow: variant === 'primary' ? '0 4px 15px rgba(0,110,255,0.3)' : 'none',
    }),
    error: {
      background: 'rgba(239,68,68,0.1)',
      border: '1px solid rgba(239,68,68,0.3)',
      borderRadius: 8,
      padding: '10px 14px',
      color: '#fca5a5',
      fontSize: 13,
      marginBottom: 16,
    },
    planCard: (selected: boolean) => ({
      padding: '14px 16px',
      border: selected ? '2px solid #006eff' : '1px solid rgba(255,255,255,0.08)',
      borderRadius: 12,
      cursor: 'pointer',
      background: selected ? 'rgba(0,110,255,0.1)' : 'rgba(255,255,255,0.03)',
      transition: 'all 0.2s',
      marginBottom: 8,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    }),
    divider: {
      border: 'none',
      borderTop: '1px solid rgba(255,255,255,0.06)',
      margin: '20px 0',
    },
    badge: (color: string) => ({
      display: 'inline-block',
      padding: '3px 10px',
      borderRadius: 20,
      fontSize: 11,
      fontWeight: 600,
      background: `${color}20`,
      color,
      border: `1px solid ${color}40`,
    }),
    voucherCard: {
      background: 'rgba(255,255,255,0.04)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 14,
      padding: '16px',
      marginBottom: 10,
    },
  };

  // ── View: LOGIN ────────────────────────────────────────────────────────────

  if (view === 'login') return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); @keyframes spin { to { transform: rotate(360deg) } } input:focus { border-color: rgba(0,110,255,0.5) !important; }`}</style>
      <div style={s.card}>
        <div style={s.header}>
          <div style={s.logo}>🌐</div>
          <h1 style={s.title}>Minha Conta</h1>
          <p style={s.subtitle}>Acesse sua conta para gerenciar seus planos</p>
        </div>

        <WifiBanner networkName={networkName} />

        <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 22 }}>
          <button style={s.tab(loginTab === 'credentials')} onClick={() => setLoginTab('credentials')}>
            👤 Usuário/Senha
          </button>
          <button style={s.tab(loginTab === 'whatsapp')} onClick={() => setLoginTab('whatsapp')}>
            📱 WhatsApp
          </button>
        </div>

        {error && <div style={s.error}>⚠️ {error}</div>}

        <form onSubmit={handleLogin}>
          {loginTab === 'credentials' ? (
            <>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>Usuário</label>
                <input
                  style={s.input}
                  type="text"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  placeholder="Seu nome de usuário"
                  autoComplete="username"
                  required
                />
              </div>
              <div style={{ marginBottom: 20 }}>
                <label style={s.label}>Senha</label>
                <input
                  style={s.input}
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Sua senha"
                  autoComplete="current-password"
                  required
                />
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 20 }}>
              <label style={s.label}>Número de WhatsApp</label>
              <input
                style={s.input}
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                autoComplete="tel"
                required
              />
              <p style={{ fontSize: 12, color: '#475569', marginTop: 6 }}>
                Informe o mesmo número cadastrado no Wi-Fi.
              </p>
            </div>
          )}

          <button type="submit" style={s.btn('primary')} disabled={loading}>
            {loading ? '⏳ Entrando...' : '🔓 Entrar'}
          </button>
        </form>

        <hr style={s.divider} />

        <p style={{ textAlign: 'center', fontSize: 12, color: '#475569', margin: 0 }}>
          Ainda não tem conta?{' '}
          <a href="/portal/register" style={{ color: '#006eff', textDecoration: 'none', fontWeight: 600 }}>
            Conectar ao Wi-Fi
          </a>
        </p>
      </div>
    </div>
  );

  // ── View: DASHBOARD ───────────────────────────────────────────────────────

  if (view === 'dashboard') return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); @keyframes spin { to { transform: rotate(360deg) } }`}</style>
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ ...s.logo, width: 40, height: 40, fontSize: 18, margin: 0 }}>🌐</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: '#f1f5f9' }}>
                {customer?.name || customer?.hotspotUser}
              </div>
              <div style={{ fontSize: 12, color: '#475569' }}>@{customer?.hotspotUser}</div>
            </div>
          </div>
          <button
            onClick={handleLogout}
            style={{ ...s.btn('ghost'), width: 'auto', padding: '8px 14px', fontSize: 13 }}
          >
            Sair
          </button>
        </div>

        <WifiBanner networkName={networkName} />

        <button
          style={{ ...s.btn('primary'), marginBottom: 24 }}
          onClick={() => { setView('buy'); setError(''); setSelectedPlan(null); setForFriend(false); setFriendName(''); }}
        >
          🎟️ Comprar Voucher
        </button>

        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 }}>
            Meus Vouchers
          </div>

          {!customer?.vouchers?.length ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: '#475569', fontSize: 14 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🎟️</div>
              <div>Nenhum voucher comprado ainda.</div>
            </div>
          ) : (
            customer.vouchers.map(v => {
              const { label, color } = voucherStatusLabel(v);
              return (
                <div key={v.id} style={s.voucherCard}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 15, color: '#f1f5f9' }}>
                        {v.profile || 'Voucher'} — {formatDuration(v.uptimeLimit)}
                      </div>
                      {v.giftTo && <div style={{ fontSize: 12, color: '#94a3b8' }}>🎁 Para: {v.giftTo}</div>}
                    </div>
                    <span style={s.badge(color)}>{label}</span>
                  </div>

                  {v.usage && (
                    <div style={{ fontSize: 13, color: '#cbd5e1', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width: 14, height: 14, color: '#3b82f6'}}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                      Consumido: <span style={{fontWeight: 600, color: '#fff'}}>{v.usage.uptimeFormatted}</span> de {v.usage.limitFormatted}
                    </div>
                  )}

                  {v.status === 'approved' && v.voucherCode && (
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '8px 12px', gap: 10, marginBottom: 10 }}>
                      <div style={{ flex: 1, fontFamily: 'monospace', fontSize: 16, letterSpacing: 3, fontWeight: 600, color: '#60a5fa' }}>
                        {v.voucherCode}
                      </div>
                      <button
                        onClick={() => { navigator.clipboard.writeText(v.voucherCode!); }}
                        style={{ background: 'none', border: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', padding: '4px 8px', borderRadius: 6, transition: 'all 0.2s' }}
                        onMouseOver={(e) => e.currentTarget.style.color = '#fff'}
                        onMouseOut={(e) => e.currentTarget.style.color = '#94a3b8'}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        Copiar
                      </button>
                    </div>
                  )}

                  {v.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button
                        onClick={() => { setPendingPayment({ paymentId: v.id, ...v }); setView('awaiting'); startPolling(v.id); }}
                        style={{ ...s.btn('ghost'), fontSize: 13, padding: '8px 14px', width: 'auto' }}
                      >
                        Ver QR Code
                      </button>
                    </div>
                  )}

                  <div style={{ fontSize: 11, color: '#334155', marginTop: 8 }}>
                    {formatPrice(v.amount)} · {new Date(v.createdAt).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );

  // ── View: BUY ─────────────────────────────────────────────────────────────

  if (view === 'buy') return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); @keyframes spin { to { transform: rotate(360deg) } } input:focus { border-color: rgba(0,110,255,0.5) !important; }`}</style>
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <button
            onClick={() => setView('dashboard')}
            style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: 22, padding: 0, lineHeight: 1 }}
          >
            ←
          </button>
          <h1 style={{ ...s.title, fontSize: 20 }}>Comprar Voucher</h1>
        </div>

        {error && <div style={s.error}>⚠️ {error}</div>}

        <div style={{ marginBottom: 20 }}>
          <label style={s.label}>Escolha um plano</label>
          {plans.length === 0 ? (
            <Spinner />
          ) : (
            plans.map(p => (
              <div
                key={p.id}
                style={s.planCard(selectedPlan?.id === p.id)}
                onClick={() => setSelectedPlan(p)}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: '#f1f5f9' }}>{p.title}</div>
                  <div style={{ fontSize: 12, color: '#64748b', marginTop: 2 }}>⏱️ {formatDuration(p.uptimeLimit)}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: 18, color: '#10b981' }}>{formatPrice(p.price)}</div>
              </div>
            ))
          )}
        </div>

        <hr style={s.divider} />

        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={forFriend}
              onChange={e => setForFriend(e.target.checked)}
              style={{ width: 18, height: 18, accentColor: '#006eff', cursor: 'pointer' }}
            />
            <span style={{ fontSize: 14, color: '#94a3b8' }}>🎁 Comprar como presente para um amigo</span>
          </label>

          {forFriend && (
            <div style={{ marginTop: 12 }}>
              <label style={s.label}>Nome do amigo</label>
              <input
                style={s.input}
                type="text"
                value={friendName}
                onChange={e => setFriendName(e.target.value)}
                placeholder="Nome de quem vai receber"
              />
            </div>
          )}

          <div style={{ marginTop: 20 }}>
            <label style={s.label}>Quantidade de Vouchers</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button 
                type="button" 
                onClick={() => setVoucherQty(Math.max(1, voucherQty - 1))}
                style={{ ...s.btn('ghost'), width: 40, height: 40, padding: 0, fontSize: 18, borderRadius: 10 }}
              >-</button>
              <span style={{ fontSize: 18, fontWeight: 'bold', width: 40, textAlign: 'center' }}>{voucherQty}</span>
              <button 
                type="button" 
                onClick={() => setVoucherQty(Math.min(10, voucherQty + 1))}
                style={{ ...s.btn('ghost'), width: 40, height: 40, padding: 0, fontSize: 18, borderRadius: 10 }}
              >+</button>
            </div>
          </div>
        </div>

        {selectedPlan && (
          <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8' }}>
              <span>Plano:</span>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{selectedPlan.title}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, color: '#94a3b8', marginTop: 6 }}>
              <span>Duração:</span>
              <span style={{ color: '#f1f5f9', fontWeight: 600 }}>{formatDuration(selectedPlan.uptimeLimit)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 16, fontWeight: 700, marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
              <span style={{ color: '#94a3b8' }}>Total:</span>
              <span style={{ color: '#10b981' }}>{formatPrice(selectedPlan.price)}</span>
            </div>
          </div>
        )}

        <form onSubmit={handleBuyVoucher}>
          <button
            type="submit"
            style={s.btn('primary')}
            disabled={loading || !selectedPlan}
          >
            {loading ? '⏳ Gerando Pix...' : '⚡ Gerar Pix e Pagar'}
          </button>
        </form>
      </div>
    </div>
  );

  // ── View: AWAITING PAYMENT ────────────────────────────────────────────────

  if (view === 'awaiting') return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); @keyframes spin { to { transform: rotate(360deg) } } @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>⏳</div>
          <h1 style={{ ...s.title, fontSize: 20 }}>Aguardando Pagamento</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Escaneie o QR Code ou copie o código Pix abaixo
          </p>
          {pendingPayment?.plan && (
            <p style={{ fontSize: 13, color: '#10b981', marginTop: 4 }}>
              {pendingPayment.plan.title} — {formatPrice(pendingPayment.amount)}
            </p>
          )}
        </div>

        {pendingPayment?.pixQrCodeBase64 ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 16 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`data:image/png;base64,${pendingPayment.pixQrCodeBase64}`}
                alt="QR Code Pix"
                style={{ width: 200, height: 200, display: 'block' }}
              />
            </div>
          </div>
        ) : pendingPayment?.pixPayload ? (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div style={{ background: '#fff', padding: 16, borderRadius: 16 }}>
              <QRCodeSVG value={pendingPayment.pixPayload} size={200} />
            </div>
          </div>
        ) : null}

        {pendingPayment?.pixPayload && (
          <div style={{ marginBottom: 20 }}>
            <label style={s.label}>Pix Copia e Cola</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                style={{ ...s.input, flex: 1, fontSize: 11, fontFamily: 'monospace', cursor: 'text' }}
                value={pendingPayment.pixPayload}
                readOnly
              />
              <button
                onClick={copyPix}
                style={{ ...s.btn('ghost'), width: 'auto', padding: '0 16px', fontSize: 13, whiteSpace: 'nowrap' }}
              >
                {copied ? '✅ Copiado!' : '📋 Copiar'}
              </button>
            </div>
          </div>
        )}

        {pendingPayment?.isManualPix && (
          <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: '#f59e0b', fontWeight: 600, marginBottom: 8 }}>⚠️ Pagamento Manual</div>
            <div style={{ fontSize: 13, color: '#fcd34d', lineHeight: 1.5 }}>
              Transfira o valor exato para a chave Pix acima. Após o pagamento, envie o comprovante para o suporte para liberação do voucher.
            </div>
            <a
              href={`https://wa.me/?text=${encodeURIComponent('Olá, acabei de pagar meu voucher Pix Manual. Segue o comprovante:')}`}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-block', marginTop: 12, ...s.btn('primary'), padding: '8px 16px', fontSize: 13, width: 'auto', textDecoration: 'none' }}
            >
              📱 Enviar Comprovante
            </a>
          </div>
        )}

        {!pendingPayment?.isManualPix && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(0,110,255,0.08)', border: '1px solid rgba(0,110,255,0.2)', borderRadius: 10, padding: '12px 16px', marginBottom: 24 }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#006eff', animation: 'pulse 1.5s ease-in-out infinite' }} />
            <span style={{ fontSize: 13, color: '#93c5fd' }}>Aguardando confirmação do pagamento automaticamente...</span>
          </div>
        )}

        <button
          onClick={() => { setView('dashboard'); }}
          style={{ ...s.btn('ghost'), fontSize: 13 }}
        >
          Voltar ao painel (o pagamento continuará sendo verificado)
        </button>
      </div>
    </div>
  );

  // ── View: VOUCHER READY ───────────────────────────────────────────────────

  if (view === 'voucher-ready') return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap'); @keyframes spin { to { transform: rotate(360deg) } } @keyframes pop { 0%{transform:scale(0.8);opacity:0} 70%{transform:scale(1.05)} 100%{transform:scale(1);opacity:1} }`}</style>
      <div style={{ ...s.card, animation: 'pop 0.5s ease-out' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>🎉</div>
          <h1 style={{ ...s.title, fontSize: 20, color: '#10b981' }}>Pagamento Confirmado!</h1>
          <p style={{ fontSize: 13, color: '#64748b', marginTop: 4 }}>
            Seu voucher está pronto para uso
          </p>
        </div>

        {pendingPayment?.giftTo && (
          <div style={{ textAlign: 'center', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '10px 16px', marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#fbbf24' }}>🎁 Presente para: <strong>{pendingPayment.giftTo}</strong></span>
          </div>
        )}

        {pendingPayment?.voucherCode && (
          <div style={{ background: 'rgba(0,110,255,0.08)', border: '1px solid rgba(0,110,255,0.3)', borderRadius: 14, padding: '20px', marginBottom: 20, textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Código do Voucher</div>
            <div style={{ fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: '#60a5fa', letterSpacing: 5 }}>
              {pendingPayment.voucherCode}
            </div>
            <button
              onClick={() => navigator.clipboard.writeText(pendingPayment.voucherCode)}
              style={{ ...s.btn('ghost'), width: 'auto', margin: '12px auto 0', padding: '8px 20px', fontSize: 13, display: 'block' }}
            >
              📋 Copiar Código
            </button>
          </div>
        )}

        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: '#64748b' }}>👤 Usuário</span>
            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>{customer?.hotspotUser}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, marginBottom: 8 }}>
            <span style={{ color: '#64748b' }}>🔑 Senha</span>
            <span style={{ fontWeight: 600, color: '#f1f5f9' }}>••••••</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
            <span style={{ color: '#64748b' }}>⏱️ Duração</span>
            <span style={{ fontWeight: 600, color: '#10b981' }}>
              {formatDuration(pendingPayment?.plan?.uptimeLimit || null)}
            </span>
          </div>
        </div>

        <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 10, padding: '12px 14px', marginBottom: 20, fontSize: 12, color: '#fbbf24' }}>
          ⚠️ <strong>Atenção:</strong> O tempo começa a contar a partir do primeiro login no Wi-Fi. O voucher é de tempo corrido (sem pausas).
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => { setView('dashboard'); setPendingPayment(null); }}
            style={s.btn('primary')}
          >
            🏠 Ir para o Painel
          </button>
        </div>
      </div>
    </div>
  );

  // ── View: LIMIT EXCEEDED (Fila de Espera) ─────────────────────────────────

  if (view === 'limit') return (
    <div style={s.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');`}</style>
      <div style={s.card}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 56, marginBottom: 10 }}>⚠️</div>
          <h1 style={{ ...s.title, fontSize: 20, color: '#f59e0b' }}>Rede Lotada!</h1>
          <p style={{ fontSize: 13, color: '#94a3b8', marginTop: 8, lineHeight: 1.5 }}>
            Atingimos o limite máximo de usuários conectados.
            <br/><br/>
            Deixe seu WhatsApp abaixo e nós avisaremos assim que uma vaga for liberada na rede!
          </p>
        </div>

        {waitingListSuccess ? (
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: 10, padding: '16px', textAlign: 'center', color: '#10b981', fontSize: 14 }}>
            ✅ {waitingListSuccess}
          </div>
        ) : (
          <form onSubmit={handleJoinWaitingList}>
            <div style={{ marginBottom: 16 }}>
              <label style={s.label}>Seu WhatsApp</label>
              <input
                type="tel"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
                placeholder="(11) 99999-9999"
                required
                style={s.input}
              />
            </div>
            
            {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 16, textAlign: 'center' }}>{error}</div>}

            <button type="submit" disabled={waitingListLoading} style={s.btn('primary')}>
              {waitingListLoading ? '⏳ Entrando...' : 'Entrar na Fila de Espera'}
            </button>
          </form>
        )}
      </div>
    </div>
  );

  return null;
}
