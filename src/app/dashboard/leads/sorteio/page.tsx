'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { 
  ArrowLeft, 
  Sparkles, 
  Send, 
  CheckCircle2, 
  AlertCircle, 
  Settings2, 
  ExternalLink, 
  MessageSquare,
  Users,
  Trophy,
  ChevronDown,
  Edit3
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  phone?: string | null;
  whatsappNumber?: string | null;
  avatarUrl?: string | null;
  hotspotUser: string;
  createdAt: string;
  drawnInRaffle: boolean;
}

export default function SorteadorPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Sorteio Config
  const [raffleTitle, setRaffleTitle] = useState('Sorteio Especial Hotspot Wi-Fi');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [onlyUndrawn, setOnlyUndrawn] = useState(true);
  const [showOptions, setShowOptions] = useState(false);
  const [resettingRaffle, setResettingRaffle] = useState(false);
  
  // Execution state
  const [isRolling, setIsRolling] = useState(false);
  const [rollingCandidate, setRollingCandidate] = useState<Lead | null>(null);
  const [winner, setWinner] = useState<Lead | null>(null);
  const [winnerHistory, setWinnerHistory] = useState<Lead[]>([]);
  
  // WhatsApp Message config
  const [whatsappMsg, setWhatsappMsg] = useState(
    '🎉 Parabéns [Nome]! Você acaba de ser sorteado(a) na nossa promoção da Rede Wi-Fi! 🚀\n\nMostre esta mensagem no balcão para resgatar seu prêmio!'
  );
  const [sendingMsg, setSendingMsg] = useState(false);
  const [msgStatus, setMsgStatus] = useState<{ success?: boolean; error?: string } | null>(null);

  // Canvas ref for Confetti
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Fetch leads
  const fetchEligibleLeads = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const res = await fetch(`/api/leads/raffle/eligible?includeDrawn=${!onlyUndrawn}`);
      const data = await res.json();
      if (data.success) {
        setLeads(data.leads || []);
      } else {
        setError(data.error || 'Erro ao carregar participantes.');
      }
    } catch {
      setError('Falha de conexão com o servidor.');
    } finally {
      setLoading(false);
    }
  }, [onlyUndrawn]);

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

  // Confetti Particle System
  const triggerConfetti = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const confettiPieces: Array<{
      x: number;
      y: number;
      size: number;
      color: string;
      speedX: number;
      speedY: number;
      rotation: number;
      rotationSpeed: number;
      opacity: number;
    }> = [];

    const colors = ['#ef4444', '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];

    for (let i = 0; i < 150; i++) {
      confettiPieces.push({
        x: canvas.width / 2 + (Math.random() - 0.5) * 200,
        y: canvas.height / 2 - 100,
        size: Math.random() * 8 + 4,
        color: colors[Math.floor(Math.random() * colors.length)],
        speedX: (Math.random() - 0.5) * 16,
        speedY: (Math.random() - 0.8) * 18,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10,
        opacity: 1
      });
    }

    const startTime = Date.now();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      confettiPieces.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.35; // gravity
        p.rotation += p.rotationSpeed;
        if (elapsed > 2000) {
          p.opacity = Math.max(0, p.opacity - 0.02);
        }

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (elapsed < 4000) {
        requestAnimationFrame(animate);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };

    animate();
  };

  // Execute Draw with Suspense Animation
  const startRaffle = () => {
    if (leads.length === 0) {
      alert('Não há participantes disponíveis para o sorteio no momento.');
      return;
    }

    setWinner(null);
    setMsgStatus(null);
    setIsRolling(true);

    const pool = [...leads];
    let counter = 0;
    const totalRolls = 35;
    let speed = 40;

    const rollStep = () => {
      const rand = pool[Math.floor(Math.random() * pool.length)];
      setRollingCandidate(rand);
      counter++;

      if (counter < totalRolls) {
        speed += 6; // slow down gradually for suspense
        setTimeout(rollStep, speed);
      } else {
        // Finalize winner
        const chosenWinner = pool[Math.floor(Math.random() * pool.length)];
        finalizeWinner(chosenWinner);
      }
    };

    rollStep();
  };

  // Finalize winner with API
  const finalizeWinner = async (chosen: Lead) => {
    try {
      const res = await fetch('/api/leads/raffle/winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: chosen.id,
          message: whatsappMsg,
          sendMessage: false, // User clicks button to send message
          markAsDrawn: true
        })
      });

      const data = await res.json();
      if (data.success && data.lead) {
        setWinner(data.lead);
        setWinnerHistory(prev => [data.lead, ...prev]);
        triggerConfetti();
      } else {
        setWinner(chosen);
        triggerConfetti();
      }
    } catch {
      setWinner(chosen);
      triggerConfetti();
    } finally {
      setIsRolling(false);
      setRollingCandidate(null);
      fetchEligibleLeads();
    }
  };

  // Send WhatsApp Message to Winner
  const handleSendMessage = async () => {
    if (!winner) return;
    const phone = winner.whatsappNumber || winner.phone;
    if (!phone) {
      alert('O ganhador não possui número de telefone cadastrado.');
      return;
    }

    setSendingMsg(true);
    setMsgStatus(null);

    try {
      const res = await fetch('/api/leads/raffle/winner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadId: winner.id,
          message: whatsappMsg,
          sendMessage: true,
          markAsDrawn: true
        })
      });

      const data = await res.json();
      if (data.success && data.messageSent) {
        setMsgStatus({ success: true });
      } else {
        setMsgStatus({ 
          success: false, 
          error: data.messageError || 'Instância do WhatsApp não está conectada no momento.' 
        });
      }
    } catch {
      setMsgStatus({ success: false, error: 'Falha de comunicação ao disparar mensagem.' });
    } finally {
      setSendingMsg(false);
    }
  };

  // Reset all drawn leads
  const handleResetRaffle = async () => {
    if (!confirm('Deseja zerar o histórico de sorteios? Todos os participantes poderão ser sorteados novamente.')) return;
    setResettingRaffle(true);
    try {
      const res = await fetch('/api/leads/raffle/reset', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        alert(`Histórico de sorteios zerado com sucesso! ${data.count} participantes disponíveis.`);
        setWinner(null);
        setWinnerHistory([]);
        fetchEligibleLeads();
      }
    } catch {
      alert('Erro ao zerar histórico de sorteios.');
    } finally {
      setResettingRaffle(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans select-none">
      
      {/* Canvas for Confetti */}
      <canvas 
        ref={canvasRef} 
        className="fixed inset-0 pointer-events-none z-50 w-full h-full"
      />

      {/* ── Background Abstract Vector Curves (Matching Nexus DRAW style) ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
        {/* Left Blue Sweeps */}
        <div 
          className="absolute -top-24 -left-48 w-[600px] h-[750px] rounded-full opacity-60 filter blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(2,132,199,0.35) 0%, rgba(59,130,246,0.15) 50%, transparent 70%)'
          }}
        />
        <svg 
          className="absolute -bottom-32 -left-20 w-[600px] h-[600px] opacity-40 text-blue-600/20" 
          viewBox="0 0 500 500" 
          fill="none"
        >
          <path d="M0,100 C150,200 350,0 500,100 L500,00 L0,0 Z" fill="currentColor" />
          <path d="M-50,200 C100,350 250,50 450,250 C500,300 550,450 600,500 L0,500 Z" fill="currentColor" opacity="0.3" />
        </svg>

        {/* Right Red/Coral Sweeps */}
        <div 
          className="absolute -top-32 -right-32 w-[650px] h-[750px] rounded-full opacity-60 filter blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(239,68,68,0.25) 0%, rgba(244,63,94,0.12) 50%, transparent 70%)'
          }}
        />
        <svg 
          className="absolute -top-12 -right-12 w-[550px] h-[550px] opacity-35 text-red-500/15" 
          viewBox="0 0 500 500" 
          fill="none"
        >
          <path d="M100,0 C300,50 450,250 500,500 L500,0 Z" fill="currentColor" />
        </svg>

        {/* Floating Geometric Dots Accent */}
        <div className="absolute bottom-20 left-16 opacity-30 hidden md:block">
          <div className="grid grid-cols-5 gap-3">
            {[...Array(20)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            ))}
          </div>
        </div>
        <div className="absolute top-28 right-24 opacity-30 hidden md:block">
          <div className="grid grid-cols-4 gap-3">
            {[...Array(12)].map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full bg-red-400" />
            ))}
          </div>
        </div>
      </div>

      {/* ── Top Bar / Header ── */}
      <header className="relative z-10 w-full px-6 py-4 flex items-center justify-between border-b border-slate-200/60 bg-white/70 backdrop-blur-md">
        <Link 
          href="/dashboard/leads"
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-slate-700 bg-white/90 hover:bg-slate-100 border border-slate-200 shadow-xs transition-all cursor-pointer group"
        >
          <ArrowLeft className="w-4 h-4 text-slate-500 group-hover:-translate-x-0.5 transition-transform" />
          <span>Voltar para o Painel</span>
        </Link>

        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-bold text-slate-600 uppercase tracking-widest hidden sm:inline">
            Sorteador Oficial // Hotspot
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 shadow-xs">
            👥 {leads.length} apto(s)
          </span>
        </div>
      </header>

      {/* ── Main Stage ── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center p-4 sm:p-8 max-w-4xl mx-auto w-full">
        
        {/* Brand Logo & Name (Matching Nexus DRAW style) */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="flex items-center gap-3 mb-2">
            {/* Atom / Ring SVG Icon */}
            <div className="relative w-12 h-12 flex items-center justify-center text-blue-600">
              <svg className="w-12 h-12 drop-shadow-md" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Ellipse orbit 1 */}
                <ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(-30 32 32)" stroke="#1e293b" strokeWidth="3" opacity="0.85" />
                {/* Ellipse orbit 2 */}
                <ellipse cx="32" cy="32" rx="28" ry="11" transform="rotate(30 32 32)" stroke="#2563eb" strokeWidth="3" />
                {/* Center Core */}
                <circle cx="32" cy="32" r="6" fill="#ef4444" />
                <circle cx="16" cy="20" r="3" fill="#2563eb" />
                <circle cx="48" cy="44" r="3" fill="#1e293b" />
              </svg>
            </div>
            
            <div className="text-left">
              <span className="block text-3xl font-black text-slate-900 tracking-tight leading-none">
                Mikro<span className="text-blue-600 font-extrabold text-3xl tracking-normal">Gestor</span>
              </span>
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mt-0.5">
                Sorteador de Leads Hotspot
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* ── STAGE 1: ROLLING SUSPENSE ANIMATION ── */}
        {isRolling && (
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-xl border border-blue-200/80 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-200 my-4">
            <div className="w-24 h-24 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-500 p-1.5 shadow-xl shadow-blue-500/30 animate-pulse mb-4">
              <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                {rollingCandidate?.avatarUrl ? (
                  <img src={rollingCandidate.avatarUrl} alt="Candidate" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-black text-blue-600">
                    {(rollingCandidate?.name || '?')[0].toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            <span className="text-xs font-bold uppercase tracking-widest text-blue-600 mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 animate-spin" />
              Sorteando Participante...
            </span>

            <h3 className="text-2xl font-black text-slate-900 tracking-tight h-8 truncate max-w-xs">
              {rollingCandidate?.name || 'Aguarde...'}
            </h3>
            
            <p className="text-xs font-mono text-slate-500 mt-1">
              {rollingCandidate?.phone || 'Verificando cadastro...'}
            </p>

            <div className="w-48 h-2 bg-slate-100 rounded-full mt-6 overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-red-500 animate-pulse rounded-full w-full" />
            </div>
          </div>
        )}

        {/* ── STAGE 2: WINNER CARD REVEALED ── */}
        {!isRolling && winner && (
          <div className="w-full max-w-xl bg-white/95 backdrop-blur-xl border-2 border-emerald-400 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-emerald-500/15 flex flex-col items-center text-center animate-in fade-in zoom-in-95 duration-300 my-2">
            
            {/* Winner Badge */}
            <div className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-black uppercase tracking-wider mb-4 shadow-xs">
              <Trophy className="w-4 h-4 text-emerald-600" />
              <span>Ganhador(a) do Sorteio!</span>
            </div>

            {/* Profile Avatar / WhatsApp Photo */}
            <div className="relative mb-3">
              <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full p-1.5 bg-gradient-to-tr from-emerald-500 via-teal-400 to-blue-500 shadow-2xl shadow-emerald-500/30">
                <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden border-2 border-white">
                  {winner.avatarUrl ? (
                    <img 
                      src={winner.avatarUrl} 
                      alt={winner.name} 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-100 flex flex-col items-center justify-center text-slate-700">
                      <span className="text-3xl sm:text-4xl font-black">
                        {(winner.name || 'G')[0].toUpperCase()}
                      </span>
                      <span className="text-[9px] font-bold text-slate-400 mt-1">Sem Foto</span>
                    </div>
                  )}
                </div>
              </div>
              
              {winner.avatarUrl ? (
                <div 
                  className="absolute bottom-0 right-1 bg-emerald-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white"
                  title="Foto sincronizada via WhatsApp"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              ) : (
                <div 
                  className="absolute bottom-0 right-1 bg-slate-400 text-white p-1.5 rounded-full shadow-lg border-2 border-white"
                  title="Foto padrão"
                >
                  <Users className="w-4 h-4" />
                </div>
              )}
            </div>

            {/* Registered Name (O nome que a pessoa cadastrou!) */}
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1">
              {winner.name || 'Cliente Sem Nome'}
            </h2>

            {/* Phone & Lead Info */}
            <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
              {winner.phone || winner.whatsappNumber ? (
                <span className="text-xs font-mono font-bold px-3 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200">
                  📱 {winner.phone || winner.whatsappNumber}
                </span>
              ) : null}
              <span className="text-xs font-mono px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200">
                Login: {winner.hotspotUser}
              </span>
            </div>

            {/* WhatsApp Message Customization Box */}
            <div className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left mb-6 shadow-xs">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <MessageSquare className="w-4 h-4 text-emerald-600" />
                  <span>Personalizar Mensagem do WhatsApp</span>
                </label>
                <span className="text-[10px] text-slate-400 font-mono">
                  Tags: [Nome], [Telefone]
                </span>
              </div>
              
              <textarea
                value={whatsappMsg}
                onChange={e => setWhatsappMsg(e.target.value)}
                rows={3}
                className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all resize-none shadow-inner"
              />

              {/* Message Feedback */}
              {msgStatus && (
                <div className={`mt-2.5 p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                  msgStatus.success 
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}>
                  {msgStatus.success ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-bold">Mensagem enviada com sucesso no WhatsApp do ganhador!</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                      <span>{msgStatus.error}</span>
                    </>
                  )}
                </div>
              )}

              {/* Send Button */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 mt-3">
                <button
                  type="button"
                  onClick={handleSendMessage}
                  disabled={sendingMsg || !whatsappMsg.trim()}
                  className="w-full sm:flex-1 py-2.5 px-4 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {sendingMsg ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Disparando WhatsApp...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>Enviar Mensagem via WhatsApp</span>
                    </>
                  )}
                </button>

                {(winner.phone || winner.whatsappNumber) && (
                  <a
                    href={`https://wa.me/55${(winner.phone || winner.whatsappNumber || '').replace(/\D/g, '')}?text=${encodeURIComponent(
                      whatsappMsg.replace(/\[Nome\]/g, winner.name || 'Cliente')
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full sm:w-auto py-2.5 px-3.5 rounded-xl font-bold text-xs bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 shadow-xs transition-all flex items-center justify-center gap-1.5"
                    title="Abrir no WhatsApp Web"
                  >
                    <span>Abrir Chat</span>
                    <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  </a>
                )}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={startRaffle}
                disabled={isRolling}
                className="flex-1 py-3 px-5 rounded-xl font-black text-xs uppercase tracking-wider bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-lg shadow-red-500/25 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <span>🎲</span>
                <span>Sortear Outro Lead</span>
              </button>
            </div>
          </div>
        )}

        {/* ── STAGE 3: DEFAULT CONTROLS (Nexus DRAW interface layout) ── */}
        {!isRolling && !winner && (
          <div className="flex flex-col items-center text-center w-full max-w-md">
            
            {/* Counter Section: Sortear 1 número entre 1 e 100 */}
            <div className="my-6 space-y-3">
              <div className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight flex items-center justify-center gap-3">
                <span className="text-slate-600 font-bold">Sortear</span>
                <span className="px-3.5 py-1 bg-white border border-slate-300 rounded-xl text-slate-900 font-mono shadow-xs">
                  1
                </span>
                <span className="text-slate-600 font-bold">lead</span>
              </div>

              <div className="text-xl sm:text-2xl font-extrabold text-slate-700 tracking-tight flex items-center justify-center gap-2.5">
                <span className="text-slate-500 font-medium">entre</span>
                <span className="px-3 py-0.5 bg-white border border-slate-300 rounded-lg text-slate-900 font-mono text-lg shadow-xs">
                  1
                </span>
                <span className="text-slate-500 font-medium">e</span>
                <span className="px-3.5 py-0.5 bg-white border border-slate-300 rounded-lg text-blue-600 font-mono font-black text-lg shadow-xs">
                  {leads.length || 0}
                </span>
              </div>
            </div>

            {/* Editable Raffle Name */}
            <div className="mb-4 flex items-center justify-center gap-2 text-xs text-slate-500">
              <span>Nome do sorteio:</span>
              {isEditingTitle ? (
                <input
                  type="text"
                  value={raffleTitle}
                  onChange={e => setRaffleTitle(e.target.value)}
                  onBlur={() => setIsEditingTitle(false)}
                  autoFocus
                  className="px-2 py-0.5 rounded border border-blue-400 bg-white text-xs font-bold text-slate-900 outline-none"
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setIsEditingTitle(true)}
                  className="font-bold text-slate-700 hover:text-blue-600 inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>{raffleTitle}</span>
                  <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                </button>
              )}
            </div>

            {/* Collapsible Options Button */}
            <div className="w-full mb-6">
              <button
                type="button"
                onClick={() => setShowOptions(v => !v)}
                className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-2xl text-xs font-bold text-slate-700 shadow-xs flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Settings2 className="w-3.5 h-3.5 text-slate-500" />
                <span>Opções do Sorteio</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showOptions ? 'rotate-180' : ''}`} />
              </button>

              {/* Options Panel */}
              {showOptions && (
                <div className="mt-2.5 p-4 rounded-2xl bg-white border border-slate-200 text-left space-y-3 shadow-md animate-in fade-in slide-in-from-top-2 duration-200">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={onlyUndrawn}
                      onChange={e => setOnlyUndrawn(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                    />
                    <span>Apenas participantes que nunca foram sorteados</span>
                  </label>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">
                      Total de cadastros no banco: <strong>{leads.length}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={handleResetRaffle}
                      disabled={resettingRaffle}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 underline cursor-pointer disabled:opacity-50"
                    >
                      {resettingRaffle ? 'Zerando...' : 'Zerar Histórico de Sorteios'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* BIG HIGH-IMPACT BUTTON: SORTEAR AGORA! (Matching Nexus DRAW Red Button) */}
            <button
              type="button"
              onClick={startRaffle}
              disabled={loading || leads.length === 0}
              className="w-full py-4 px-10 rounded-2xl text-lg font-black uppercase tracking-wider text-white bg-gradient-to-r from-red-500 via-red-600 to-rose-600 hover:from-red-600 hover:to-rose-700 active:scale-98 shadow-xl shadow-red-500/30 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transform hover:-translate-y-0.5"
            >
              <Sparkles className="w-5 h-5 text-amber-200 animate-pulse" />
              <span>SORTEAR AGORA!</span>
            </button>

            {/* Footnote text */}
            <p className="text-xs font-bold text-slate-700 mt-5">
              Sorteador de leads e participantes Wi-Fi gratuito!
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Sorteio aleatório certificado com disparo instantâneo via WhatsApp.
            </p>

          </div>
        )}

      </main>

      {/* ── Footer (Matching Nexus DRAW footer) ── */}
      <footer className="relative z-10 py-4 text-center text-[11px] text-slate-400 border-t border-slate-200/50 bg-white/40">
        MikroGestor Hotspot // Sorteador Oficial • Termos de Uso e Privacidade
      </footer>

    </div>
  );
}
