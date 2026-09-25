"use client";

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export default function PrintVouchers() {
  const [data] = useState<{users: any[], profile: string, comment: string} | null>(() => {
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem('mikro_vouchers_print');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch {}
      }
    }
    return null;
  });
  const [theme, setTheme] = useState('classic'); // classic, minimalist, dark, gamer

  if (!data) {
    return <div className="p-8 text-center text-slate-700 font-semibold">Nenhum voucher encontrado para impressão.</div>;
  }

  // Hotspot Auto-Login URL Format
  const getQrUrl = (u: string, p: string) => `http://hotspot.wifi.local/login?username=${u}&password=${p}`;

  const renderVoucher = (user: any, idx: number) => {
    if (theme === 'classic') {
      return (
        <div key={idx} className="voucher-card border-2 border-slate-800 rounded-lg p-3 relative flex flex-col bg-white text-slate-900">
          <div className="flex justify-between items-start border-b border-slate-300 pb-2 mb-2">
            <div>
              <h2 className="font-black text-xs tracking-tight uppercase leading-none text-slate-950">Wi-Fi Acesso</h2>
              <p className="text-[10px] text-slate-800 font-black mt-1">{data.profile}</p>
            </div>
            <div className="bg-white p-1 rounded border border-slate-300 shrink-0">
              <QRCodeSVG value={getQrUrl(user.name, user.pass)} size={36} />
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center space-y-1.5 mb-2">
            <div className="bg-slate-100 p-1.5 rounded text-center border border-slate-200">
              <span className="block text-[8px] uppercase text-slate-700 font-black tracking-wider">Usuário</span>
              <span className="block font-mono font-black text-sm leading-none text-slate-950 mt-0.5">{user.name}</span>
            </div>
            {user.name !== user.pass && (
              <div className="bg-slate-100 p-1.5 rounded text-center border border-slate-200">
                <span className="block text-[8px] uppercase text-slate-700 font-black tracking-wider">Senha</span>
                <span className="block font-mono font-black text-sm leading-none text-slate-950 mt-0.5">{user.pass}</span>
              </div>
            )}
          </div>
          <div className="text-center mt-auto flex justify-between items-center text-[8px] text-slate-700 font-bold">
            <span>Escaneie para conectar</span>
            <span>Lote: {data.comment}</span>
          </div>
        </div>
      );
    }

    if (theme === 'minimalist') {
      return (
        <div key={idx} className="voucher-card border-b border-slate-300 p-3 relative flex items-center justify-between bg-white text-slate-900">
          <div>
            <h2 className="font-black text-sm tracking-tight uppercase text-slate-950 leading-none">WIFI {data.profile}</h2>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-700">Login:</span>
              <span className="font-mono font-black text-base text-slate-950">{user.name}</span>
            </div>
            {user.name !== user.pass && (
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-700">Senha:</span>
                <span className="font-mono font-black text-base text-slate-950">{user.pass}</span>
              </div>
            )}
          </div>
          <div className="shrink-0">
            <QRCodeSVG value={getQrUrl(user.name, user.pass)} size={48} />
          </div>
        </div>
      );
    }

    if (theme === 'dark') {
      return (
        <div key={idx} className="voucher-card voucher-card-dark border-2 border-slate-700 bg-slate-950 rounded-lg p-3 relative flex flex-col text-white">
          <div className="flex justify-between items-start border-b border-slate-800 pb-2 mb-2">
            <div>
              <h2 className="font-black text-xs tracking-tight uppercase leading-none text-blue-400">PREMIUM WI-FI</h2>
              <p className="text-[10px] text-slate-200 font-black mt-1">{data.profile}</p>
            </div>
            <div className="bg-white p-1 rounded shrink-0 shadow-sm">
              <QRCodeSVG value={getQrUrl(user.name, user.pass)} size={36} />
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center space-y-1.5 mb-2">
            <div className="bg-slate-900 p-1.5 rounded text-center border border-slate-800">
              <span className="block text-[8px] uppercase text-slate-300 font-black tracking-wider">Usuário</span>
              <span className="block font-mono font-black text-sm leading-none text-white mt-0.5">{user.name}</span>
            </div>
            {user.name !== user.pass && (
              <div className="bg-slate-900 p-1.5 rounded text-center border border-slate-800">
                <span className="block text-[8px] uppercase text-slate-300 font-black tracking-wider">Senha</span>
                <span className="block font-mono font-black text-sm leading-none text-white mt-0.5">{user.pass}</span>
              </div>
            )}
          </div>
          <div className="text-center mt-auto flex justify-between items-center text-[8px] text-slate-300 font-bold">
            <span>Escaneie para conectar</span>
            <span>Lote: {data.comment}</span>
          </div>
        </div>
      );
    }

    if (theme === 'gamer') {
      return (
        <div key={idx} className="voucher-card voucher-card-gamer border-2 border-purple-500 bg-black rounded-lg p-3 relative flex flex-col text-white shadow-[0_0_12px_rgba(168,85,247,0.25)]">
          <div className="flex justify-between items-start pb-2 border-b border-purple-900/35 mb-2">
            <div>
              <h2 className="font-black italic text-xs tracking-tight uppercase leading-none text-purple-400">GAMER PASS</h2>
              <p className="text-[10px] text-fuchsia-300 font-bold mt-1">{data.profile}</p>
            </div>
            <div className="bg-white p-1 rounded shrink-0 shadow-[0_0_8px_rgba(255,255,255,0.4)]">
              <QRCodeSVG value={getQrUrl(user.name, user.pass)} size={36} />
            </div>
          </div>
          <div className="flex-1 flex flex-col justify-center space-y-1.5 mb-2 mt-1">
            <div className="bg-slate-900 px-2 py-1 rounded border-l-4 border-purple-500 flex justify-between items-center text-xs">
              <span className="text-[8px] uppercase text-slate-400 font-black tracking-wider">Code</span>
              <span className="font-mono font-bold text-purple-300">{user.name}</span>
            </div>
            {user.name !== user.pass && (
              <div className="bg-slate-900 px-2 py-1 rounded border-l-4 border-fuchsia-500 flex justify-between items-center text-xs">
                <span className="text-[8px] uppercase text-slate-400 font-black tracking-wider">Pass</span>
                <span className="font-mono font-bold text-fuchsia-300">{user.pass}</span>
              </div>
            )}
          </div>
          <div className="text-center mt-auto text-[8px] text-slate-500 font-black tracking-widest uppercase">
            Scan to Play
          </div>
        </div>
      );
    }
  };

  return (
    <div className="bg-slate-100 min-h-screen text-black w-full print:bg-white" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
      {/* Bulletproof A4 print alignments style injection */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          body {
            background: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          @page {
            size: A4;
            margin: 10mm 12mm 12mm 12mm; /* Ideal print margins for A4 */
          }
          .print-grid {
            display: grid !important;
            grid-template-columns: repeat(3, 1fr) !important; /* Perfect 3-column fit on A4, zero clipping */
            gap: 12px !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .print-list {
            display: flex !important;
            flex-direction: column !important;
            gap: 10px !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .voucher-card {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            overflow: hidden !important;
            box-shadow: none !important;
            border: 1.5px solid #334155 !important;
            background-color: white !important;
            color: black !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .voucher-card-dark {
            background-color: #0c111d !important;
            color: white !important;
            border: 1.5px solid #475569 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .voucher-card-gamer {
            background-color: #000000 !important;
            color: white !important;
            border: 2px solid #a855f7 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* Hide controls when printing */}
      <div className="print:hidden p-4 bg-white border-b border-slate-200 text-slate-900 flex flex-col md:flex-row justify-between items-center mb-8 shadow-sm sticky top-0 z-50">
        <div className="mb-4 md:mb-0">
          <h1 className="font-extrabold text-base text-slate-900">Visualização de Impressão</h1>
          <p className="text-xs text-slate-500 mt-0.5">Selecione o modelo do voucher e clique em imprimir.</p>
        </div>
        
        <div className="flex flex-wrap gap-3 items-center justify-center">
          <div className="flex bg-slate-100 rounded-xl p-1 border border-slate-200">
            <button onClick={() => setTheme('classic')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${theme === 'classic' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>Clássico</button>
            <button onClick={() => setTheme('minimalist')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${theme === 'minimalist' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>Minimalista</button>
            <button onClick={() => setTheme('dark')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${theme === 'dark' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>Escuro</button>
            <button onClick={() => setTheme('gamer')} className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${theme === 'gamer' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}>Gamer</button>
          </div>
          
          <div className="w-px h-6 bg-slate-200 hidden sm:block"></div>

          <button onClick={() => window.close()} className="px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded-xl text-xs transition-all shadow-xs cursor-pointer">Fechar</button>
          <button onClick={() => window.print()} className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition-all shadow-xs flex items-center gap-1.5 cursor-pointer">
            <span>🖨️</span>
            <span>Imprimir ({data.users.length})</span>
          </button>
        </div>
      </div>

      {/* Grid of Vouchers for Printing */}
      <div className={`
        p-6 print:p-0 mx-auto
        ${theme === 'minimalist' ? 'flex flex-col max-w-2xl print-list' : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 print:gap-2 print-grid'}
      `}>
        {data.users.map((user, idx) => renderVoucher(user, idx))}
      </div>
    </div>
  );
}
