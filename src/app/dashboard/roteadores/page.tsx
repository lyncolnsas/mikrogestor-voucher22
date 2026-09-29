"use client";

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  ChevronUp,
  ArrowLeft,
  Settings,
  Wifi,
  WifiOff,
} from 'lucide-react';

type ProvStage = 'select' | 'running' | 'reconnecting' | 'done' | 'error';

interface ProvStep {
  name: string;
  label: string;
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped';
  message: string;
}

const INITIAL_STEPS: ProvStep[] = [
  { name: 'etapa_1', label: '⚡ Etapa 1: Provisionamento dos Serviços de Hotspot', status: 'pending', message: '' },
  { name: 'etapa_2', label: '🧹 Etapa 2: Validação de Configurações de Fábrica', status: 'pending', message: '' },
  { name: 'etapa_3', label: '🛡️ Etapa 3: Validação de Regras de Firewall', status: 'pending', message: '' },
  { name: 'etapa_4', label: '🔑 Etapa 4: Configuração de Acesso à API e Assinatura', status: 'pending', message: '' },
];

export default function RoteadoresPage() {
  const [provInterfaces, setProvInterfaces] = useState<any[]>([]);
  const [provSuggestedGateway, setProvSuggestedGateway] = useState('10.10.10.1');
  const [provLoading, setProvLoading] = useState(false);
  const [provNotConnected, setProvNotConnected] = useState(false);
  const [provFetchError, setProvFetchError] = useState('');
  const [provSelectedWan, setProvSelectedWan] = useState<any>(null);
  const [provSteps, setProvSteps] = useState<ProvStep[]>(INITIAL_STEPS);
  const [provStage, setProvStage] = useState<ProvStage>('select');
  const [provSummary, setProvSummary] = useState<any>(null);
  const [provErrorMsg, setProvErrorMsg] = useState('');
  const [provReconnectStatus, setProvReconnectStatus] = useState('');
  const [provAudit, setProvAudit] = useState<any>(null);
  const [provHasFailures, setProvHasFailures] = useState(false);
  const [provFixingApiRule, setProvFixingApiRule] = useState(false);
  const [provFixApiRuleMsg, setProvFixApiRuleMsg] = useState('');
  const [showAuditDetails, setShowAuditDetails] = useState(false);

  const fetchInterfaces = useCallback(async () => {
    setProvLoading(true);
    setProvFetchError('');
    try {
      const res = await fetch('/api/hotspot/provision');
      if (res.status === 401 || res.status === 503) {
        setProvNotConnected(true);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setProvNotConnected(false);
        setProvInterfaces(data.interfaces || []);
        if (data.suggestedGateway) {
          setProvSuggestedGateway(data.suggestedGateway);
        }
        setProvAudit(data.audit || null);
        setProvHasFailures(!!data.hasFailures);

        if (Array.isArray(data.interfaces) && data.interfaces.length > 0) {
          const autoIface =
            data.interfaces.find((i: any) => i.name === data.detectedWanInterface) ||
            data.interfaces.find((i: any) => i.isBridge || i.name.toLowerCase().includes('bridge')) ||
            data.interfaces.find((i: any) => !i.disabled) ||
            data.interfaces[0];
          setProvSelectedWan(autoIface);
        }
      } else {
        setProvFetchError(data.message || 'Erro ao carregar interfaces do roteador');
      }
    } catch {
      setProvFetchError('Falha na comunicação com o roteador MikroTik.');
    } finally {
      setProvLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInterfaces();
  }, [fetchInterfaces]);

  const handleFixApiRule = async () => {
    setProvFixingApiRule(true);
    setProvFixApiRuleMsg('');
    try {
      const res = await fetch('/api/hotspot/provision/fix-api-rule', { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setProvFixApiRuleMsg('✅ Regra de proteção da API aplicada com sucesso!');
        setTimeout(() => {
          setProvFixApiRuleMsg('');
          fetchInterfaces();
        }, 1200);
      } else {
        setProvFixApiRuleMsg(`❌ ${data.message || 'Falha ao aplicar regra.'}`);
      }
    } catch {
      setProvFixApiRuleMsg('❌ Erro de conexão ao tentar corrigir regra.');
    } finally {
      setProvFixingApiRule(false);
    }
  };

  const handleProvision = async () => {
    if (!provSelectedWan) return;
    setProvStage('running');
    setProvErrorMsg('');
    setProvReconnectStatus('Executando provisionamento...');

    const initialSteps: ProvStep[] = [
      { name: 'bridge_create', label: '[ BRIDGE ] Criar/Verificar Bridge LAN', status: 'running', message: 'Configurando bridge...' },
      { name: 'admin_bypass', label: '[ ACESSO ] ARP + Bypass do Sistema Administrador', status: 'pending', message: 'Aguardando...' },
      { name: 'set_ip', label: '[ IP ] Definir IP no Gateway', status: 'pending', message: 'Aguardando...' },
      { name: 'ip_pool', label: '[ POOL ] Pool de IPs para Clientes', status: 'pending', message: 'Aguardando...' },
      { name: 'dhcp_net', label: '[ REDE ] Rede DHCP', status: 'pending', message: 'Aguardando...' },
      { name: 'dhcp_server', label: '[ CONFIG ] Servidor DHCP', status: 'pending', message: 'Aguardando...' },
      { name: 'hs_profile', label: '[ FIREWALL ] Perfil do Servidor Hotspot', status: 'pending', message: 'Aguardando...' },
      { name: 'hs_server', label: '[ HOTSPOT ] Servidor Hotspot', status: 'pending', message: 'Aguardando...' },
      { name: 'user_profile', label: '[ PERFIL ] Perfil de Usuário Padrão', status: 'pending', message: 'Aguardando...' },
      { name: 'update_media_urls', label: '[ MÍDIA ] Atualizar IP nos Templates', status: 'pending', message: 'Aguardando...' },
      { name: 'provision_signature', label: '[ LOG ] Gravar Assinatura MikroGestor', status: 'pending', message: 'Aguardando...' },
    ];
    setProvSteps(initialSteps);

    try {
      const res = await fetch('/api/hotspot/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interfaceName: provSelectedWan.name,
          gatewayIp: provSuggestedGateway,
        }),
      });

      const data = await res.json();
      if (data.steps && Array.isArray(data.steps)) {
        setProvSteps(data.steps.filter((s: any) => s.status !== 'skipped' || s.name === 'nat'));
      }

      if (data.success) {
        setProvStage('done');
        setProvSummary(data.summary || null);
        setProvReconnectStatus('Provisionamento concluído com sucesso');
        fetchInterfaces();
      } else {
        setProvStage('error');
        setProvErrorMsg(data.message || 'Falha no provisionamento.');
        setProvReconnectStatus('Erro no provisionamento');
      }
    } catch (e: any) {
      setProvStage('error');
      setProvErrorMsg(e?.message || 'Erro de conexão com o servidor.');
      setProvReconnectStatus('Erro de conexão');
    }
  };

  const handleResetProvision = () => {
    setProvStage('select');
    setProvSteps(INITIAL_STEPS);
    setProvErrorMsg('');
    setProvReconnectStatus('');
    setProvSummary(null);
    fetchInterfaces();
  };

  return (
    <main className="w-full p-4 md:p-8 max-w-4xl mx-auto space-y-6 animate-fade-in">
      {/* Page Header */}
      <header className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/dashboard/portal" className="text-slate-400 hover:text-slate-600 transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              MIKROTIK // PROVISIONAMENTO
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Provisionamento de Hotspot
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Configuração automática de Bridge, DHCP, IP Pool e Regras de Firewall no MikroTik
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/dashboard/admin"
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all"
          >
            <Settings className="w-3.5 h-3.5" />
            Roteadores e Sistema
          </Link>
          <Link
            href="/dashboard/vpn"
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 transition-all"
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            VPN WireGuard
          </Link>
        </div>
      </header>

      {/* Not Connected State */}
      {provNotConnected && (
        <div className="bg-white border border-amber-200 shadow-sm rounded-2xl p-10 flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center">
            <WifiOff className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 mb-1">Roteador MikroTik Desconectado</h3>
            <p className="text-xs text-slate-500 max-w-sm">
              Conecte-se ao seu MikroTik na tela de Roteadores e Sistema antes de provisionar o hotspot.
            </p>
          </div>
          <Link
            href="/dashboard/admin"
            className="flex items-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-all shadow-sm"
          >
            <Settings className="w-3.5 h-3.5" />
            Ir para Roteadores e Sistema
          </Link>
        </div>
      )}

      {!provNotConnected && (
        <div className="bg-white border border-slate-200/80 shadow-sm rounded-2xl p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
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
                onClick={handleResetProvision}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reiniciar</span>
              </button>
            )}
          </div>

          {provHasFailures && (
            <div className="p-4 rounded-xl border border-amber-300 bg-amber-50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <Wrench className="w-4 h-4 text-amber-600" />
                  <span>Ajustes Recomendados no Firewall</span>
                </div>
                <button
                  type="button"
                  onClick={handleFixApiRule}
                  disabled={provFixingApiRule}
                  className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {provFixingApiRule ? 'Aplicando...' : 'Corrigir Automaticamente'}
                </button>
              </div>
              {provFixApiRuleMsg && (
                <p className="text-[11px] font-semibold text-amber-800">{provFixApiRuleMsg}</p>
              )}
            </div>
          )}

          {provAudit && (
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-slate-50/50">
              <button
                type="button"
                onClick={() => setShowAuditDetails(!showAuditDetails)}
                className="w-full px-3.5 py-2.5 flex items-center justify-between text-xs font-bold text-slate-700 hover:bg-slate-100/50 transition-colors cursor-pointer"
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
                <div className="px-3.5 pb-3 pt-1 space-y-1.5 border-t border-slate-200/60">
                  {Object.entries(provAudit).map(([key, item]: [string, any]) => {
                    const isOk = item?.status === 'success';
                    return (
                      <div key={key} className="flex items-start gap-2 text-[11px]">
                        {isOk ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                        )}
                        <span className={isOk ? 'text-slate-600' : 'text-amber-700 font-medium'}>
                          {item?.message || key}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {provStage === 'select' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-800 flex items-center justify-between">
                  <span>1. Selecione a Interface / Bridge LAN do Hotspot:</span>
                  <span className="text-[11px] font-normal text-slate-400">Onde os clientes Wi-Fi se conectam</span>
                </label>
                {provLoading ? (
                  <div className="p-6 rounded-xl border border-slate-200 text-center space-y-2">
                    <RefreshCw className="w-5 h-5 text-blue-500 animate-spin mx-auto" />
                    <p className="text-xs text-slate-500 font-medium">Carregando interfaces do MikroTik...</p>
                  </div>
                ) : provFetchError ? (
                  <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                    {provFetchError}
                  </div>
                ) : provInterfaces.length === 0 ? (
                  <div className="p-4 rounded-xl bg-slate-50 text-center text-xs text-slate-400">
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
                              ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 shadow-xs'
                              : 'border-slate-200 bg-slate-50/50 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span className={`w-2 h-2 rounded-full ${iface.running ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-slate-900">{iface.name}</span>
                                {iface.isBridge && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 uppercase">
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
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
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
                <label className="text-xs font-bold text-slate-800">
                  2. Gateway IP para a Rede Hotspot (LAN):
                </label>
                <input
                  type="text"
                  value={provSuggestedGateway}
                  onChange={(e) => setProvSuggestedGateway(e.target.value)}
                  placeholder="192.168.88.1"
                  className="w-full text-xs font-mono px-3 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>

              <button
                type="button"
                onClick={handleProvision}
                disabled={!provSelectedWan || provLoading}
                className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white font-bold text-xs cursor-pointer disabled:opacity-40 shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              >
                <Zap className="w-4 h-4 fill-white" />
                <span>Iniciar Provisionamento Inteligente</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              {!provLoading && !provFetchError && (
                <button
                  type="button"
                  onClick={fetchInterfaces}
                  className="w-full py-2 text-xs font-semibold text-slate-500 hover:text-slate-700 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Recarregar Interfaces
                </button>
              )}
            </div>
          )}

          {(provStage === 'running' || provStage === 'reconnecting' || provStage === 'done' || provStage === 'error') && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                {provSteps.map((s) => (
                  <div key={s.name} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-800">{s.label}</span>
                      {s.status === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                      {s.status === 'running' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
                      {s.status === 'failed' && <AlertCircle className="w-4 h-4 text-red-500" />}
                      {s.status === 'pending' && <Clock className="w-4 h-4 text-slate-400" />}
                      {s.status === 'skipped' && <span className="text-[10px] text-slate-400 font-normal">Pulado</span>}
                    </div>
                    {s.message && <p className="text-[11px] text-slate-500">{s.message}</p>}
                  </div>
                ))}
              </div>

              {provReconnectStatus && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>{provReconnectStatus}</span>
                </div>
              )}

              {provStage === 'done' && (
                <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-900 space-y-3">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span>Hotspot Provisionado com Sucesso!</span>
                  </div>
                  <p className="text-[11px] text-emerald-800 leading-relaxed">
                    O roteador MikroTik está totalmente configurado e respondendo na bridge{' '}
                    <strong>{provSelectedWan?.name}</strong>. O bypass para o servidor e os serviços de DHCP e Hotspot estão ativos!
                  </p>
                  {provSummary && (
                    <div className="bg-white/60 p-2.5 rounded-lg font-mono text-[11px] space-y-1">
                      <div>Gateway: {provSummary.gatewayIp}</div>
                      <div>Interface: {provSummary.lanBridge}</div>
                      <div>DNS Portal: {provSummary.dnsPortal}</div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleResetProvision}
                      className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer"
                    >
                      Concluir
                    </button>
                    <Link
                      href="/dashboard/portal"
                      className="flex-1 py-2 rounded-lg bg-white border border-emerald-300 text-emerald-700 font-bold text-xs cursor-pointer text-center hover:bg-emerald-50 transition-colors"
                    >
                      Ir para o Portal Studio
                    </Link>
                  </div>
                </div>
              )}

              {provStage === 'error' && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-300 text-xs text-red-900 space-y-2">
                  <span className="font-bold block">Falha no Provisionamento:</span>
                  <p className="text-[11px] text-red-700">{provErrorMsg}</p>
                  <button
                    type="button"
                    onClick={handleResetProvision}
                    className="w-full py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs cursor-pointer"
                  >
                    Tentar Novamente
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center shrink-0">
            <Wifi className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Bridge LAN</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Cria ou verifica a bridge onde os clientes Wi-Fi se conectam.</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Firewall e DHCP</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Configura pools de IP, servidor DHCP e regras de firewall do hotspot.</p>
          </div>
        </div>
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-800">Servidor Hotspot</p>
            <p className="text-[11px] text-slate-500 mt-0.5">Ativa o servidor hotspot MikroTik com o perfil MikroGestor.</p>
          </div>
        </div>
      </div>
    </main>
  );
}
