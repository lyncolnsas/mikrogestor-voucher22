"use client";

import { useEffect, useState } from 'react';
import RouterOffline from '@/components/RouterOffline';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    value: number;
    payload: {
      time: string;
      rx: number;
      tx: number;
    };
  }>;
}

const formatBps = (bits: number) => {
  if (bits >= 1000000) return (bits / 1000000).toFixed(2) + ' Mbps';
  if (bits >= 1000) return (bits / 1000).toFixed(2) + ' kbps';
  return bits + ' bps';
};

const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (active && payload && payload.length) {
    const rxVal = payload[0]?.value ?? 0;
    const txVal = payload[1]?.value ?? 0;
    const timeLabel = payload[0]?.payload?.time ?? '';
    return (
      <div className="bg-white dark:bg-[#111726] border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-lg text-xs space-y-1.5 min-w-[160px]">
        <p className="font-extrabold text-slate-900 dark:text-slate-100 border-b border-slate-100 dark:border-slate-800 pb-1">{timeLabel}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block"></span>
            <span>Download (RX):</span>
          </span>
          <strong className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">{formatBps(rxVal)}</strong>
        </div>
        <div className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
            <span>Upload (TX):</span>
          </span>
          <strong className="text-blue-600 dark:text-blue-400 font-bold font-mono">{formatBps(txVal)}</strong>
        </div>
      </div>
    );
  }
  return null;
};

export default function TrafficMonitor() {
  const [interfaces, setInterfaces] = useState<{ id?: string; name: string; type: string }[]>([]);
  const [selectedIface, setSelectedIface] = useState('');
  const [trafficData, setTrafficData] = useState<{tx: number, rx: number} | null>(null);
  const [history, setHistory] = useState<{time: string, rx: number, tx: number}[]>([]);
  const [notConnected, setNotConnected] = useState(false);
  const [peakRx, setPeakRx] = useState(0);
  const [peakTx, setPeakTx] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    let ignore = false;
    const fetchInterfaces = async () => {
      try {
        const res = await fetch('/api/traffic');
        if (res.status === 401) {
          if (!ignore) setNotConnected(true);
          return;
        }
        const data = await res.json();
        if (data.success && data.type === 'interfaces' && !ignore) {
          setInterfaces(data.data);
          if (data.data.length > 0) setSelectedIface(data.data[0].name);
          setNotConnected(false);
        }
      } catch {
        // Ignorar erros na listagem inicial
      } finally {
        if (!ignore) setMounted(true);
      }
    };
    fetchInterfaces();
    return () => { ignore = true; };
  }, []);

  useEffect(() => {
    if (!selectedIface) return;
    
    const fetchTraffic = async () => {
      try {
        const res = await fetch(`/api/traffic?interface=${encodeURIComponent(selectedIface)}`);
        const data = await res.json();
        if (data.success && data.type === 'traffic') {
          const currentRx = Number(data.rx || 0);
          const currentTx = Number(data.tx || 0);

          setTrafficData({ tx: currentTx, rx: currentRx });
          
          setPeakRx(prev => Math.max(prev, currentRx));
          setPeakTx(prev => Math.max(prev, currentTx));

          setHistory(prev => {
            const timeLabel = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const newHistory = [...prev, { time: timeLabel, rx: currentRx, tx: currentTx }];
            if (newHistory.length > 30) newHistory.shift();
            return newHistory;
          });
        }
      } catch {
        // Ignorar erros de polling
      }
    };

    fetchTraffic();
    const interval = setInterval(fetchTraffic, 2000); // 2 seconds poll
    return () => clearInterval(interval);
  }, [selectedIface]);

  const formatYAxis = (tick: number) => {
    if (tick >= 1000000) return (tick / 1000000).toFixed(1) + ' M';
    if (tick >= 1000) return (tick / 1000).toFixed(0) + ' k';
    return tick + ' b';
  };

  if (notConnected) {
    return (
      <RouterOffline 
        title="Monitor de Tráfego Real-Time" 
        description="Acompanhe o consumo de banda ao vivo de qualquer interface" 
      />
    );
  }
  return (
    <main className="w-full p-4 md:p-6 max-w-6xl mx-auto space-y-6 animate-fade-in text-slate-800">
      {/* Page Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800/60 px-2 py-0.5 rounded tracking-wider uppercase">
              Diagnóstico de Rede em Tempo Real
            </span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-slate-900">
            Monitor de Tráfego
          </h1>
          <p className="text-xs md:text-sm text-slate-600 font-medium mt-0.5">
            Monitoramento em tempo real de interfaces e consumo de banda do MikroTik
          </p>
        </div>

        <div className="flex items-center gap-3 self-start sm:self-auto">
          <div className="text-left md:text-right">
            <span className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
              INTERFACE DE REDE
            </span>
            <select 
              value={selectedIface} 
              onChange={(e) => {
                const val = e.target.value;
                setSelectedIface(val);
                setPeakRx(0);
                setPeakTx(0);
                setHistory([]);
              }} 
              className="w-full bg-white dark:bg-[#0e1524] border border-slate-300 dark:border-slate-700 focus:border-blue-600 rounded-xl py-2 px-3 text-xs font-bold text-slate-800 dark:text-slate-100 outline-none shadow-sm min-w-[200px]"
            >
              {interfaces.map((i, idx) => (
                <option key={`${i.id || i.name}-${idx}`} value={i.name}>
                  {i.name} ({i.type})
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Speed Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* RX Card (Download) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#161e31] flex items-center justify-between">
            <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">DOWNLOAD (RX)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="p-6 space-y-4">
            <div className="p-5 text-center bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="block text-[11px] text-slate-700 font-black uppercase tracking-wider mb-1">CONSUMO ATUAL</span>
              <p className="text-3xl md:text-4xl font-black tracking-tight text-emerald-600 dark:text-emerald-400 font-mono">
                {trafficData ? formatBps(trafficData.rx) : '0.00 bps'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl text-center shadow-xs">
                <span className="block text-[11px] text-slate-700 font-black uppercase tracking-wider mb-1">Pico RX</span>
                <span className="text-sm font-black text-slate-950 font-mono">{formatBps(peakRx)}</span>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl text-center shadow-xs">
                <span className="block text-[11px] text-slate-700 font-black uppercase tracking-wider mb-1">Status do Link</span>
                <span className="text-xs font-black uppercase text-emerald-700 dark:text-emerald-400 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block animate-pulse"></span>
                  CONECTADO
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TX Card (Upload) */}
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#161e31] flex items-center justify-between">
            <span className="text-xs font-black text-blue-700 dark:text-blue-400 uppercase tracking-wider">UPLOAD (TX)</span>
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-pulse" />
          </div>
          <div className="p-6 space-y-4">
            <div className="p-5 text-center bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-2xl">
              <span className="block text-[11px] text-slate-700 font-black uppercase tracking-wider mb-1">CONSUMO ATUAL</span>
              <p className="text-3xl md:text-4xl font-black tracking-tight text-blue-600 dark:text-blue-400 font-mono">
                {trafficData ? formatBps(trafficData.tx) : '0.00 bps'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl text-center shadow-xs">
                <span className="block text-[11px] text-slate-700 font-black uppercase tracking-wider mb-1">Pico TX</span>
                <span className="text-sm font-black text-slate-950 font-mono">{formatBps(peakTx)}</span>
              </div>
              <div className="p-4 bg-white dark:bg-slate-900/50 border border-slate-300 dark:border-slate-800 rounded-xl text-center shadow-xs">
                <span className="block text-[11px] text-slate-700 font-black uppercase tracking-wider mb-1">Status do Link</span>
                <span className="text-xs font-black uppercase text-blue-700 dark:text-blue-400 flex items-center justify-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500 inline-block animate-pulse"></span>
                  ATIVO
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Recharts Traffic Plot Container */}
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-[#161e31]">
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Gráfico de Consumo em Tempo Real</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-0.5">Amostragem a cada 2 segundos</p>
          </div>
          <div className="flex gap-4 text-xs font-bold">
            <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Download (RX)
            </span>
            <span className="flex items-center gap-1.5 text-blue-700 dark:text-blue-400">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block"></span>
              Upload (TX)
            </span>
          </div>
        </div>


        {/* Display Plot */}
        <div className="p-6">
          <div className="h-80 w-full relative">
            {mounted && history.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%" minWidth={1} minHeight={1}>
                <AreaChart data={history} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="colorTx" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#cbd5e1" />
                  <XAxis 
                    dataKey="time" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tickFormatter={formatYAxis}
                    tick={{ fill: '#334155', fontSize: 12, fontWeight: 700 }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area 
                    type="monotone" 
                    dataKey="rx" 
                    stroke="#10b981" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorRx)" 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="tx" 
                    stroke="#3b82f6" 
                    strokeWidth={2.5}
                    fillOpacity={1} 
                    fill="url(#colorTx)" 
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : !mounted ? (
              <div className="h-full w-full" />
            ) : (
              <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 font-medium">
                <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-blue-600 mb-3"></div>
                Aguardando leitura dos dados de tráfego...
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
