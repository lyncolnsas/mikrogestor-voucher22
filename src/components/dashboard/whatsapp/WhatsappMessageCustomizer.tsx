"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  MessageSquare, Sparkles, RefreshCcw, Save, RotateCcw,
  CheckCircle2, AlertCircle, Tag, Eye, Info, Check,
  Clock, ArrowRight, Sliders, ToggleLeft, ToggleRight,
  ShieldCheck, Zap, UserCheck, ShoppingCart, Bot,
  Image as ImageIcon, Video, Music, FileText, Library, X, Shuffle, ChevronDown, ChevronUp
} from 'lucide-react';
import { spinText, hasSpintax } from '@/utils/spintax';

interface TriggerTag {
  tag: string;
  label: string;
  example: string;
}

interface MessageTrigger {
  id: string;
  key: string;
  mode: 'free' | 'paid';
  category: 'hotspot' | 'sales' | 'finance' | 'chatbot' | 'support';
  categoryLabel: string;
  title: string;
  triggerEvent: string;
  description: string;
  defaultTemplate: string;
  currentTemplate: string;
  isCustomized: boolean;
  availableTags: TriggerTag[];
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'audio' | 'document';
  forwardLibraryId?: string;
}

interface FlowStepConfig {
  id: string;
  name: string;
  key: string;
  enabled: boolean;
  delaySeconds: number;
}

interface TriggerFlowConfig {
  enabled: boolean;
  steps: FlowStepConfig[];
}

interface SystemFlowMap {
  welcome_paid: TriggerFlowConfig;
  welcome_free: TriggerFlowConfig;
  pix_generated: { enabled: boolean; key: string };
  payment_approved: { enabled: boolean; key: string };
  voucher_paid: { enabled: boolean; key: string };
  voucher_free: { enabled: boolean; key: string };
  chatbot_paid: { enabled: boolean; key: string };
  chatbot_free: { enabled: boolean; key: string };
}

export function WhatsappMessageCustomizer() {
  const [triggers, setTriggers] = useState<MessageTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMode, setSelectedMode] = useState<'paid' | 'free'>('paid');
  const [activeSystemMode, setActiveSystemMode] = useState<'paid' | 'free'>('paid');
  const [updatingSystemMode, setUpdatingSystemMode] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>('WA_MSG_WELCOME_PAID');
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [editedMediaUrls, setEditedMediaUrls] = useState<Record<string, string>>({});
  const [editedMediaTypes, setEditedMediaTypes] = useState<Record<string, 'image' | 'video' | 'audio' | 'document'>>({});
  const [editedForwardIds, setEditedForwardIds] = useState<Record<string, string>>({});
  const [mediaTab, setMediaTab] = useState<Record<string, 'url' | 'library'>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [showAdvancedSteps, setShowAdvancedSteps] = useState(false);

  // Biblioteca de Mídias
  interface LibItem { id: string; caption: string | null; mediaType: string; mimeType: string | null; thumbnailUrl: string | null; createdAt: string; }
  interface ConfiguredGroup {
    instanceId: string;
    instanceName: string;
    number?: string | null;
    groupJid: string;
    groupName: string;
    status: string;
  }
  const [libraryItems, setLibraryItems] = useState<LibItem[]>([]);
  const [configuredGroups, setConfiguredGroups] = useState<ConfiguredGroup[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryTargetKey, setLibraryTargetKey] = useState<string>('');
  const [feedback, setFeedback] = useState<{ key: string; success: boolean; message: string } | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  // Régua / Fluxograma
  const [flowMap, setFlowMap] = useState<SystemFlowMap | null>(null);
  const [savingFlow, setSavingFlow] = useState(false);
  const [previewSeed, setPreviewSeed] = useState(0);

  const fetchTemplates = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/whatsapp-messages')
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.triggers) {
          setTriggers(data.triggers);
          if (data.flowConfig) {
            setFlowMap(data.flowConfig);
          }
          if (data.activeSystemMode) {
            setActiveSystemMode(data.activeSystemMode);
            setSelectedMode(data.activeSystemMode);
          }
          const initialMap: Record<string, string> = {};
          const mediaUrlMap: Record<string, string> = {};
          const mediaTypeMap: Record<string, 'image' | 'video' | 'audio' | 'document'> = {};
          const forwardIdMap: Record<string, string> = {};
          const tabMap: Record<string, 'url' | 'library'> = {};
          data.triggers.forEach((t: MessageTrigger) => {
            initialMap[t.key] = t.currentTemplate;
            if (t.mediaUrl) mediaUrlMap[t.key] = t.mediaUrl;
            if (t.mediaType) mediaTypeMap[t.key] = t.mediaType;
            if (t.forwardLibraryId) {
              forwardIdMap[t.key] = t.forwardLibraryId;
              tabMap[t.key] = 'library';
            }
          });
          setEditedTemplates(initialMap);
          setEditedMediaUrls(mediaUrlMap);
          setEditedMediaTypes(mediaTypeMap);
          setEditedForwardIds(forwardIdMap);
          setMediaTab(tabMap);

          const defaultKey = data.activeSystemMode === 'free' ? 'WA_MSG_WELCOME_FREE' : 'WA_MSG_WELCOME_PAID';
          setSelectedKey(defaultKey);
        }
      })
      .catch((err) => console.error('Erro ao carregar mensagens:', err))
      .finally(() => setLoading(false));
  }, []);

  const fetchLibrary = useCallback(() => {
    setLibraryLoading(true);
    fetch('/api/admin/media-library')
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setLibraryItems(data.items || []);
          if (Array.isArray(data.configuredGroups)) {
            setConfiguredGroups(data.configuredGroups);
          }
        }
      })
      .catch(console.error)
      .finally(() => setLibraryLoading(false));
  }, []);

  useEffect(() => {
    let ignore = false;
    const run = async () => {
      if (!ignore) {
        await fetchTemplates();
        await fetchLibrary();
      }
    };
    run();
    return () => { ignore = true; };
  }, [fetchTemplates, fetchLibrary]);

  const handleModeChange = (mode: 'paid' | 'free') => {
    setSelectedMode(mode);
    setSelectedKey(mode === 'paid' ? 'WA_MSG_WELCOME_PAID' : 'WA_MSG_WELCOME_FREE');
  };

  const handleToggleSystemMode = async (newMode: 'paid' | 'free') => {
    setUpdatingSystemMode(true);
    try {
      const res = await fetch('/api/admin/whatsapp-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setActiveMode', mode: newMode }),
      });
      const data = await res.json();
      if (data.success) {
        setActiveSystemMode(newMode);
        setSelectedMode(newMode);
        setSelectedKey(newMode === 'paid' ? 'WA_MSG_WELCOME_PAID' : 'WA_MSG_WELCOME_FREE');
        setFeedback({ key: 'SYSTEM_MODE', success: true, message: data.message });
      } else {
        setFeedback({ key: 'SYSTEM_MODE', success: false, message: data.message || 'Erro ao alterar modo' });
      }
    } catch {
      setFeedback({ key: 'SYSTEM_MODE', success: false, message: 'Falha na conexão' });
    } finally {
      setUpdatingSystemMode(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleToggleStep = (flowKey: 'welcome_paid' | 'welcome_free', stepId: string) => {
    if (!flowMap) return;
    setFlowMap((prev) => {
      if (!prev) return prev;
      const targetFlow = prev[flowKey];
      const updatedSteps = targetFlow.steps.map((s) =>
        s.id === stepId ? { ...s, enabled: !s.enabled } : s
      );
      return { ...prev, [flowKey]: { ...targetFlow, steps: updatedSteps } };
    });
  };

  const handleSaveFlow = async () => {
    if (!flowMap) return;
    setSavingFlow(true);
    try {
      const res = await fetch('/api/admin/whatsapp-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'saveFlow', flowConfig: flowMap }),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ key: 'FLOW_SAVE', success: true, message: data.message });
      } else {
        setFeedback({ key: 'FLOW_SAVE', success: false, message: data.message || 'Erro ao salvar' });
      }
    } catch {
      setFeedback({ key: 'FLOW_SAVE', success: false, message: 'Falha na conexão' });
    } finally {
      setSavingFlow(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const currentTrigger = useMemo(() => {
    return triggers.find((t) => t.key === selectedKey) || triggers[0];
  }, [triggers, selectedKey]);

  const handleTemplateChange = (key: string, value: string) => {
    setEditedTemplates((prev) => ({ ...prev, [key]: value }));
  };

  const handleInsertTag = (tag: string) => {
    if (!currentTrigger) return;
    const current = editedTemplates[currentTrigger.key] || '';
    handleTemplateChange(currentTrigger.key, current + ' ' + tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const handleSave = async (trigger: MessageTrigger) => {
    setSavingKey(trigger.key);
    try {
      const template = editedTemplates[trigger.key] ?? trigger.currentTemplate;
      const currentTab = mediaTab[trigger.key] || 'url';
      const forwardLibraryId = currentTab === 'library' ? (editedForwardIds[trigger.key] ?? trigger.forwardLibraryId ?? '') : '';
      const mediaUrl = currentTab === 'url' ? (editedMediaUrls[trigger.key] ?? trigger.mediaUrl ?? '') : '';
      const mediaType = editedMediaTypes[trigger.key] ?? trigger.mediaType ?? 'image';

      const res = await fetch('/api/admin/whatsapp-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trigger.key, template, action: 'save', mediaUrl, mediaType, forwardLibraryId }),
      });
      const data = await res.json();
      if (data.success) {
        setTriggers((prev) =>
          prev.map((t) =>
            t.key === trigger.key
              ? { ...t, currentTemplate: template, isCustomized: data.isCustomized, mediaUrl, mediaType, forwardLibraryId }
              : t
          )
        );
        setFeedback({ key: trigger.key, success: true, message: 'Mensagem salva com sucesso!' });
      } else {
        setFeedback({ key: trigger.key, success: false, message: data.message || 'Erro ao salvar' });
      }
    } catch {
      setFeedback({ key: trigger.key, success: false, message: 'Falha na requisição' });
    } finally {
      setSavingKey(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const handleReset = async (trigger: MessageTrigger) => {
    if (!confirm(`Restaurar a mensagem "${trigger.title}" para o modelo original limpo?`)) return;
    setSavingKey(trigger.key);
    try {
      const res = await fetch('/api/admin/whatsapp-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: trigger.key, action: 'reset' }),
      });
      const data = await res.json();
      if (data.success) {
        handleTemplateChange(trigger.key, trigger.defaultTemplate);
        setEditedMediaUrls((prev) => ({ ...prev, [trigger.key]: '' }));
        setEditedMediaTypes((prev) => ({ ...prev, [trigger.key]: 'image' }));
        setEditedForwardIds((prev) => ({ ...prev, [trigger.key]: '' }));
        setMediaTab((prev) => ({ ...prev, [trigger.key]: 'url' }));
        setTriggers((prev) =>
          prev.map((t) =>
            t.key === trigger.key
              ? { ...t, currentTemplate: trigger.defaultTemplate, isCustomized: false, mediaUrl: '', mediaType: 'image', forwardLibraryId: '' }
              : t
          )
        );
        setFeedback({ key: trigger.key, success: true, message: 'Modelo original restaurado!' });
      }
    } catch {
      setFeedback({ key: trigger.key, success: false, message: 'Erro ao restaurar' });
    } finally {
      setSavingKey(null);
      setTimeout(() => setFeedback(null), 4000);
    }
  };

  const openLibraryModal = (triggerKey: string) => {
    setLibraryTargetKey(triggerKey);
    setShowLibraryModal(true);
    if (libraryItems.length === 0) fetchLibrary();
  };

  const selectLibraryItem = (item: { id: string; caption: string | null; mediaType: string }) => {
    setEditedForwardIds((prev) => ({ ...prev, [libraryTargetKey]: item.id }));
    setMediaTab((prev) => ({ ...prev, [libraryTargetKey]: 'library' }));
    setShowLibraryModal(false);
  };

  const mediaTypeIcon = (type: string) => {
    if (type === 'video') return <Video className="w-4 h-4" />;
    if (type === 'audio') return <Music className="w-4 h-4" />;
    if (type === 'document') return <FileText className="w-4 h-4" />;
    return <ImageIcon className="w-4 h-4" />;
  };

  const renderPreview = (text: string, tags: TriggerTag[]) => {
    let preview = text;
    tags.forEach((t) => {
      const regex = new RegExp(t.tag.replace(/[{}]/g, '\\$&'), 'gi');
      preview = preview.replace(regex, t.example);
    });
    return spinText(preview);
  };

  if (loading) {
    return (
      <div className="py-16 flex flex-col items-center justify-center gap-3 text-slate-500">
        <RefreshCcw className="w-8 h-8 animate-spin text-emerald-600" />
        <p className="text-xs uppercase tracking-wider font-semibold text-slate-600">
          Carregando mensagens da régua...
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6 animate-fade-in">
        {/* ── Top Bar: Modo Simplificado de Produção ────────────────────────── */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-slate-900 text-white">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900">
                Personalização de Mensagens WhatsApp
              </h2>
              <p className="text-xs text-slate-500">
                Escolha a etapa da jornada do cliente para editar o texto e ver a simulação no celular.
              </p>
            </div>
          </div>

          {/* Alternador de Modo: Venda vs Grátis */}
          <div className="flex items-center gap-2 p-1 bg-slate-100/90 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => handleModeChange('paid')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedMode === 'paid'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>💳 Venda de Planos (PIX)</span>
              {activeSystemMode === 'paid' && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleModeChange('free')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                selectedMode === 'free'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🎁 Evento Gratuito</span>
              {activeSystemMode === 'free' && (
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              )}
            </button>
          </div>
        </div>

        {feedback && feedback.key === 'SYSTEM_MODE' && (
          <div className="p-3 rounded-xl border text-xs font-bold flex items-center gap-2 bg-emerald-50 border-emerald-300 text-emerald-800 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{feedback.message}</span>
          </div>
        )}

        {/* ── Grid Principal de 2 Colunas: Jornada vs Editor ────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* COLUNA ESQUERDA: JORNADA DO CLIENTE (3 ETAPAS CLARAS) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-widest">
                Jornada do Cliente no Wi-Fi
              </span>
              <span className="text-[10px] font-bold text-slate-400">
                Selecione para editar
              </span>
            </div>

            {/* ETAPA 1: ENTRADA NO WI-FI */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    {selectedMode === 'paid' ? 'Cadastro & Boas-Vindas' : 'Acesso Gratuito Conectado'}
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Disparado assim que o cliente clica em Conectar no portal
                  </p>
                </div>
              </div>

              {/* Card Selecionável da Mensagem Principal */}
              {(() => {
                const welcomeKey = selectedMode === 'paid' ? 'WA_MSG_WELCOME_PAID' : 'WA_MSG_WELCOME_FREE';
                const trig = triggers.find(t => t.key === welcomeKey);
                const isSelected = selectedKey === welcomeKey;
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedKey(welcomeKey)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? selectedMode === 'paid'
                          ? 'bg-amber-50/80 border-amber-500 shadow-2xs'
                          : 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          {selectedMode === 'paid' ? '🔑 Mensagem com Login & Cortesia' : '🎁 Mensagem de Boas-Vindas'}
                        </span>
                        {trig?.isCustomized && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            Editado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {selectedMode === 'paid'
                          ? 'Envia usuário, senha, 15 min de cortesia e link de compra'
                          : 'Confirma acesso liberado e instruções simples'}
                      </p>
                    </div>
                    <ArrowRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                  </button>
                );
              })()}

              {/* Gaveta Recolhível para Passos Secundários / Avançados */}
              <div className="border-t border-slate-100 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdvancedSteps(!showAdvancedSteps)}
                  className="w-full text-left flex items-center justify-between text-[11px] font-bold text-slate-500 hover:text-slate-700 py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1">
                    <Sliders className="w-3 h-3" />
                    Opções Avançadas da Régua (Lembretes)
                  </span>
                  {showAdvancedSteps ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showAdvancedSteps && (
                  <div className="pt-2 space-y-2 animate-fade-in">
                    {selectedMode === 'paid' ? (
                      <>
                        {/* Passo 2: Link Isolado */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedKey('WA_MSG_WELCOME_STEP2_PAID')}
                            className="text-left flex-1 min-w-0 cursor-pointer"
                          >
                            <span className="text-[11px] font-bold text-slate-800 block truncate">
                              Passo 2: Link de Planos Isolado
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Envia link avulso 10s após a cortesia
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStep('welcome_paid', 'step_2')}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
                              flowMap?.welcome_paid.steps.find(s => s.id === 'step_2')?.enabled
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}
                          >
                            {flowMap?.welcome_paid.steps.find(s => s.id === 'step_2')?.enabled ? 'Ativo' : 'Desligado'}
                          </button>
                        </div>

                        {/* Passo 3: Lembrete de Cortesia */}
                        <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setSelectedKey('WA_MSG_WELCOME_STEP3_PAID')}
                            className="text-left flex-1 min-w-0 cursor-pointer"
                          >
                            <span className="text-[11px] font-bold text-slate-800 block truncate">
                              Passo 3: Lembrete de Expiração
                            </span>
                            <span className="text-[10px] text-slate-400 block">
                              Avisa minutos antes da cortesia vencer
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleStep('welcome_paid', 'step_3')}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
                              flowMap?.welcome_paid.steps.find(s => s.id === 'step_3')?.enabled
                                ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                : 'bg-slate-200 text-slate-600 border-slate-300'
                            }`}
                          >
                            {flowMap?.welcome_paid.steps.find(s => s.id === 'step_3')?.enabled ? 'Ativo' : 'Desligado'}
                          </button>
                        </div>

                        <div className="flex justify-end pt-1">
                          <button
                            type="button"
                            onClick={handleSaveFlow}
                            disabled={savingFlow}
                            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-3 h-3" />
                            {savingFlow ? 'Salvando...' : 'Salvar Regras da Régua'}
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={() => setSelectedKey('WA_MSG_WELCOME_STEP2_FREE')}
                          className="text-left flex-1 min-w-0 cursor-pointer"
                        >
                          <span className="text-[11px] font-bold text-slate-800 block truncate">
                            Passo 2: Engajamento Social
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            Convite para redes sociais após conectar
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleToggleStep('welcome_free', 'step_2')}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded border cursor-pointer ${
                            flowMap?.welcome_free.steps.find(s => s.id === 'step_2')?.enabled
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : 'bg-slate-200 text-slate-600 border-slate-300'
                          }`}
                        >
                          {flowMap?.welcome_free.steps.find(s => s.id === 'step_2')?.enabled ? 'Ativo' : 'Desligado'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* ETAPA 2: COBRANÇA & PAGAMENTO PIX */}
            {selectedMode === 'paid' ? (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Venda, PIX & Ativação de Plano
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Mensagens de compra e confirmação financeira
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {/* PIX Gerado */}
                  {(() => {
                    const isSelected = selectedKey === 'WA_MSG_PIX_GENERATED';
                    const trig = triggers.find(t => t.key === 'WA_MSG_PIX_GENERATED');
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedKey('WA_MSG_PIX_GENERATED')}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-500 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              ⚡ Chave PIX Copia e Cola
                            </span>
                            {trig?.isCustomized && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                Editado
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            Disparado quando o cliente escolhe um plano no portal
                          </p>
                        </div>
                        <ArrowRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                      </button>
                    );
                  })()}

                  {/* Pagamento Confirmado */}
                  {(() => {
                    const isSelected = selectedKey === 'WA_MSG_PAYMENT_APPROVED_HOTSPOT';
                    const trig = triggers.find(t => t.key === 'WA_MSG_PAYMENT_APPROVED_HOTSPOT');
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedKey('WA_MSG_PAYMENT_APPROVED_HOTSPOT')}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              🎉 Pagamento Aprovado (Liberação)
                            </span>
                            {trig?.isCustomized && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                Editado
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            Avisa que o banco confirmou e o tempo total está liberado
                          </p>
                        </div>
                        <ArrowRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-emerald-600' : 'text-slate-400'}`} />
                      </button>
                    );
                  })()}

                  {/* Entrega de Voucher Pago */}
                  {(() => {
                    const isSelected = selectedKey === 'WA_MSG_VOUCHER_DELIVERY';
                    const trig = triggers.find(t => t.key === 'WA_MSG_VOUCHER_DELIVERY');
                    return (
                      <button
                        type="button"
                        onClick={() => setSelectedKey('WA_MSG_VOUCHER_DELIVERY')}
                        className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                          isSelected
                            ? 'bg-amber-50/80 border-amber-500 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              🎟️ Entrega de Voucher Pago
                            </span>
                            {trig?.isCustomized && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                                Editado
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-slate-500 truncate mt-0.5">
                            Envio de código PIN gerado pelo painel
                          </p>
                        </div>
                        <ArrowRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                      </button>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold text-xs">
                    2
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Sorteios & Vouchers de Cortesia
                    </h4>
                    <p className="text-[10px] text-slate-500">
                      Engajamento e premiação de visitantes do evento
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setSelectedKey('WA_MSG_RAFFLE_WINNER_FREE')}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                      selectedKey === 'WA_MSG_RAFFLE_WINNER_FREE'
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        🎁 Notificação de Sorteado no Evento
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                        Disparo ao sortear um lead pelo painel
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedKey('WA_MSG_VOUCHER_DELIVERY_FREE')}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                      selectedKey === 'WA_MSG_VOUCHER_DELIVERY_FREE'
                        ? 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <span className="text-xs font-bold text-slate-900 block truncate">
                        🎟️ Passe Livre / Voucher Gratuito
                      </span>
                      <span className="text-[11px] text-slate-500 block truncate mt-0.5">
                        Envio de passe para convidados
                      </span>
                    </div>
                    <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />
                  </button>
                </div>
              </div>
            )}

            {/* ETAPA 3: AUTOATENDIMENTO (CHATBOT) */}
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-black text-slate-900">
                    Atendimento & Chatbot Automático
                  </h4>
                  <p className="text-[10px] text-slate-500">
                    Quando o cliente manda mensagem de texto para qualquer um dos seus números
                  </p>
                </div>
              </div>

              {(() => {
                const chatbotKey = selectedMode === 'paid' ? 'WA_MSG_CHATBOT_GREETING_PAID' : 'WA_MSG_CHATBOT_GREETING_FREE';
                const isSelected = selectedKey === chatbotKey;
                const trig = triggers.find(t => t.key === chatbotKey);
                return (
                  <button
                    type="button"
                    onClick={() => setSelectedKey(chatbotKey)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-between ${
                      isSelected
                        ? selectedMode === 'paid'
                          ? 'bg-amber-50/80 border-amber-500 shadow-2xs'
                          : 'bg-emerald-50/80 border-emerald-500 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 truncate">
                          🤖 Resposta Automática Inicial
                        </span>
                        {trig?.isCustomized && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 border border-amber-300">
                            Editado
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        {selectedMode === 'paid'
                          ? 'Recepciona com link do portal e oferece venda direta'
                          : 'Direciona diretamente para o acesso Wi-Fi gratuito'}
                      </p>
                    </div>
                    <ArrowRight className={`w-4 h-4 shrink-0 ${isSelected ? 'text-amber-600' : 'text-slate-400'}`} />
                  </button>
                );
              })()}
            </div>
          </div>

          {/* COLUNA DIREITA: ESTÚDIO DE EDIÇÃO & PREVIEW AO VIVO */}
          {currentTrigger && (
            <div className="lg:col-span-7 space-y-4">
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                {/* Cabeçalho Limpo da Mensagem Selecionada */}
                <div className="border-b border-slate-100 pb-4">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {currentTrigger.categoryLabel}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {currentTrigger.key}
                    </span>
                  </div>
                  <h3 className="text-base font-black text-slate-900">
                    {currentTrigger.title}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {currentTrigger.triggerEvent}
                  </p>
                </div>

                {/* Tags Dinâmicas Clicáveis */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      Tags Dinâmicas (Clique para inserir no texto):
                    </label>
                    {copiedTag && (
                      <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 animate-fade-in">
                        <Check className="w-3 h-3" /> Inserido!
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {currentTrigger.availableTags.map((t) => (
                      <button
                        key={t.tag}
                        type="button"
                        onClick={() => handleInsertTag(t.tag)}
                        title={`Insere ${t.tag} (Exemplo: ${t.example})`}
                        className="px-2.5 py-1 rounded-lg border text-xs font-mono font-bold bg-slate-50 hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs"
                      >
                        <span className="text-emerald-700 font-black">{t.tag}</span>
                        <span className="text-[10px] font-sans font-medium text-slate-500">
                          ({t.label})
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Caixa de Texto do WhatsApp */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">
                      Texto da Mensagem:
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const spintaxSample = '{Olá|Oi|E aí}, {cliente}!';
                        const current = editedTemplates[currentTrigger.key] || '';
                        handleTemplateChange(currentTrigger.key, current ? `${current}\n${spintaxSample}` : spintaxSample);
                      }}
                      className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded border border-indigo-200 transition-colors cursor-pointer"
                    >
                      + Inserir Variação Anti-Ban (Spintax)
                    </button>
                  </div>

                  <textarea
                    rows={7}
                    value={editedTemplates[currentTrigger.key] ?? currentTrigger.currentTemplate}
                    onChange={(e) => handleTemplateChange(currentTrigger.key, e.target.value)}
                    placeholder="Digite o texto da mensagem..."
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-xl p-3.5 text-xs font-mono text-slate-900 focus:outline-none transition-colors leading-relaxed"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>Use <code className="text-slate-700 font-bold">*negrito*</code>, <code className="text-slate-700 font-bold">_itálico_</code> ou <code className="text-slate-700 font-bold">`código`</code>.</span>
                    {hasSpintax(editedTemplates[currentTrigger.key] ?? currentTrigger.currentTemplate) && (
                      <span className="text-indigo-600 font-bold flex items-center gap-1">
                        <ShieldCheck className="w-3.5 h-3.5" /> Spintax ativo
                      </span>
                    )}
                  </div>
                </div>

                {/* Anexo de Mídia Enxuto */}
                <div className="space-y-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                      <Sliders className="w-3.5 h-3.5 text-slate-500" />
                      Anexo de Foto ou Banner (Opcional)
                    </label>

                    <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px] font-bold">
                      <button
                        type="button"
                        onClick={() => setMediaTab(p => ({ ...p, [currentTrigger.key]: 'url' }))}
                        className={`px-3 py-1 cursor-pointer transition-colors ${(mediaTab[currentTrigger.key] || 'url') === 'url' ? 'bg-slate-800 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                      >
                        Link URL
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setMediaTab(p => ({ ...p, [currentTrigger.key]: 'library' }));
                          openLibraryModal(currentTrigger.key);
                        }}
                        className={`px-3 py-1 flex items-center gap-1 cursor-pointer transition-colors ${(mediaTab[currentTrigger.key] || 'url') === 'library' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
                      >
                        <Library className="w-3 h-3" /> Biblioteca
                      </button>
                    </div>
                  </div>

                  {(mediaTab[currentTrigger.key] || 'url') === 'url' ? (
                    <div className="flex gap-2">
                      <select
                        value={editedMediaTypes[currentTrigger.key] ?? currentTrigger.mediaType ?? 'image'}
                        onChange={(e) => setEditedMediaTypes((prev) => ({ ...prev, [currentTrigger.key]: e.target.value as any }))}
                        className="bg-white border border-slate-300 rounded-lg px-2.5 h-9 text-xs font-semibold text-slate-800"
                      >
                        <option value="image">Imagem</option>
                        <option value="video">Vídeo</option>
                        <option value="audio">Áudio</option>
                        <option value="document">Documento</option>
                      </select>
                      <input
                        type="url"
                        value={editedMediaUrls[currentTrigger.key] ?? currentTrigger.mediaUrl ?? ''}
                        onChange={(e) => setEditedMediaUrls((prev) => ({ ...prev, [currentTrigger.key]: e.target.value }))}
                        placeholder="Link público da imagem (https://...)"
                        className="flex-1 bg-white border border-slate-300 rounded-lg px-3 h-9 text-xs font-mono text-slate-800"
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      {editedForwardIds[currentTrigger.key] || currentTrigger.forwardLibraryId ? (() => {
                        const selId = editedForwardIds[currentTrigger.key] || currentTrigger.forwardLibraryId || '';
                        const item = libraryItems.find(i => i.id === selId);
                        return (
                          <div className="flex-1 flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                            <div className="text-emerald-600">{mediaTypeIcon(item?.mediaType || 'image')}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate">{item?.caption || 'Mídia selecionada'}</p>
                              <p className="text-[10px] text-slate-400">{item?.mediaType?.toUpperCase()}</p>
                            </div>
                            <button type="button" onClick={() => openLibraryModal(currentTrigger.key)} className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer">Trocar</button>
                            <button type="button" onClick={() => { setEditedForwardIds(p => ({ ...p, [currentTrigger.key]: '' })); setMediaTab(p => ({ ...p, [currentTrigger.key]: 'url' })); }} className="text-slate-400 hover:text-red-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        );
                      })() : (
                        <button type="button" onClick={() => openLibraryModal(currentTrigger.key)} className="flex-1 border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl py-2.5 text-xs text-slate-600 hover:text-emerald-700 flex items-center justify-center gap-2 cursor-pointer transition-colors bg-white">
                          <Library className="w-4 h-4 text-emerald-600" /> Escolher Mídia da Biblioteca Central
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Botões de Ação */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => handleReset(currentTrigger)}
                    disabled={savingKey === currentTrigger.key}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 transition-colors"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Restaurar Original
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSave(currentTrigger)}
                    disabled={savingKey === currentTrigger.key}
                    className="px-6 py-2.5 rounded-xl text-xs font-black text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    {savingKey === currentTrigger.key ? 'Salvando...' : 'Salvar Alterações'}
                  </button>
                </div>

                {feedback && feedback.key === currentTrigger.key && (
                  <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
                    feedback.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}>
                    {feedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertCircle className="w-4 h-4 text-rose-600" />}
                    <span>{feedback.message}</span>
                  </div>
                )}

                {/* Simulação em Tela do Celular (WhatsApp Real Preview) */}
                <div className="pt-2 border-t border-slate-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                      <Eye className="w-4 h-4 text-emerald-600" />
                      Visualização no Celular do Cliente:
                    </div>
                    {hasSpintax(editedTemplates[currentTrigger.key] ?? currentTrigger.currentTemplate) && (
                      <button
                        type="button"
                        onClick={() => setPreviewSeed(s => s + 1)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer"
                      >
                        <Shuffle className="w-3.5 h-3.5" /> Sortear Variação
                      </button>
                    )}
                  </div>

                  <div className="rounded-2xl p-4 border border-emerald-950/10 shadow-inner" style={{ backgroundColor: '#E5DDD5' }}>
                    <div key={previewSeed} className="max-w-md bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-xs text-slate-900 space-y-1.5 font-sans leading-relaxed whitespace-pre-wrap border border-black/5 animate-fade-in">
                      {renderPreview(
                        editedTemplates[currentTrigger.key] ?? currentTrigger.currentTemplate,
                        currentTrigger.availableTags
                      )}
                      <div className="text-[10px] text-slate-400 text-right font-mono mt-1">
                        12:00 ✓✓
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal da Biblioteca de Mídias */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowLibraryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Library className="w-5 h-5 text-emerald-600" />
                <h3 className="text-sm font-bold text-slate-800">Biblioteca de Mídias Central</h3>
                <span className="text-[11px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">{libraryItems.length} mídias</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchLibrary}
                  disabled={libraryLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer disabled:opacity-50"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${libraryLoading ? 'animate-spin' : ''}`} /> Atualizar
                </button>
                <button type="button" onClick={() => setShowLibraryModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {libraryLoading ? (
                <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
                  <RefreshCcw className="w-4 h-4 animate-spin" /> Carregando mídias...
                </div>
              ) : libraryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                  <Library className="w-10 h-10 text-slate-200" />
                  <p className="text-sm font-semibold text-slate-600">Nenhuma mídia capturada ainda</p>
                  <p className="text-[11px] text-slate-500 max-w-sm">
                    Envie uma foto ou banner no grupo do WhatsApp vinculado e clique em Atualizar.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {libraryItems.map(item => (
                    <button key={item.id} type="button" onClick={() => selectLibraryItem(item)} className="group relative flex flex-col bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-xl overflow-hidden transition-all cursor-pointer text-left">
                      <div className="w-full aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                        {item.thumbnailUrl ? (
                          <img src={item.thumbnailUrl} alt={item.caption || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="text-slate-300">{mediaTypeIcon(item.mediaType)}</div>
                        )}
                      </div>
                      <div className="p-2">
                        <p className="text-[11px] font-semibold text-slate-700 truncate">{item.caption || '(sem legenda)'}</p>
                        <p className="text-[10px] text-slate-400">{item.mediaType.toUpperCase()}</p>
                      </div>
                      <div className="absolute inset-0 bg-emerald-500/0 group-hover:bg-emerald-500/10 transition-colors flex items-center justify-center">
                        <div className="opacity-0 group-hover:opacity-100 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1 rounded-full transition-opacity">
                          Selecionar
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 flex justify-end">
              <button type="button" onClick={() => setShowLibraryModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

