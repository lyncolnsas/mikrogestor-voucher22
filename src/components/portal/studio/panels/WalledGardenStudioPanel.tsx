"use client";

import React, { useState, useEffect } from 'react';
import { 
  Globe, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  Trash2, 
  RefreshCw, 
  Zap
} from 'lucide-react';

interface WalledGardenStudioPanelProps {
  bg: any;
  social?: any;
  onRefreshTrigger?: () => void;
}

export default function WalledGardenStudioPanel({
  bg,
}: WalledGardenStudioPanelProps) {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newHost, setNewHost] = useState('');
  const [message, setMessage] = useState('');

  // Domínios essenciais da própria plataforma MikroGestor conforme Regra 13 (Lockdown Total)
  const detectedDomains = React.useMemo(() => {
    const list: string[] = ['mikrogestor.com', 'www.mikrogestor.com'];
    if (bg?.url && bg.url.startsWith('http')) {
      try {
        const u = new URL(bg.url);
        if (!u.hostname.includes('whatsapp') && !u.hostname.includes('mercadopago')) {
          list.push(u.hostname);
        }
      } catch {}
    }
    return Array.from(new Set(list));
  }, [bg]);

  const fetchWalledGarden = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hotspot/walled-garden');
      const data = await res.json();
      if (data.success) {
        const clean = (data.entries || []).filter((e: any) => {
          const host = (e['dst-host'] || e.dstHost || '').toLowerCase();
          const comment = (e.comment || '').toLowerCase();
          return !host.includes('place hotspot rules here') && !comment.includes('place hotspot rules here');
        });
        setEntries(clean);
      }
    } catch {
      // Ignorar erro de conexão ou timeout
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      fetchWalledGarden();
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  const handleAddHost = async (hostToAdd?: string) => {
    const target = (hostToAdd || newHost).trim();
    if (!target) return;
    setAdding(true);
    setMessage('');
    try {
      const res = await fetch('/api/hotspot/walled-garden', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dstHost: target, comment: 'MikroStudio' })
      });
      const data = await res.json();
      if (data.success) {
        setMessage(`✅ "${target}" adicionado com sucesso!`);
        if (!hostToAdd) setNewHost('');
        await fetchWalledGarden();
      } else {
        setMessage(`❌ ${data.message}`);
      }
    } catch {
      setMessage('❌ Erro de rede.');
    } finally {
      setAdding(false);
    }
  };

  const handleAddAllDetected = async () => {
    setAdding(true);
    setMessage('Sincronizando domínios com o MikroTik...');
    try {
      for (const d of detectedDomains) {
        await fetch('/api/hotspot/walled-garden', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dstHost: d, comment: 'MikroStudio Auto' })
        });
      }
      setMessage('✅ Todos os domínios foram liberados no Walled Garden!');
      await fetchWalledGarden();
    } catch {
      setMessage('❌ Erro durante a sincronização.');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/hotspot/walled-garden?id=${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        await fetchWalledGarden();
      }
    } catch (err) {
      console.error('Erro ao deletar regra:', err);
    }
  };

  // Check if a domain is already allowed in router
  const isAllowed = (domain: string) => {
    const clean = domain.replace('*.', '').toLowerCase();
    return entries.some((e: any) => {
      const host = (e['dst-host'] || e.dstHost || '').toLowerCase();
      return host.includes(clean);
    });
  };

  const missingCount = detectedDomains.filter(d => !isAllowed(d)).length;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-5 select-none">
      <div>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Globe className="w-4 h-4 text-cyan-600" />
            <span>Auditoria de Walled Garden</span>
          </h3>
          <button
            type="button"
            onClick={fetchWalledGarden}
            disabled={loading}
            className="text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 cursor-pointer p-1"
            title="Atualizar"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
          Libere domínios externos no firewall do MikroTik para que logos, mapas e links do WhatsApp abram antes do login.
        </p>
      </div>

      {message && (
        <div className="p-2.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-900">
          {message}
        </div>
      )}

      {/* Auto-detected card */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100">
              Domínios Usados no Portal Atual
            </h4>
          </div>
          {missingCount > 0 && (
            <button
              type="button"
              onClick={handleAddAllDetected}
              disabled={adding}
              className="flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
            >
              <Zap className="w-3 h-3" />
              <span>Liberar Todos ({missingCount})</span>
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          {detectedDomains.map((dom) => {
            const allowed = isAllowed(dom);
            return (
              <div
                key={dom}
                className="flex items-center justify-between p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs"
              >
                <div className="flex items-center gap-2">
                  {allowed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                  <span className="font-mono text-[11px] font-semibold text-slate-900 dark:text-slate-100">{dom}</span>
                </div>

                {allowed ? (
                  <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-100 dark:bg-emerald-950/60 px-2 py-0.5 rounded">
                    Liberado
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleAddHost(dom)}
                    disabled={adding}
                    className="text-[10px] font-bold text-blue-700 dark:text-blue-300 hover:text-blue-800 bg-blue-100 dark:bg-blue-950/60 px-2 py-0.5 rounded cursor-pointer"
                  >
                    + Liberar
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Manual Input for custom domain */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2">
        <label className="text-xs font-bold text-slate-900 dark:text-slate-100">
          Adicionar Domínio Manualmente
        </label>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newHost}
            onChange={(e) => setNewHost(e.target.value)}
            placeholder="ex: *.meudominio.com.br"
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 font-mono"
          />
          <button
            type="button"
            onClick={() => handleAddHost()}
            disabled={adding || !newHost.trim()}
            className="text-xs font-bold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer disabled:opacity-50 flex items-center gap-1 shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar</span>
          </button>
        </div>
      </div>

      {/* Active Rules in MikroTik */}
      <div className="space-y-2">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
          Regras Ativas no Roteador ({entries.length})
        </h4>

        {loading ? (
          <div className="p-4 text-center text-xs text-slate-600 dark:text-slate-400">Carregando regras do MikroTik...</div>
        ) : entries.length === 0 ? (
          <div className="p-4 text-center text-xs text-slate-600 dark:text-slate-400 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl">
            Nenhuma regra cadastrada no roteador ou roteador offline.
          </div>
        ) : (
          <div className="space-y-1 max-h-52 overflow-y-auto pr-1">
            {entries.map((entry: any) => {
              const id = entry['.id'] || entry.id;
              const host = entry['dst-host'] || entry.dstHost || '*';
              const comment = entry.comment || '';

              return (
                <div
                  key={id}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs"
                >
                  <div>
                    <span className="font-mono text-[11px] font-bold text-slate-900 dark:text-slate-100">{host}</span>
                    {comment && <span className="text-[10px] text-slate-600 dark:text-slate-400 ml-2">({comment})</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(id)}
                    className="text-slate-400 hover:text-red-600 p-1 cursor-pointer"
                    title="Remover regra"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
