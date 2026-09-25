'use client';

import { useState, useEffect, useCallback } from 'react';

interface RaffleModalProps {
  onClose: () => void;
  onRaffleComplete: () => void;
}

export default function RaffleModal({ onClose, onRaffleComplete }: RaffleModalProps) {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [winner, setWinner] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  const [whatsappMsg] = useState('Parabéns [Nome]! Você acaba de ser sorteado!');

  const fetchEligibleLeads = useCallback(async () => {
    try {
      const res = await fetch('/api/leads/raffle/eligible');
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads);
      } else {
        setError(data.error || 'Erro ao carregar leads');
      }
    } catch {
      setError('Erro de conexão.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!ignore) {
        await fetchEligibleLeads();
      }
    };
    run();
    return () => { ignore = true; };
  }, [fetchEligibleLeads]);

  const executeRaffle = async () => {
    if (leads.length === 0) return;
    setIsProcessing(true);
    setError('');
    
    // Pick random
    const winnerIndex = Math.floor(Math.random() * leads.length);
    const chosenWinner = leads[winnerIndex];
    
    try {
      const parsedMsg = whatsappMsg.replace('[Nome]', chosenWinner.name || 'Cliente');
      
      const res = await fetch('/api/leads/raffle/winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          leadId: chosenWinner.id,
          phone: chosenWinner.phone,
          message: parsedMsg
        })
      });
      const data = await res.json();

      if (data.success) {
        setWinner(chosenWinner);
        onRaffleComplete();
      } else {
        setError('Erro ao processar ganhador: ' + (data.error || 'Falha no servidor'));
      }
    } catch {
      setError('Erro de conexão ao salvar ganhador.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
      <div className="relative w-full max-w-sm bg-white border border-slate-200/80 shadow-2xl rounded-2xl p-6 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200">
        
        {loading ? (
          <div className="py-8">
            <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-500 text-xs font-semibold">Carregando leads...</p>
          </div>
        ) : error ? (
          <div className="w-full">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-rose-50 text-rose-600 border border-rose-200">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
            </div>
            <h3 className="text-lg font-black mb-1.5 text-slate-900">Atenção</h3>
            <p className="text-slate-600 text-xs font-medium mb-5 leading-relaxed">{error}</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-xs cursor-pointer">
              Fechar
            </button>
          </div>
        ) : leads.length === 0 && !winner ? (
          <div className="w-full">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-slate-100 text-slate-400 border border-slate-200">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M20 12H4"></path></svg>
            </div>
            <h3 className="text-lg font-black mb-1 text-slate-900">Sem leads</h3>
            <p className="text-slate-500 text-xs font-medium mb-5 leading-relaxed">Não há leads disponíveis para sorteio no momento.</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all shadow-xs cursor-pointer">
              Fechar
            </button>
          </div>
        ) : winner ? (
          <div className="w-full">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-emerald-50 text-emerald-600 border border-emerald-200">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 className="text-lg font-black mb-1 text-emerald-800">Sorteio Concluído!</h3>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 my-4">
              <p className="text-[10px] uppercase font-bold text-emerald-700 mb-1">Ganhador Selecionado:</p>
              <p className="text-base font-extrabold text-slate-900 truncate">{winner.name || 'Sem nome'}</p>
              <p className="text-xs font-mono font-bold text-emerald-700 mt-1">{winner.phone || 'Sem número'}</p>
            </div>
            <p className="text-slate-500 text-xs mb-5 font-medium">A mensagem foi enviada via WhatsApp (se conectado).</p>
            <button onClick={onClose} className="w-full py-2.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer">
              Concluir
            </button>
          </div>
        ) : (
          <div className="w-full">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3.5 bg-blue-50 text-blue-600 border border-blue-200">
              <svg className="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            </div>
            <h3 className="text-lg font-black mb-1 text-slate-900">Sortear Lead</h3>
            <p className="text-slate-600 text-xs font-medium mb-4 leading-relaxed">
              Temos <strong className="text-slate-900 font-bold">{leads.length}</strong> leads disponíveis para o sorteio.
            </p>
            
            <div className="text-left mb-5">
              <label className="text-[11px] text-slate-700 font-bold mb-1 block">Mensagem WhatsApp:</label>
              <textarea 
                value={whatsappMsg}
                onChange={e => setWhatsappMsg(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white outline-none resize-none h-20 shadow-xs"
              />
              <p className="text-[10px] text-slate-400 mt-1">Use <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-slate-700">[Nome]</code> para o nome do ganhador.</p>
            </div>

            <div className="flex gap-2.5">
              <button onClick={onClose} disabled={isProcessing} className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 transition-all disabled:opacity-50 shadow-xs cursor-pointer">
                Cancelar
              </button>
              <button onClick={executeRaffle} disabled={isProcessing || !whatsappMsg.trim()} className="flex-1 py-2.5 rounded-xl font-bold text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-all disabled:opacity-50 flex justify-center items-center cursor-pointer">
                {isProcessing ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : 'Realizar Sorteio'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
