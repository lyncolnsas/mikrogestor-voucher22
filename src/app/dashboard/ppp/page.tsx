"use client";

import { useEffect, useState } from 'react';
import RouterOffline from '@/components/RouterOffline';

export default function PPPoESecrets() {
  const [secrets, setSecrets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    const fetchSecrets = async () => {
      try {
        const res = await fetch('/api/ppp');
        if (res.status === 401) {
          setNotConnected(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.success) {
          setSecrets(data.data);
          setNotConnected(false);
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchSecrets();
  }, []);

  if (notConnected) {
    return (
      <RouterOffline 
        title="PPP / PPPoE Secrets" 
        description="Gerencie os usuários PPPoE conectados" 
      />
    );
  }

  return (
    <main className="w-full p-4 md:p-6 space-y-6 animate-fade-in text-slate-800 dark:text-slate-200">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800/80 px-2 py-0.5 rounded tracking-wider uppercase">
            Interfaces // Base de Usuários PPPoE
          </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
            PPPoE Secrets
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 font-medium mt-0.5">
            Gerenciamento de usuários e credenciais PPPoE no MikroTik
          </p>
        </div>
      </header>

      {/* Main Table Card */}
      <div className="mg-card overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--mg-card-border-subtle)] bg-[var(--mg-card-bg-subtle)] flex justify-between items-center">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: 'var(--mg-text-heading)' }}>Usuários PPPoE</h2>
            <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>Clientes cadastrados no servidor de túneis PPPoE</p>
          </div>
          <span className="mg-badge-info uppercase tracking-wider">
            {secrets.length} SECRETS
          </span>
        </div>

        {/* Table */}
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-6 py-3.5">Nome (Usuário)</th>
                  <th className="px-6 py-3.5">Serviço</th>
                  <th className="px-6 py-3.5">Perfil (Profile)</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 bg-white dark:bg-[#111726]">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 italic font-medium">
                      <div className="inline-block animate-pulse">Consultando registros PPP no roteador...</div>
                    </td>
                  </tr>
                ) : secrets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400 italic font-medium">
                      Nenhum usuário PPPoE encontrado na base ativa.
                    </td>
                  </tr>
                ) : (
                  secrets.map((secret, index) => (
                    <tr key={`${secret.id || secret.name}-${index}`} className="hover:bg-slate-50/80 dark:hover:bg-slate-800/50 transition-colors">
                      <td className="px-6 py-4 font-bold text-slate-900 dark:text-white text-sm font-sans">{secret.name}</td>
                      <td className="px-6 py-4 text-slate-600 dark:text-slate-400 uppercase text-xs font-mono">{secret.service}</td>
                      <td className="px-6 py-4 font-bold text-blue-600 dark:text-blue-400 font-sans">{secret.profile}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={secret.disabled ? 'mg-badge-danger' : 'mg-badge-success'}>
                          {secret.disabled ? 'DESATIVADO' : 'ATIVO'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </main>
  );
}
