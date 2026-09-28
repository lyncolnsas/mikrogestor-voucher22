'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Wifi,
  WifiOff,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Smartphone,
  ExternalLink,
  ShieldCheck,
  Signal
} from 'lucide-react';

interface Props {
  networkName: string;
  dnsName: string;
  hotspotIp: string;
  subdomain?: string | null;
  businessName?: string | null;
}

export default function ClientLoginPortal({
  networkName,
  dnsName,
  hotspotIp = '192.168.88.1',
  subdomain,
  businessName = 'Portal Wi-Fi',
}: Props) {
  const [status, setStatus] = useState<'checking' | 'connected' | 'outside_wifi'>('checking');
  const [isVerifying, setIsVerifying] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Determina URL de login primária e alternativa
  const primaryLoginUrl = subdomain
    ? `https://${subdomain}/login`
    : `http://${hotspotIp}/login`;
  const fallbackIpUrl = `http://${hotspotIp}/login`;

  const probeLocalWifi = useCallback(async (): Promise<boolean> => {
    // Tenta probe no IP gateway local do roteador (192.168.88.1)
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1400);

      await fetch(`http://${hotspotIp}/login`, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      });

      clearTimeout(timer);
      return true;
    } catch {
      // Falha ou timeout indica que o pacote não encontrou o gateway local (ex: conectado via 4G/5G)
      return false;
    }
  }, [hotspotIp]);

  const verifyAndRedirect = useCallback(async (isManualClick = false) => {
    setIsVerifying(true);
    setToastMessage(null);

    const isConnected = await probeLocalWifi();

    if (isConnected) {
      setStatus('connected');
      setTimeout(() => {
        window.location.href = primaryLoginUrl;
      }, 700);
    } else {
      setStatus('outside_wifi');
      setIsVerifying(false);
      if (isManualClick) {
        setToastMessage(`Ainda não detectamos sua conexão no Wi-Fi "${networkName}". Por favor, confirme se o seu Wi-Fi está ativado e conectado.`);
      }
    }
  }, [probeLocalWifi, primaryLoginUrl, networkName]);

  useEffect(() => {
    // Executa verificação inicial ao carregar a página
    verifyAndRedirect(false);
  }, [verifyAndRedirect]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-950 to-slate-900 text-slate-100 flex flex-col justify-between items-center p-4 sm:p-6 font-sans select-none">
      {/* Top Header */}
      <header className="w-full max-w-md flex items-center justify-between py-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
            <Signal className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xs font-bold tracking-wider uppercase text-slate-300">
              {businessName || 'MikroGestor'}
            </h1>
            <p className="text-[10px] text-slate-500 font-mono">Rede Segura & Autenticada</p>
          </div>
        </div>

        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-800/80 border border-slate-700 text-slate-300">
          <ShieldCheck className="w-3 h-3 text-emerald-400" /> WPA3 / Hotspot
        </span>
      </header>

      {/* Main Card */}
      <main className="w-full max-w-md my-auto">
        <div className="relative bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xl overflow-hidden">
          {/* Background Ambient Glow */}
          <div className={`absolute -top-20 -right-20 w-48 h-48 rounded-full blur-3xl pointer-events-none transition-colors duration-700 ${
            status === 'connected' ? 'bg-emerald-500/20' : 'bg-orange-500/15'
          }`} />

          {/* ─────────────────────────────────────────────────────────────
              ESTADO 1: VERIFICANDO CONEXÃO
             ───────────────────────────────────────────────────────────── */}
          {status === 'checking' && (
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-400 animate-pulse">
                <RotateCw className="w-8 h-8 animate-spin" />
              </div>
              <h2 className="text-lg font-bold text-slate-100">Verificando sua conexão...</h2>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Identificando se o seu aparelho já está conectado ao Wi-Fi <span className="font-semibold text-orange-400">{networkName}</span>.
              </p>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              ESTADO 2: CONECTADO COM SUCESSO!
             ───────────────────────────────────────────────────────────── */}
          {status === 'connected' && (
            <div className="text-center py-6 space-y-4 animate-fade-in">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>
              <div>
                <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 mb-2">
                  🟢 Wi-Fi Conectado
                </span>
                <h2 className="text-xl font-black text-slate-100">Conexão Detectada!</h2>
                <p className="text-xs text-slate-400 mt-1">
                  Redirecionando você para a tela de login da rede...
                </p>
              </div>

              <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                <div className="bg-emerald-400 h-full w-full animate-[progress_1s_ease-in-out_infinite]" />
              </div>

              <a
                href={primaryLoginUrl}
                className="inline-flex items-center gap-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 underline pt-2"
              >
                Clique aqui se não for redirecionado automaticamente <ArrowRight className="w-3.5 h-3.5" />
              </a>
            </div>
          )}

          {/* ─────────────────────────────────────────────────────────────
              ESTADO 3: FORA DA REDE WI-FI (MENSAGEM SOLICITADA PELO USUÁRIO)
             ───────────────────────────────────────────────────────────── */}
          {status === 'outside_wifi' && (
            <div className="space-y-6 animate-fade-in">
              {/* Badge & Icon */}
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-lg shadow-amber-500/10 mb-3">
                  <WifiOff className="w-8 h-8" />
                </div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  <AlertTriangle className="w-3.5 h-3.5" /> Fora da Rede Wi-Fi
                </span>
                <h2 className="text-lg font-black text-slate-100 mt-2">
                  Acesso ao Portal de Login
                </h2>
              </div>

              {/* Mensagem Principal em Destaque */}
              <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/30 text-center space-y-2">
                <p className="text-sm font-semibold text-amber-200 leading-relaxed">
                  Conecte-se na rede Wi-Fi <span className="font-extrabold text-amber-400 underline underline-offset-2">{networkName}</span> para poder fazer seu login e utilizar nossos serviços.
                </p>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-900/80 border border-slate-700/80 text-xs font-mono font-bold text-amber-300">
                  <Wifi className="w-3.5 h-3.5 text-amber-400" /> {networkName}
                </div>
              </div>

              {/* Instruções Passo a Passo */}
              <div className="space-y-2.5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5 text-orange-400" /> Passo a Passo para Conectar:
                </h3>
                <ol className="space-y-2 text-xs text-slate-300">
                  <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-[10px]">
                      1
                    </span>
                    <span>Abra as <strong>Configurações de Wi-Fi</strong> no seu smartphone ou computador.</span>
                  </li>
                  <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-[10px]">
                      2
                    </span>
                    <span>Procure e selecione a rede <strong className="text-orange-400 font-mono">"{networkName}"</strong>.</span>
                  </li>
                  <li className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/50 border border-slate-800">
                    <span className="flex-shrink-0 w-5 h-5 rounded-full bg-orange-500/20 text-orange-400 font-bold flex items-center justify-center text-[10px]">
                      3
                    </span>
                    <span>Se a página de login não abrir sozinha, retorne aqui e toque no botão abaixo:</span>
                  </li>
                </ol>
              </div>

              {/* Toast de Alerta quando o usuário clica e ainda não conectou */}
              {toastMessage && (
                <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center flex items-center justify-center gap-2 animate-bounce">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0 text-red-400" />
                  <span>{toastMessage}</span>
                </div>
              )}

              {/* Ações / Botões */}
              <div className="space-y-2.5 pt-1">
                {/* Botão Principal: Já me conectei */}
                <button
                  type="button"
                  disabled={isVerifying}
                  onClick={() => verifyAndRedirect(true)}
                  className="w-full py-3.5 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/25 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <RotateCw className="w-4 h-4 animate-spin" /> Verificando Wi-Fi...
                    </>
                  ) : (
                    <>
                      <RotateCw className="w-4 h-4" /> Já me conectei, Entrar na Rede
                    </>
                  )}
                </button>

                {/* Botão Secundário: Link Direto para o Roteador */}
                <a
                  href={fallbackIpUrl}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-800/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700/80 flex items-center justify-center gap-2 transition-colors text-center"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
                  Tentar abrir direto no roteador ({hotspotIp})
                </a>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md py-4 text-center">
        <p className="text-[11px] text-slate-500">
          MikroGestor Hotspot Gateway &copy; {new Date().getFullYear()}
        </p>
      </footer>
    </div>
  );
}
