'use client';

import { useState, useEffect, useCallback } from 'react';

interface WhatsappPlan {
  id: string;
  title: string;
  profile: string;
  price: number;
  uptimeLimit: string;
  active: boolean;
}

export default function WhatsappPlansPage() {
  const [plans, setPlans] = useState<WhatsappPlan[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [title, setTitle] = useState('');
  const [profile, setProfile] = useState('');
  const [price, setPrice] = useState('0');
  const [uptimeLimit, setUptimeLimit] = useState('1d 00:00:00');
  const [active, setActive] = useState(true);

  const fetchPlans = useCallback(async () => {
    try {
      const res = await fetch('/api/whatsapp-plans');
      if (res.ok) setPlans(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const addPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('/api/whatsapp-plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title, 
        profile, 
        price: Number(price), 
        uptimeLimit: uptimeLimit || 'none',
        active 
      })
    });
    setTitle('');
    setProfile('');
    setPrice('0');
    setUptimeLimit('1d 00:00:00');
    setActive(true);
    fetchPlans();
  };

  const deletePlan = async (id: string) => {
    if (!confirm('Excluir este plano?')) return;
    await fetch(`/api/whatsapp-plans/${id}`, { method: 'DELETE' });
    fetchPlans();
  };

  const toggleActive = async (plan: WhatsappPlan) => {
    await fetch(`/api/whatsapp-plans/${plan.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...plan, active: !plan.active })
    });
    fetchPlans();
  };

  const presets = [
    { label: '15m', val: '00:15:00' },
    { label: '1h', val: '01:00:00' },
    { label: '24h', val: '1d 00:00:00' },
    { label: '7 Dias', val: '7d 00:00:00' },
    { label: '30 Dias', val: '30d 00:00:00' },
    { label: 'Ilimitado', val: 'none' },
  ];

  return (
    <main className="mg-page-container">
      {/* Page Header */}
      <header className="mg-page-header-row">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="mg-badge-primary">
              Catálogo de Vendas (PIX)
            </span>
          </div>
          <h1 className="mg-page-title">Catálogo de Planos Hotspot</h1>
          <p className="mg-page-subtitle">
            Configure os planos e durações disponíveis para compra no portal e via WhatsApp.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="mg-card overflow-hidden h-fit">
          <div className="mg-card-header">
            <h2 className="mg-card-title">Adicionar Novo Plano</h2>
            <p className="mg-card-subtitle">Defina nome, profile MikroTik, preço e duração</p>
          </div>
          <form onSubmit={addPlan} className="p-6 space-y-4">
            <div>
              <label className="mg-label">Nome de Exibição (Visível ao cliente)</label>
              <input 
                required 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Ex: 24 Horas Turbo, 1 Dia de Acesso"
                className="mg-input" 
              />
            </div>
            <div>
              <label className="mg-label">Nome do Profile (Exato no MikroTik)</label>
              <input 
                required 
                type="text" 
                value={profile} 
                onChange={e => setProfile(e.target.value)} 
                placeholder="Ex: default, 1_Dia_10M, plano_vip"
                className="mg-input" 
              />
            </div>
            <div>
              <label className="mg-label">Preço R$ (Valor cobrado no PIX)</label>
              <input 
                required 
                type="number" 
                step="0.01" 
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                className="mg-input font-bold" 
              />
            </div>

            <div>
              <label className="mg-label">Duração / Limite de Tempo (`limit-uptime`)</label>
              <input 
                type="text" 
                value={uptimeLimit} 
                onChange={e => setUptimeLimit(e.target.value)} 
                placeholder="Ex: 01:00:00 ou 1d 00:00:00"
                className="mg-input font-mono mb-2" 
              />
              <div className="flex flex-wrap gap-1.5">
                {presets.map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setUptimeLimit(p.val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors border ${
                      uptimeLimit === p.val 
                        ? 'bg-[var(--mg-primary)] text-white font-bold border-transparent shadow-xs' 
                        : 'border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] font-semibold hover:opacity-80'
                    }`}
                    style={uptimeLimit !== p.val ? { color: 'var(--mg-text-body)' } : {}}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="plan-active-check"
                type="checkbox"
                checked={active}
                onChange={e => setActive(e.target.checked)}
                className="w-4 h-4 rounded cursor-pointer"
                style={{ accentColor: 'var(--mg-primary)' }}
              />
              <label htmlFor="plan-active-check" className="text-xs font-bold cursor-pointer" style={{ color: 'var(--mg-text-body)' }}>
                Plano ativo para comercialização imediata
              </label>
            </div>

            <button type="submit" className="mg-btn mg-btn-primary w-full mt-2">
              Salvar Plano
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <p className="text-xs font-medium" style={{ color: 'var(--mg-text-muted)' }}>Carregando planos...</p>
          ) : plans.length === 0 ? (
            <div className="mg-card p-8 text-center">
              <p className="font-bold" style={{ color: 'var(--mg-text-heading)' }}>Nenhum plano cadastrado ainda.</p>
              <p className="text-xs mt-1 font-medium" style={{ color: 'var(--mg-text-muted)' }}>Cadastre planos ao lado para que apareçam como opções de compra no portal e via WhatsApp.</p>
            </div>
          ) : (
            plans.map(plan => (
              <div key={plan.id} className="mg-card p-5 flex items-center justify-between hover:shadow-md transition-all">
                <div>
                  <h3 className="text-base font-black flex items-center gap-2" style={{ color: 'var(--mg-text-heading)' }}>
                    {plan.title}
                    <span className="mg-badge-primary text-xs font-mono font-bold">
                      ⏱ {plan.uptimeLimit || 'none'}
                    </span>
                  </h3>
                  <div className="flex gap-4 text-xs mt-1.5 font-medium" style={{ color: 'var(--mg-text-muted)' }}>
                    <span>Profile: <strong className="font-mono" style={{ color: 'var(--mg-text-body)' }}>{plan.profile}</strong></span>
                    <span>Preço: <strong className="text-emerald-600 font-extrabold text-sm">R$ {Number(plan.price).toFixed(2)}</strong></span>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => toggleActive(plan)}
                    className={`cursor-pointer transition-colors ${
                      plan.active 
                        ? 'mg-badge-success hover:opacity-90' 
                        : 'mg-badge-neutral hover:opacity-90'
                    }`}
                  >
                    {plan.active ? 'Ativo' : 'Inativo'}
                  </button>
                  <button onClick={() => deletePlan(plan.id)} className="mg-btn mg-btn-danger text-xs p-2" title="Excluir">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </main>
  );
}

