"use client";

import { useEffect, useState } from 'react';
import RouterOffline from '@/components/RouterOffline';

export default function DHCPLeases() {
  const [leases, setLeases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [notConnected, setNotConnected] = useState(false);

  useEffect(() => {
    const fetchLeases = async () => {
      try {
        const res = await fetch('/api/dhcp');
        if (res.status === 401) {
          setNotConnected(true);
          setLoading(false);
          return;
        }
        const data = await res.json();
        if (data.success) {
          setLeases(data.data);
          setNotConnected(false);
        }
      } catch {} finally {
        setLoading(false);
      }
    };
    fetchLeases();
  }, []);

  if (notConnected) {
    return (
      <RouterOffline 
        title="DHCP Leases" 
        description="Dispositivos conectados na rede local" 
      />
    );
  }

  return (
    <main className="w-full p-4 md:p-6 space-y-6 animate-fade-in text-slate-800">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800/60 px-2 py-0.5 rounded tracking-wider uppercase">
              Rede Local // Concessões DHCP
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            DHCP Leases
          </h1>
          <p className="text-xs md:text-sm text-slate-600 font-medium mt-0.5">
            Concessões DHCP ativas e mapeamento de endereços IP na rede local
          </p>
        </div>
      </header>

      {/* Main Table Card */}
      <div className="mg-card overflow-hidden">
        <div className="px-6 py-5 border-b border-[var(--mg-card-border-subtle)] bg-[var(--mg-card-bg-subtle)] flex justify-between items-center">
          <div>
            <h2 className="text-sm font-extrabold uppercase tracking-wider" style={{ color: 'var(--mg-text-heading)' }}>Dispositivos Conectados</h2>
            <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--mg-text-muted)' }}>Clientes identificados com IPs concedidos via DHCP</p>
          </div>
          <span className="mg-badge-warning uppercase tracking-wider">
            {leases.length} LEASES
          </span>
        </div>

        {/* Table */}
        <div className="p-4">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                  <th className="px-6 py-3.5">Endereço IP</th>
                  <th className="px-6 py-3.5">MAC Address</th>
                  <th className="px-6 py-3.5">Host Name</th>
                  <th className="px-6 py-3.5">Servidor</th>
                  <th className="px-6 py-3.5 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-[#111726]">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic font-medium">
                      <div className="inline-block animate-pulse">Lendo leases ativas no pool DHCP do roteador...</div>
                    </td>
                  </tr>
                ) : leases.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-slate-500 italic font-medium">
                      Nenhum dispositivo com lease DHCP registrada na rede.
                    </td>
                  </tr>
                ) : (
                  leases.map((lease, index) => (
                    <tr key={`${lease.id || lease.address}-${index}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-6 py-4 font-bold text-blue-600 text-sm tracking-wide font-mono">{lease.address}</td>
                      <td className="px-6 py-4 text-slate-600 font-mono uppercase text-xs">{lease.mac}</td>
                      <td className="px-6 py-4 font-bold text-slate-900">{lease.hostName || <span className="text-slate-400 italic">sem hostname</span>}</td>
                      <td className="px-6 py-4 text-slate-600 font-medium">{lease.server}</td>
                      <td className="px-6 py-4 text-right">
                        <span className={lease.status === 'bound' ? 'mg-badge-success' : 'mg-badge-warning'}>
                          {lease.status.toUpperCase()}
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
