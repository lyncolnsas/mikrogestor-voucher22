"use client";

import React, { useState } from 'react';
import { 
  Cpu, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  RefreshCw, 
  ShieldCheck, 
  ArrowRight, 
  Zap, 
  Wrench,
  RotateCcw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface Step {
  name: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message: string;
}

interface ProvisioningStudioPanelProps {
  provStage: 'select' | 'running' | 'reconnecting' | 'done' | 'error';
  provInterfaces: any[];
  provSuggestedGateway: string;
  setProvSuggestedGateway: (ip: string) => void;
  provSelectedWan: any;
  setProvSelectedWan: (iface: any) => void;
  provSteps: Step[];
  provLoading: boolean;
  provNotConnected: boolean;
  provFetchError: string;
  provSummary: any;
  provErrorMsg: string;
  provReconnectStatus: string;
  provAudit: any;
  provHasFailures: boolean;
  provFixingApiRule: boolean;
  provFixApiRuleMsg: string;
  onFixApiRule: () => void;
  onProvision: () => void;
  onResetProvision: () => void;
}

export default function ProvisioningStudioPanel({
  provStage,
  provInterfaces,
  provSuggestedGateway,
  setProvSuggestedGateway,
  provSelectedWan,
  setProvSelectedWan,
  provSteps,
  provLoading,
  provNotConnected,
  provFetchError,
  provSummary,
  provErrorMsg,
  provReconnectStatus,
  provAudit,
  provHasFailures,
  provFixingApiRule,
  provFixApiRuleMsg,
  onFixApiRule,
  onProvision,
  onResetProvision,
}: ProvisioningStudioPanelProps) {
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  if (provNotConnected) {
    return (
      <div className="flex flex-col items-center justify-center p-8 text-center h-full space-y-3 select-none">
        <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
          Roteador MikroTik Desconectado
        </h3>
        <p className="text-xs text-slate-500 max-w-sm">
          Conecte-se ao seu MikroTik na tela de Configurações para poder provisionar novos hotspots ou diagnosticar interfaces.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Cpu className="w-4 h-4 text-blue-600" />
            <span>Assistente de Provisionamento do Hotspot</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Configuração automática de Bridge, Servidor DHCP, IP Pool e Regras de Firewall.
          </p>
        </div>

        {provStage !== 'select' && (
          <button
            type="button"
            onClick={onResetProvision}
            className="text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reiniciar</span>
          </button>
        )}
      </div>

      {/* Audit Alert */}
      {provHasFailures && (
        <div className="p-4 rounded-xl border border-amber-300 dark:border-amber-800/80 bg-amber-50 dark:bg-amber-950/30 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900 dark:text-amber-200">
              <Wrench className="w-4 h-4 text-amber-600" />
              <span>Ajustes Recomendados no Firewall</span>
            </div>
            <button
              type="button"
              onClick={onFixApiRule}
              disabled={provFixingApiRule}
              className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
            >
              {provFixingApiRule ? 'Aplicando...' : 'Corrigir Automaticamente'}
            </button>
          </div>
          {provFixApiRuleMsg && (
            <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-300">
              {provFixApiRuleMsg}
            </p>
          )}
        </div>
      )}

      {/* 10-Point Audit Overview */}
      {provAudit && (
        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-slate-50/50 dark:bg-slate-850/40">
          <button
            type="button"
            onClick={() => setShowAuditDetails(!showAuditDetails)}
            className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Diagnóstico de Auditoria do Roteador</span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <span>{showAuditDetails ? 'Ocultar' : 'Ver Detalhes'}</span>
              {showAuditDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </div>
          </button>

          {showAuditDetails && (
            <div className="px-3.5 pb-3 pt-1 space-y-1.5 border-t border-slate-200/60 dark:border-slate-800/60">
              {Object.entries(provAudit).map(([key, item]: [string, any]) => {
                const isOk = item?.status === 'success';
                return (
                  <div key={key} className="flex items-start gap-2 text-[11px]">
                    {isOk ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                    ) : (
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                    )}
                    <span className={isOk ? 'text-slate-600 dark:text-slate-300' : 'text-amber-700 dark:text-amber-300 font-medium'}>
                      {item?.message || key}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Stage: SELECT INTERFACE */}
      {provStage === 'select' && (
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center justify-between">
              <span>1. Selecione a Interface / Bridge LAN do Hotspot:</span>
              <span className="text-[11px] font-normal text-slate-400">Onde os clientes Wi-Fi se conectam</span>
            </label>

            {provLoading ? (
              <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 text-center space-y-2">
                <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
                <p className="text-xs text-slate-500 font-medium">Carregando interfaces do MikroTik...</p>
              </div>
            ) : provFetchError ? (
              <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {provFetchError}
              </div>
            ) : provInterfaces.length === 0 ? (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-400">
                Nenhuma interface encontrada no roteador.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2">
                {provInterfaces.map((iface) => {
                  const isSelected = provSelectedWan?.name === iface.name;
                  return (
                    <div
                      key={iface.name}
                      onClick={() => setProvSelectedWan(iface)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/40 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className={`w-2 h-2 rounded-full ${iface.running ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                              {iface.name}
                            </span>
                            {iface.isBridge && (
                              <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 uppercase">
                                Bridge Recomendada
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {iface.type} • {iface.macAddress}
                          </span>
                        </div>
                      </div>

                      {iface.hasIp ? (
                        <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2 py-0.5 rounded border border-blue-200 dark:border-blue-900">
                          {iface.configuredIp}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Sem IP</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 dark:text-slate-200">
              2. Gateway IP para a Rede Hotspot (LAN):
            </label>
            <input
              type="text"
              value={provSuggestedGateway}
              onChange={(e) => setProvSuggestedGateway(e.target.value)}
              placeholder="192.168.88.1"
              className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
            />
          </div>

          <button
            type="button"
            onClick={onProvision}
            disabled={!provSelectedWan || provLoading}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-xs cursor-pointer disabled:opacity-40 shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          >
            <Zap className="w-4 h-4 fill-white" />
            <span>Iniciar Provisionamento Inteligente</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Stage: RUNNING / RECONNECTING / STEPS */}
      {(provStage === 'running' || provStage === 'reconnecting' || provStage === 'done' || provStage === 'error') && (
        <div className="space-y-4">
          <div className="space-y-2.5">
            {provSteps.map((s) => (
              <div
                key={s.name}
                className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-1"
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-800 dark:text-slate-200">{s.label}</span>
                  {s.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                  {s.status === 'running' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                  {s.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                  {s.status === 'pending' && <Clock className="w-4 h-4 text-slate-400" />}
                  {s.status === 'skipped' && <span className="text-[10px] text-slate-400 font-normal">Pulado</span>}
                </div>
                {s.message && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {s.message}
                  </p>
                )}
              </div>
            ))}
          </div>

          {provReconnectStatus && (
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 text-xs font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              <span>{provReconnectStatus}</span>
            </div>
          )}

          {provStage === 'done' && (
            <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-300 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-100 space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span>Hotspot Provisionado com Sucesso!</span>
              </div>
              <p className="text-[11px] text-emerald-800 dark:text-emerald-200 leading-relaxed">
                O roteador MikroTik está totalmente configurado e respondendo na bridge <strong>{provSelectedWan?.name}</strong>. O bypass para o servidor e os serviços de DHCP e Hotspot estão ativos!
              </p>
              {provSummary && (
                <div className="bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-lg font-mono text-[11px] space-y-1">
                  <div>Gateway: {provSummary.gatewayIp}</div>
                  <div>Interface: {provSummary.lanBridge}</div>
                  <div>DNS Portal: {provSummary.dnsPortal}</div>
                </div>
              )}
              <button
                type="button"
                onClick={onResetProvision}
                className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
              >
                Concluir
              </button>
            </div>
          )}

          {provStage === 'error' && (
            <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-300 dark:border-red-800 text-xs text-red-900 dark:text-red-100 space-y-2">
              <span className="font-bold block">Falha no Provisionamento:</span>
              <p className="text-[11px] text-red-700 dark:text-red-300">{provErrorMsg}</p>
              <button
                type="button"
                onClick={onResetProvision}
                className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer"
              >
                Tentar Novamente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
