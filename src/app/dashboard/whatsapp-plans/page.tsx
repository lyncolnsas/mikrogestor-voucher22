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
    <div className="p-4 md:p-6 space-y-6 text-slate-800 dark:text-slate-200">
      <div className="flex justify-between items-center pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800/60 px-2 py-0.5 rounded tracking-wider uppercase">
              Catálogo de Vendas (PIX)
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Catálogo de Planos Hotspot</h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium mt-1">Configure os planos e durações disponíveis para compra no portal e via WhatsApp.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form */}
        <div className="bg-white dark:bg-[#111726] rounded-2xl p-6 border border-slate-200/80 dark:border-slate-800 shadow-sm h-fit">
          <h2 className="text-base font-black text-slate-900 dark:text-white mb-4">Adicionar Novo Plano</h2>
          <form onSubmit={addPlan} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome de Exibição (Visível ao cliente)</label>
              <input 
                required 
                type="text" 
                value={title} 
                onChange={e => setTitle(e.target.value)} 
                placeholder="Ex: 24 Horas Turbo, 1 Dia de Acesso"
                className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs font-medium focus:border-blue-600 focus:bg-white dark:focus:bg-[#0e1524] outline-none shadow-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome do Profile (Exato no MikroTik)</label>
              <input 
                required 
                type="text" 
                value={profile} 
                onChange={e => setProfile(e.target.value)} 
                placeholder="Ex: default, 1_Dia_10M, plano_vip"
                className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 text-xs font-medium focus:border-blue-600 focus:bg-white dark:focus:bg-[#0e1524] outline-none shadow-sm" 
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Preço R$ (Valor cobrado no PIX)</label>
              <input 
                required 
                type="number" 
                step="0.01" 
                value={price} 
                onChange={e => setPrice(e.target.value)} 
                className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-slate-100 text-xs font-bold focus:border-blue-600 focus:bg-white dark:focus:bg-[#0e1524] outline-none shadow-sm" 
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Duração / Limite de Tempo (`limit-uptime`)</label>
              <input 
                type="text" 
                value={uptimeLimit} 
                onChange={e => setUptimeLimit(e.target.value)} 
                placeholder="Ex: 01:00:00 ou 1d 00:00:00"
                className="w-full bg-slate-50 dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-slate-900 dark:text-slate-100 text-xs font-mono focus:border-blue-600 focus:bg-white dark:focus:bg-[#0e1524] outline-none mb-2 shadow-sm" 
              />
              <div className="flex flex-wrap gap-1.5">
                {presets.map(p => (
                  <button
                    key={p.val}
                    type="button"
                    onClick={() => setUptimeLimit(p.val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-colors ${
                      uptimeLimit === p.val 
                        ? 'bg-blue-600 text-white font-bold shadow-xs' 
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 font-semibold'
                    }`}
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
                className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <label htmlFor="plan-active-check" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Plano ativo para comercialização imediata
              </label>
            </div>

            <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl transition-colors mt-2 shadow-sm text-xs cursor-pointer">
              Salvar Plano
            </button>
          </form>
        </div>

        {/* List */}
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Carregando planos...</p>
          ) : plans.length === 0 ? (
            <div className="bg-white dark:bg-[#111726] rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-800 shadow-sm">
              <p className="text-slate-800 dark:text-slate-200 font-bold">Nenhum plano cadastrado ainda.</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-medium">Cadastre planos ao lado para que apareçam como opções de compra no portal e via WhatsApp.</p>
            </div>
          ) : (
            plans.map(plan => (
              <div key={plan.id} className="bg-white dark:bg-[#111726] rounded-2xl p-5 border border-slate-200/80 dark:border-slate-800 shadow-sm flex items-center justify-between hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
                    {plan.title}
                    <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 font-mono font-bold">
                      ⏱ {plan.uptimeLimit || 'none'}
                    </span>
                  </h3>
                  <div className="flex gap-4 text-xs text-slate-600 dark:text-slate-400 mt-1.5 font-medium">
                    <span>Profile: <strong className="text-slate-900 dark:text-slate-200 font-mono">{plan.profile}</strong></span>
                    <span>Preço: <strong className="text-emerald-700 dark:text-emerald-400 font-extrabold text-sm">R$ {Number(plan.price).toFixed(2)}</strong></span>
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
                  <button onClick={() => deletePlan(plan.id)} className="mg-btn-danger text-xs p-2 rounded-lg font-bold" title="Excluir">
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
    </div>
  );
}
