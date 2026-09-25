"use client";

import React from 'react';
import { 
  KeyRound, 
  Ticket, 
  UserCheck, 
  Zap, 
  QrCode, 
  Sparkles,
  Info
} from 'lucide-react';

interface HotspotAuthStudioPanelProps {
  fields: any;
  setFields: React.Dispatch<React.SetStateAction<any>>;
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  saleMode: boolean;
  setSaleMode: (val: boolean) => void;
  systemFreeWifiMode: boolean;
  onToggleSystemMode: (free: boolean) => Promise<void>;
  trialEnabled: boolean;
  setTrialEnabled: (val: boolean) => void;
  loginButtonLabel: string;
  setLoginButtonLabel: (val: string) => void;
  registerButtonText: string;
  setRegisterButtonText: (val: string) => void;
  trialText: string;
  setTrialText: (val: string) => void;
  trialLinkText: string;
  setTrialLinkText: (val: string) => void;
  trialModalTitle?: string;
  setTrialModalTitle?: (val: string) => void;
  trialModalMessage?: string;
  setTrialModalMessage?: (val: string) => void;
}

export default function HotspotAuthStudioPanel({
  fields,
  setFields,
  enabled,
  setEnabled,
  saleMode,
  setSaleMode,
  systemFreeWifiMode,
  onToggleSystemMode,
  trialEnabled,
  setTrialEnabled,
  loginButtonLabel,
  setLoginButtonLabel,
  registerButtonText,
  setRegisterButtonText,
  trialText,
  setTrialText,
  trialLinkText,
  setTrialLinkText,
}: HotspotAuthStudioPanelProps) {

  // Toggle single PIN mode vs Username+Password
  const isPinOnly = fields.usernameEnabled && !fields.passwordEnabled;
  const [togglingMode, setTogglingMode] = React.useState(false);

  const handleSetAuthMode = (mode: 'pin' | 'user_pass' | 'lead_register' | 'trial' | 'pix_sales') => {
    switch (mode) {
      case 'pin':
        setFields((prev: any) => ({
          ...prev,
          usernameEnabled: true,
          usernameRequired: true,
          passwordEnabled: false,
          passwordRequired: false
        }));
        setEnabled(false); // hides lead registration button
        setSaleMode(false);
        break;
      case 'user_pass':
        setFields((prev: any) => ({
          ...prev,
          usernameEnabled: true,
          usernameRequired: true,
          passwordEnabled: true,
          passwordRequired: true
        }));
        setSaleMode(false);
        break;
      case 'lead_register':
        setEnabled(true);
        setSaleMode(false);
        break;
      case 'trial':
        setTrialEnabled(!trialEnabled);
        break;
      case 'pix_sales':
        setSaleMode(!saleMode);
        break;
    }
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-6 select-none">
      <div>
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-blue-600" />
          <span>Métodos de Autenticação do Hotspot</span>
        </h3>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Configure como os clientes irão se conectar ao Wi-Fi através do MikroTik.
        </p>
      </div>

      {/* ── PAINEL MESTRE: MODO GLOBAL DO SISTEMA (SINCRONIZADO) ── */}
      <div className="p-3.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/40 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-wider text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            Modo Operacional do Sistema
          </span>
          <span className="text-[9px] font-mono text-slate-400">
            free_wifi_mode
          </span>
        </div>
        <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
          Este modo é <span className="font-semibold text-slate-800 dark:text-slate-200">único e global</span>. Alterar aqui reflete instantaneamente no Painel Geral e na Central do WhatsApp.
        </p>

        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Opção Free */}
          <button
            type="button"
            disabled={togglingMode}
            onClick={async () => {
              if (systemFreeWifiMode) return;
              setTogglingMode(true);
              try {
                await onToggleSystemMode(true);
              } finally {
                setTogglingMode(false);
              }
            }}
            className={`py-2 px-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
              systemFreeWifiMode
                ? 'border-emerald-500 bg-white dark:bg-slate-900 shadow-xs ring-2 ring-emerald-500/20'
                : 'border-transparent bg-blue-100/50 dark:bg-blue-900/20 hover:bg-white dark:hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-black ${systemFreeWifiMode ? 'text-emerald-700 dark:text-emerald-300' : 'text-slate-600 dark:text-slate-400'}`}>
                ⚡ 100% Free
              </span>
              {systemFreeWifiMode && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Wi-Fi grátis / captação de leads sem cobrança
            </span>
          </button>

          {/* Opção Pago */}
          <button
            type="button"
            disabled={togglingMode}
            onClick={async () => {
              if (!systemFreeWifiMode) return;
              setTogglingMode(true);
              try {
                await onToggleSystemMode(false);
              } finally {
                setTogglingMode(false);
              }
            }}
            className={`py-2 px-2.5 rounded-lg border text-left flex flex-col gap-0.5 transition-all ${
              !systemFreeWifiMode
                ? 'border-cyan-500 bg-white dark:bg-slate-900 shadow-xs ring-2 ring-cyan-500/20'
                : 'border-transparent bg-blue-100/50 dark:bg-blue-900/20 hover:bg-white dark:hover:bg-slate-900'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-[11px] font-black ${!systemFreeWifiMode ? 'text-cyan-700 dark:text-cyan-300' : 'text-slate-600 dark:text-slate-400'}`}>
                💳 Venda PIX
              </span>
              {!systemFreeWifiMode && (
                <span className="w-2 h-2 rounded-full bg-cyan-500" />
              )}
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
              Cobrança de planos via PIX no portal
            </span>
          </button>
        </div>
      </div>

      {/* Primary Auth Selector Cards */}
      <div className="space-y-3">
        {/* 1. Voucher PIN Simples */}
        <div 
          onClick={() => handleSetAuthMode('pin')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            isPinOnly && !enabled
              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-300">
                <Ticket className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Voucher PIN (Código Único)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Campo único para digitar o PIN do voucher impresso. Senha é preenchida automaticamente.
                </p>
              </div>
            </div>
            {isPinOnly && !enabled && (
              <span className="text-[10px] font-extrabold bg-blue-600 text-white px-2 py-0.5 rounded-full">
                ATIVO
              </span>
            )}
          </div>
        </div>

        {/* 2. Usuário e Senha */}
        <div 
          onClick={() => handleSetAuthMode('user_pass')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            fields.usernameEnabled && fields.passwordEnabled && !isPinOnly
              ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/60 text-indigo-600 dark:text-indigo-300">
                <KeyRound className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Usuário e Senha Tradicional
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Dois campos separados para credenciais cadastradas no User Manager ou locais.
                </p>
              </div>
            </div>
            {fields.usernameEnabled && fields.passwordEnabled && !isPinOnly && (
              <span className="text-[10px] font-extrabold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                ATIVO
              </span>
            )}
          </div>
        </div>

        {/* 3. Auto-Cadastro de Leads */}
        <div 
          onClick={() => handleSetAuthMode('lead_register')}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            enabled
              ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/40 ring-2 ring-emerald-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/60 text-emerald-600 dark:text-emerald-300">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Auto-Cadastro & Captação de Leads
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Exibe o botão de cadastro. O cliente preenche WhatsApp/Nome e navega imediatamente.
                </p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={enabled} 
              onChange={(e) => setEnabled(e.target.checked)} 
              className="w-4 h-4 accent-emerald-600" 
            />
          </div>
        </div>

        {/* 4. Modo Teste / 1-Clique Wi-Fi Grátis */}
        <div 
          onClick={() => setTrialEnabled(!trialEnabled)}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            trialEnabled
              ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 ring-2 ring-amber-500/20'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/60 text-amber-600 dark:text-amber-300">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                  Acesso de Teste (1-Clique / Wi-Fi Grátis)
                </span>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Libera 30 minutos de navegação rápida usando o recurso nativo de Trial do MikroTik.
                </p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={trialEnabled} 
              onChange={(e) => setTrialEnabled(e.target.checked)} 
              className="w-4 h-4 accent-amber-600" 
            />
          </div>
        </div>

        {/* 5. Venda de Planos PIX */}
        <div 
          onClick={() => {
            if (systemFreeWifiMode) {
              // Se estiver em modo Free, ao clicar para ativar venda ele muda o modo global
              onToggleSystemMode(false);
              setSaleMode(true);
            } else {
              setSaleMode(!saleMode);
            }
          }}
          className={`p-3.5 rounded-xl border transition-all cursor-pointer ${
            !systemFreeWifiMode && saleMode
              ? 'border-cyan-500 bg-cyan-50/60 dark:bg-cyan-950/40 ring-2 ring-cyan-500/20'
              : systemFreeWifiMode
              ? 'border-slate-200/60 dark:border-slate-800/60 bg-slate-100/50 dark:bg-slate-800/20 opacity-70 hover:opacity-100'
              : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300'
          }`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-cyan-100 dark:bg-cyan-900/60 text-cyan-600 dark:text-cyan-300">
                <QrCode className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    Venda de Acesso via PIX / WhatsApp
                  </span>
                  {systemFreeWifiMode && (
                    <span className="text-[9px] bg-amber-100 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 font-bold px-1.5 py-0.5 rounded">
                      Inativo (Sistema em Modo Free)
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {systemFreeWifiMode
                    ? 'Clique para ativar o modo de venda global e exibir a grade de planos PIX no portal.'
                    : 'Permite aos clientes comprar planos no portal com liberação automática via IP Binding.'}
                </p>
              </div>
            </div>
            <input 
              type="checkbox" 
              checked={!systemFreeWifiMode && saleMode} 
              onChange={(e) => {
                if (systemFreeWifiMode) {
                  onToggleSystemMode(false);
                  setSaleMode(true);
                } else {
                  setSaleMode(e.target.checked);
                }
              }} 
              className="w-4 h-4 accent-cyan-600" 
            />
          </div>
        </div>
      </div>

      {/* Rótulos dos Botões */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Textos dos Botões de Ação
        </h4>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Botão de Login (Principal)
          </label>
          <input
            type="text"
            value={loginButtonLabel}
            onChange={(e) => setLoginButtonLabel(e.target.value)}
            placeholder="Conectar"
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        {enabled && (
          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Botão de Cadastro (Secundário)
            </label>
            <input
              type="text"
              value={registerButtonText}
              onChange={(e) => setRegisterButtonText(e.target.value)}
              placeholder="Cadastre-se aqui"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
        )}

        {trialEnabled && (
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-700">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Texto do Acesso de Teste (Trial)
            </label>
            <input
              type="text"
              value={trialText}
              onChange={(e) => setTrialText(e.target.value)}
              placeholder="Acesso de teste disponível, "
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
            <input
              type="text"
              value={trialLinkText}
              onChange={(e) => setTrialLinkText(e.target.value)}
              placeholder="clique aqui"
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
            />
          </div>
        )}
      </div>

      {/* RouterOS Hotspot Variables Card */}
      <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-slate-800 dark:text-slate-200 font-bold">
          <Info className="w-4 h-4 text-blue-500" />
          <span>Variáveis Nativas do MikroTik RouterOS</span>
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          O formulário HTML gerado utiliza as variáveis oficiais do RouterOS para garantir 100% de compatibilidade:
        </p>
        <div className="grid grid-cols-2 gap-1.5 font-mono text-[10px] text-slate-600 dark:text-slate-300">
          <span className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">$(link-login-only)</span>
          <span className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">$(username)</span>
          <span className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">$(password)</span>
          <span className="p-1 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">$(mac)</span>
        </div>
      </div>
    </div>
  );
}
