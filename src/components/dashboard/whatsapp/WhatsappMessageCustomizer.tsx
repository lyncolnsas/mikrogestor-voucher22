"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback } from 'react';
import {
  MessageSquare, Sparkles, RefreshCcw, Save, RotateCcw,
  CheckCircle2, AlertCircle, Tag, Eye, Info, Check,
  GitBranch, Clock, ArrowRight, Layers, Sliders, ToggleLeft, ToggleRight,
  ShieldCheck, Zap, UserCheck, ShoppingCart,
  Image as ImageIcon, Video, Music, FileText, Library, X, Shuffle
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
  const [selectedId, setSelectedId] = useState<string>('welcome_paid');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [editedTemplates, setEditedTemplates] = useState<Record<string, string>>({});
  const [editedMediaUrls, setEditedMediaUrls] = useState<Record<string, string>>({});
  const [editedMediaTypes, setEditedMediaTypes] = useState<Record<string, 'image' | 'video' | 'audio' | 'document'>>({});
  const [editedForwardIds, setEditedForwardIds] = useState<Record<string, string>>({});
  const [mediaTab, setMediaTab] = useState<Record<string, 'url' | 'library'>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Estados da Biblioteca de Mídias
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

  // Estados da Régua / Fluxograma
  const [flowMap, setFlowMap] = useState<SystemFlowMap | null>(null);
  const [savingFlow, setSavingFlow] = useState(false);
  const [activeViewTab, setActiveViewTab] = useState<'flowchart' | 'templates'>('flowchart');

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

          const firstInMode = data.triggers.find((t: MessageTrigger) => t.mode === (data.activeSystemMode || 'paid'));
          if (firstInMode) {
            setSelectedId(firstInMode.id);
          }
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

  // Quando o usuário troca de modo (Pago x Free), atualiza o item selecionado para o primeiro daquele modo
  const handleModeChange = (mode: 'paid' | 'free') => {
    setSelectedMode(mode);
    setActiveCategory('all');
    const firstTrigger = triggers.find((t) => t.mode === mode);
    if (firstTrigger) {
      setSelectedId(firstTrigger.id);
    }
  };

  // Alterna o modo ativo do sistema no banco
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
        const firstTrigger = triggers.find((t) => t.mode === newMode);
        if (firstTrigger) {
          setSelectedId(firstTrigger.id);
        }
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

  // Manipulação de Etapas do Fluxograma
  const handleToggleStep = (flowKey: 'welcome_paid' | 'welcome_free', stepId: string) => {
    if (!flowMap) return;
    setFlowMap((prev) => {
      if (!prev) return prev;
      const targetFlow = prev[flowKey];
      const updatedSteps = targetFlow.steps.map((s) =>
        s.id === stepId ? { ...s, enabled: !s.enabled } : s
      );
      return {
        ...prev,
        [flowKey]: { ...targetFlow, steps: updatedSteps },
      };
    });
  };

  const handleUpdateDelay = (flowKey: 'welcome_paid' | 'welcome_free', stepId: string, delaySeconds: number) => {
    if (!flowMap) return;
    setFlowMap((prev) => {
      if (!prev) return prev;
      const targetFlow = prev[flowKey];
      const updatedSteps = targetFlow.steps.map((s) =>
        s.id === stepId ? { ...s, delaySeconds: Math.max(0, delaySeconds) } : s
      );
      return {
        ...prev,
        [flowKey]: { ...targetFlow, steps: updatedSteps },
      };
    });
  };

  const handleToggleMasterTrigger = (key: keyof SystemFlowMap) => {
    if (!flowMap) return;
    setFlowMap((prev) => {
      if (!prev) return prev;
      const item = prev[key];
      return {
        ...prev,
        [key]: { ...item, enabled: !item.enabled },
      };
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
        setFeedback({ key: 'FLOW_SAVE', success: false, message: data.message || 'Erro ao salvar fluxograma' });
      }
    } catch {
      setFeedback({ key: 'FLOW_SAVE', success: false, message: 'Falha na conexão' });
    } finally {
      setSavingFlow(false);
      setTimeout(() => setFeedback(null), 4000);
    }
  };
  const modeTriggers = triggers.filter((t) => t.mode === selectedMode);

  const filteredTriggers =
    activeCategory === 'all'
      ? modeTriggers
      : modeTriggers.filter((t) => t.category === activeCategory);

  const selectedTrigger = modeTriggers.find((t) => t.id === selectedId) || modeTriggers[0];

  const handleTemplateChange = (key: string, value: string) => {
    setEditedTemplates((prev) => ({ ...prev, [key]: value }));
  };

  const handleInsertTag = (tag: string) => {
    if (!selectedTrigger) return;
    const current = editedTemplates[selectedTrigger.key] || '';
    handleTemplateChange(selectedTrigger.key, current + ' ' + tag);
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
        setFeedback({ key: trigger.key, success: true, message: 'Modelo salvo com sucesso!' });
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
    if (!confirm(`Deseja restaurar a mensagem "${trigger.title}" para o padrão original de fábrica?`)) return;
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
        setFeedback({ key: trigger.key, success: true, message: 'Padrão original restaurado!' });
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

  const categories = [
    { id: 'all', label: 'Todos os Gatilhos' },
    { id: 'hotspot', label: 'Portal Hotspot' },
    { id: 'finance', label: 'Vendas & Cobrança' },
    { id: 'sales', label: 'Vouchers & Códigos' },
    { id: 'chatbot', label: 'Chatbot' },
  ];

  const [previewSeed, setPreviewSeed] = useState(0);

  // Preview com simulação das tags e Spintax
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
          Carregando modelos de mensagens e gatilhos...
        </p>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6 animate-fade-in">
      {/* ── Mode Selector Tabs & System Active Mode Switch ────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Mode Selection Tabs */}
        <div className="flex items-center gap-2 p-1 bg-slate-100/90 rounded-2xl border border-slate-200 w-fit">
          <button
            type="button"
            onClick={() => handleModeChange('paid')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              selectedMode === 'paid'
                ? 'bg-amber-500 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <span>💳 Modelos Pagos (Vendas & PIX)</span>
            {activeSystemMode === 'paid' && (
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-white/20 text-white border border-white/30">
                Ativo no Sistema
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => handleModeChange('free')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              selectedMode === 'free'
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
            }`}
          >
            <span>🎁 Modelos Free (Eventos & Grátis)</span>
            {activeSystemMode === 'free' && (
              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-md bg-white/20 text-white border border-white/30">
                Ativo no Sistema
              </span>
            )}
          </button>
        </div>

        {/* Right: Global Portal Mode Setter */}
        <div className="flex items-center gap-3 bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs">
          <div className="flex flex-col">
            <span className="text-[10px] uppercase tracking-wider font-extrabold text-slate-500">
              Modo Atual em Produção:
            </span>
            <span className="font-black text-slate-900 flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${activeSystemMode === 'paid' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500 animate-pulse'}`} />
              {activeSystemMode === 'paid' ? 'Venda de Planos (Pago)' : 'Livre / Evento (Free)'}
            </span>
          </div>

          <div className="h-6 w-px bg-slate-200 mx-1" />

          <button
            type="button"
            disabled={updatingSystemMode}
            onClick={() => handleToggleSystemMode(activeSystemMode === 'paid' ? 'free' : 'paid')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border disabled:opacity-50 ${
              activeSystemMode === 'paid'
                ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-50 hover:bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            {updatingSystemMode
              ? 'Alterando...'
              : activeSystemMode === 'paid'
              ? 'Mudar Sistema para Modo Free'
              : 'Mudar Sistema para Modo Pago'}
          </button>
        </div>
      </div>

      {feedback && feedback.key === 'SYSTEM_MODE' && (
        <div className="p-3 rounded-xl border text-xs font-bold flex items-center gap-2 bg-emerald-50 border-emerald-300 text-emerald-800 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── View Selector: Fluxograma vs Lista de Modelos ─────────────────── */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveViewTab('flowchart')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeViewTab === 'flowchart'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <GitBranch className="w-4 h-4 text-emerald-400" />
            Fluxograma Interativo & Régua de Mensagens
          </button>

          <button
            type="button"
            onClick={() => setActiveViewTab('templates')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-2 ${
              activeViewTab === 'templates'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <Layers className="w-4 h-4 text-amber-400" />
            Editor Completo de Templates ({triggers.length})
          </button>
        </div>

        {activeViewTab === 'flowchart' && (
          <button
            type="button"
            onClick={handleSaveFlow}
            disabled={savingFlow}
            className="px-4 py-2 rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {savingFlow ? 'Salvando Régua...' : 'Salvar Configuração da Régua'}
          </button>
        )}
      </div>

      {feedback && feedback.key === 'FLOW_SAVE' && (
        <div className="p-3 rounded-xl border text-xs font-bold flex items-center gap-2 bg-emerald-50 border-emerald-300 text-emerald-800 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{feedback.message}</span>
        </div>
      )}

      {/* ── INTERACTIVE PIPELINE FLOWCHART VIEW ────────────────────────────── */}
      {activeViewTab === 'flowchart' && flowMap && (
        <div className="space-y-6">
          {/* Header do Fluxo com Contexto */}
          <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-sm space-y-2 border border-slate-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider ${
                  selectedMode === 'paid' ? 'bg-amber-500 text-slate-950' : 'bg-emerald-500 text-slate-950'
                }`}>
                  {selectedMode === 'paid' ? 'Funil: Modo Pago / Vendas' : 'Funil: Modo Free / Evento'}
                </span>
                <h3 className="text-sm font-bold text-slate-100">
                  Jornada Automatizada do Cliente no WhatsApp
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                Alterne os interruptores para definir quais mensagens são enviadas e ajuste os segundos de espera.
              </span>
            </div>
          </div>

          {/* FLUXO 1: CADASTRO DO VISITANTE (A RÉGUA DE ONBOARDING) */}
          <div className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-xs space-y-6 relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center font-bold">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Etapa 1: Cliente Cadastra no Wi-Fi (/portal/register)
                  </h4>
                  <p className="text-xs text-slate-500">
                    {selectedMode === 'paid'
                      ? 'Sequência de Boas-Vindas, Envio de Credenciais, Link de Planos e Lembrete de Cortesia'
                      : 'Boas-Vindas com Acesso Livre Imediato e Engajamento social'}
                  </p>
                </div>
              </div>

              {/* Master Switch for Welcome Flow */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-600">Disparar Mensagens no Cadastro?</span>
                <button
                  type="button"
                  onClick={() => handleToggleMasterTrigger(selectedMode === 'paid' ? 'welcome_paid' : 'welcome_free')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer flex items-center gap-1.5 border ${
                    (selectedMode === 'paid' ? flowMap.welcome_paid.enabled : flowMap.welcome_free.enabled)
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : 'bg-rose-100 text-rose-900 border-rose-300'
                  }`}
                >
                  {(selectedMode === 'paid' ? flowMap.welcome_paid.enabled : flowMap.welcome_free.enabled) ? (
                    <>
                      <ToggleRight className="w-4 h-4 text-emerald-600" /> Ativo
                    </>
                  ) : (
                    <>
                      <ToggleLeft className="w-4 h-4 text-rose-600" /> Desativado
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Sequence Steps Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(selectedMode === 'paid' ? flowMap.welcome_paid.steps : flowMap.welcome_free.steps).map((step, idx) => {
                const triggerDef = triggers.find((t) => t.key === step.key);
                const isSelected = selectedTrigger?.key === step.key;

                return (
                  <div
                    key={step.id}
                    className={`rounded-2xl border-2 p-4 transition-all flex flex-col justify-between relative ${
                      !step.enabled
                        ? 'bg-slate-50/80 border-slate-200 opacity-60'
                        : isSelected
                        ? 'bg-emerald-50/40 border-emerald-500 shadow-sm'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div>
                      {/* Top Step Number & Toggle */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-900 text-white">
                          Mensagem {idx + 1}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleToggleStep(selectedMode === 'paid' ? 'welcome_paid' : 'welcome_free', step.id)}
                          className={`text-xs font-black cursor-pointer px-2 py-0.5 rounded-lg border transition-colors ${
                            step.enabled
                              ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                              : 'bg-slate-200 border-slate-300 text-slate-600'
                          }`}
                        >
                          {step.enabled ? '● Ativa' : '○ Desligada'}
                        </button>
                      </div>

                      <h5 className="text-xs font-black text-slate-900 leading-snug">
                        {step.name}
                      </h5>

                      <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">
                        {triggerDef?.triggerEvent || 'Evento da sequência'}
                      </p>

                      {/* Delay Configuration */}
                      <div className="mt-3 p-2 bg-slate-100/80 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <span className="text-[10px] font-extrabold uppercase text-slate-600 flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" /> Espera (Delay):
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={3600}
                            value={step.delaySeconds}
                            onChange={(e) =>
                              handleUpdateDelay(
                                selectedMode === 'paid' ? 'welcome_paid' : 'welcome_free',
                                step.id,
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-14 bg-white border border-slate-300 rounded px-1.5 py-0.5 text-center text-xs font-mono font-bold"
                          />
                          <span className="text-[10px] font-bold text-slate-500">seg</span>
                        </div>
                      </div>
                    </div>

                    {/* Button to Select and Edit this step's message text */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          if (triggerDef) {
                            setSelectedId(triggerDef.id);
                            setActiveViewTab('templates');
                          }
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                      >
                        Editar Texto <ArrowRight className="w-3 h-3" />
                      </button>

                      <span className="text-[10px] font-mono text-slate-400">
                        {step.delaySeconds === 0 ? 'Imediato' : `+${step.delaySeconds}s`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* FLUXO 2: COBRANÇA E PAGAMENTO (SOMENTE MODO PAGO) OU SORTEIO (MODO FREE) */}
          {selectedMode === 'paid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Evento PIX Gerado */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center font-bold">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        Etapa 2A: PIX Copia e Cola Gerado
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Disparo automático ao escolher plano no portal
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMasterTrigger('pix_generated')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border cursor-pointer ${
                      flowMap.pix_generated.enabled
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-slate-100 border-slate-300 text-slate-500'
                    }`}
                  >
                    {flowMap.pix_generated.enabled ? 'Ativo' : 'Desligado'}
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Envia a chave PIX Copia e Cola diretamente no WhatsApp do cliente com cortesia de 15 minutos para ele abrir o app bancário sem queda de rede.
                </p>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const trig = triggers.find((t) => t.key === 'WA_MSG_PIX_GENERATED');
                      if (trig) {
                        setSelectedId(trig.id);
                        setActiveViewTab('templates');
                      }
                    }}
                    className="text-xs font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer"
                  >
                    Personalizar Texto do PIX <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Evento Pagamento Aprovado */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                      <Zap className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        Etapa 2B: Pagamento Aprovado (Mercado Pago)
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        Disparo imediato ao receber confirmação do banco
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleToggleMasterTrigger('payment_approved')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-black border cursor-pointer ${
                      flowMap.payment_approved.enabled
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                        : 'bg-slate-100 border-slate-300 text-slate-500'
                    }`}
                  >
                    {flowMap.payment_approved.enabled ? 'Ativo' : 'Desligado'}
                  </button>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Confirma ao cliente que o dinheiro caiu, que a internet está ativa pelo tempo contratado (sem interrupções) e reenvia o login e a senha para guardar.
                </p>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      const trig = triggers.find((t) => t.key === 'WA_MSG_PAYMENT_APPROVED_HOTSPOT');
                      if (trig) {
                        setSelectedId(trig.id);
                        setActiveViewTab('templates');
                      }
                    }}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                  >
                    Personalizar Confirmação de Pago <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* MODO FREE: SORTEIOS & ATENDIMENTO */
            <div className="bg-white border-2 border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center font-bold">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900">
                      Sorteios de Leads & Brindes do Evento (/dashboard/leads/sorteio)
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Disparado quando você seleciona um ganhador entre os visitantes conectados
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const trig = triggers.find((t) => t.key === 'WA_MSG_RAFFLE_WINNER_FREE');
                    if (trig) {
                      setSelectedId(trig.id);
                      setActiveViewTab('templates');
                    }
                  }}
                  className="text-xs font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 cursor-pointer"
                >
                  Personalizar Notificação do Sorteado <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Filter Bar for Categories ─────────────────────────────────────── */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-sm font-black text-slate-900 flex items-center gap-2">
            <MessageSquare className={`w-4 h-4 ${selectedMode === 'paid' ? 'text-amber-500' : 'text-emerald-600'}`} />
            {selectedMode === 'paid'
              ? 'Modelos de Mensagem do Modo Pago (Cobranças, Vouchers e PIX)'
              : 'Modelos de Mensagem do Modo Free (Acesso Aberto, Eventos e Cortesia)'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedMode === 'paid'
              ? 'Estes textos são disparados exclusivamente quando a venda de planos está ativa. Não interferem no modo gratuito.'
              : 'Estes textos são disparados exclusivamente em cadastros livres e eventos gratuitos. Não possuem menção a cobranças.'}
          </p>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap gap-1.5 shrink-0">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeCategory === cat.id
                  ? selectedMode === 'paid'
                    ? 'bg-amber-500 text-white shadow-xs'
                    : 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border border-slate-200'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Two-Column Layout ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Triggers List */}
        <div className="lg:col-span-5 space-y-2.5">
          <div className="text-[11px] font-black text-slate-700 uppercase tracking-widest px-1">
            Gatilhos do Sistema ({filteredTriggers.length})
          </div>

          <div className="space-y-2 max-h-[640px] overflow-y-auto pr-1">
            {filteredTriggers.map((t) => {
              const isSelected = selectedTrigger?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full text-left p-4 rounded-2xl border-2 transition-all cursor-pointer relative ${
                    isSelected
                      ? selectedMode === 'paid'
                        ? 'bg-amber-50/70 border-amber-500 shadow-xs'
                        : 'bg-emerald-50/70 border-emerald-500 shadow-xs'
                      : 'bg-white border-slate-200/90 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                      {t.categoryLabel}
                    </span>
                    {t.isCustomized ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        selectedMode === 'paid'
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      }`}>
                        ● Personalizada
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                        Padrão de Fábrica
                      </span>
                    )}
                  </div>

                  <h3 className={`text-sm font-bold ${
                    isSelected
                      ? selectedMode === 'paid'
                        ? 'text-amber-950 font-black'
                        : 'text-emerald-950 font-black'
                      : 'text-slate-800'
                  }`}>
                    {t.title}
                  </h3>

                  <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
                    {t.triggerEvent}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right Column: Editor & Preview */}
        {selectedTrigger && (
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs space-y-5">
              {/* Trigger Header */}
              <div className="border-b border-slate-100 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${
                    selectedMode === 'paid'
                      ? 'bg-amber-100 text-amber-900 border-amber-300'
                      : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}>
                    {selectedTrigger.categoryLabel}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {selectedTrigger.key}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  {selectedTrigger.title}
                </h3>
                <div className="mt-2 p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-2.5 text-xs text-slate-700">
                  <Info className={`w-4 h-4 shrink-0 mt-0.5 ${selectedMode === 'paid' ? 'text-amber-600' : 'text-emerald-600'}`} />
                  <div>
                    <span className="font-extrabold text-slate-900">Momento do Disparo (Gatilho): </span>
                    <span>{selectedTrigger.triggerEvent}</span>
                  </div>
                </div>
              </div>

              {/* Dynamic Tags Box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Tag className={`w-3.5 h-3.5 ${selectedMode === 'paid' ? 'text-amber-600' : 'text-emerald-600'}`} />
                    Tags Dinâmicas (Clique para inserir no texto):
                  </label>
                  {copiedTag && (
                    <span className={`text-[10px] font-bold flex items-center gap-1 ${
                      selectedMode === 'paid' ? 'text-amber-700' : 'text-emerald-700'
                    }`}>
                      <Check className="w-3 h-3" /> Tag {copiedTag} inserida!
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {selectedTrigger.availableTags.map((t) => (
                    <button
                      key={t.tag}
                      type="button"
                      onClick={() => handleInsertTag(t.tag)}
                      title={`Insere ${t.tag} (Ex: ${t.example})`}
                      className={`px-2.5 py-1 rounded-lg border text-xs font-mono font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                        selectedMode === 'paid'
                          ? 'bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-900'
                          : 'bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-900'
                      }`}
                    >
                      <span>{t.tag}</span>
                      <span className="text-[10px] font-sans font-medium opacity-80">
                        ({t.label})
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Spintax Anti-Ban Helper */}
              <div className="p-3 rounded-xl bg-indigo-50/70 border border-indigo-200/80 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-indigo-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    Blindagem Anti-Ban (Spintax Dinâmico)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const spintaxSample = '{Olá|Oi|E aí|Tudo bem}, {cliente}!';
                      const current = editedTemplates[selectedTrigger.key] || '';
                      handleTemplateChange(selectedTrigger.key, current ? `${current}\n${spintaxSample}` : spintaxSample);
                    }}
                    className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100/80 px-2 py-0.5 rounded-md border border-indigo-200 transition-colors cursor-pointer"
                  >
                    + Inserir Exemplo
                  </button>
                </div>
                <p className="text-[11px] text-indigo-800/90 leading-relaxed">
                  Use variações entre chaves com barra vertical como <code className="bg-white px-1.5 py-0.5 rounded border border-indigo-200 font-mono font-bold text-indigo-900">{'{Olá|Oi|Opa}'}</code>. Cada cliente receberá uma saudação ou frase diferente de forma 100% automática, impedindo que a IA da Meta detecte padrões repetitivos!
                </p>
              </div>

              {/* Editor Textarea */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider block">
                  Conteúdo da Mensagem (WhatsApp Markdown):
                </label>
                <textarea
                  rows={8}
                  value={editedTemplates[selectedTrigger.key] ?? selectedTrigger.currentTemplate}
                  onChange={(e) => handleTemplateChange(selectedTrigger.key, e.target.value)}
                  placeholder="Digite o modelo de mensagem..."
                  className={`w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl p-3.5 text-xs font-mono text-slate-900 focus:outline-none transition-colors leading-relaxed ${
                    selectedMode === 'paid' ? 'focus:border-amber-500' : 'focus:border-emerald-500'
                  }`}
                />
                <p className="text-[11px] text-slate-500">
                  Dica: use <code className="text-slate-800 font-bold">*negrito*</code>, <code className="text-slate-800 font-bold">_itálico_</code>, ou <code className="text-slate-800 font-bold">`código`</code> para destacar informações.
                </p>
              </div>

              {/* Media Attachment — abas URL / Biblioteca */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                    <Sliders className="w-3.5 h-3.5" />
                    Mídia Anexada (Opcional)
                  </label>
                  {/* Tabs */}
                  <div className="flex rounded-lg overflow-hidden border border-slate-200 text-[11px] font-bold">
                    <button type="button"
                      onClick={() => setMediaTab(p => ({ ...p, [selectedTrigger.key]: 'url' }))}
                      className={`px-3 py-1 transition-colors cursor-pointer ${(mediaTab[selectedTrigger.key] || 'url') === 'url' ? 'bg-slate-700 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                      URL
                    </button>
                    <button type="button"
                      onClick={() => { setMediaTab(p => ({ ...p, [selectedTrigger.key]: 'library' })); openLibraryModal(selectedTrigger.key); }}
                      className={`px-3 py-1 flex items-center gap-1 transition-colors cursor-pointer ${(mediaTab[selectedTrigger.key] || 'url') === 'library' ? 'bg-emerald-600 text-white' : 'bg-white text-slate-500 hover:bg-slate-50'}`}>
                      <Library className="w-3 h-3" /> Biblioteca
                    </button>
                  </div>
                </div>

                {/* Tab: URL */}
                {(mediaTab[selectedTrigger.key] || 'url') === 'url' && (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <select
                      value={editedMediaTypes[selectedTrigger.key] ?? selectedTrigger.mediaType ?? 'image'}
                      onChange={(e) => setEditedMediaTypes((prev) => ({ ...prev, [selectedTrigger.key]: e.target.value as any }))}
                      className="w-full sm:w-1/3 bg-slate-50 border border-slate-300 rounded-xl px-3 h-10 text-xs font-semibold text-slate-800 focus:outline-none focus:border-slate-500 transition-colors cursor-pointer"
                    >
                      <option value="image">Imagem</option>
                      <option value="video">Vídeo</option>
                      <option value="audio">Áudio</option>
                      <option value="document">Documento</option>
                    </select>
                    <input
                      type="url"
                      value={editedMediaUrls[selectedTrigger.key] ?? selectedTrigger.mediaUrl ?? ''}
                      onChange={(e) => setEditedMediaUrls((prev) => ({ ...prev, [selectedTrigger.key]: e.target.value }))}
                      placeholder="URL pública do arquivo (ex: https://.../img.jpg)"
                      className="w-full sm:w-2/3 bg-slate-50 border border-slate-300 rounded-xl px-3 h-10 text-xs font-mono text-slate-800 focus:outline-none focus:border-slate-500 transition-colors"
                    />
                  </div>
                )}

                {/* Tab: Biblioteca */}
                {(mediaTab[selectedTrigger.key] || 'url') === 'library' && (
                  <div className="flex items-center gap-3">
                    {editedForwardIds[selectedTrigger.key] || selectedTrigger.forwardLibraryId ? (() => {
                      const selId = editedForwardIds[selectedTrigger.key] || selectedTrigger.forwardLibraryId || '';
                      const item = libraryItems.find(i => i.id === selId);
                      return (
                        <div className="flex-1 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2">
                          <div className="text-emerald-600">{mediaTypeIcon(item?.mediaType || 'image')}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-slate-800 truncate">{item?.caption || 'Item selecionado'}</p>
                            <p className="text-[10px] text-slate-400">{item?.mimeType || item?.mediaType || ''}</p>
                          </div>
                          <button type="button" onClick={() => openLibraryModal(selectedTrigger.key)}
                            className="text-[11px] text-emerald-700 font-bold hover:underline cursor-pointer">Trocar</button>
                          <button type="button" onClick={() => { setEditedForwardIds(p => ({ ...p, [selectedTrigger.key]: '' })); setMediaTab(p => ({ ...p, [selectedTrigger.key]: 'url' })); }}
                            className="text-slate-400 hover:text-red-500 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      );
                    })() : (
                      <button type="button" onClick={() => openLibraryModal(selectedTrigger.key)}
                        className="flex-1 border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl py-3 text-xs text-slate-500 hover:text-emerald-600 flex items-center justify-center gap-2 transition-colors cursor-pointer">
                        <Library className="w-4 h-4" /> Selecionar da Biblioteca de Mídias
                      </button>
                    )}
                  </div>
                )}

                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                  <Library className="w-3 h-3" />
                  <strong>Biblioteca</strong>: encaminha sem re-upload (anti-ban) · <strong>URL</strong>: usa link direto público
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => handleReset(selectedTrigger)}
                  disabled={savingKey === selectedTrigger.key}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restaurar Padrão
                </button>

                <button
                  type="button"
                  onClick={() => handleSave(selectedTrigger)}
                  disabled={savingKey === selectedTrigger.key}
                  className={`px-6 py-2.5 rounded-xl text-xs font-black text-white shadow-sm flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 ${
                    selectedMode === 'paid'
                      ? 'bg-amber-500 hover:bg-amber-600'
                      : 'bg-emerald-600 hover:bg-emerald-700'
                  }`}
                >
                  <Save className="w-4 h-4" />
                  {savingKey === selectedTrigger.key ? 'Salvando...' : 'Salvar Modelo'}
                </button>
              </div>

              {feedback && feedback.key === selectedTrigger.key && (
                <div
                  className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    feedback.success
                      ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      : 'bg-rose-50 border-rose-300 text-rose-800'
                  }`}
                >
                  {feedback.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}

              {/* Live Preview (Visualização em tempo real simulando tela do WhatsApp) */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 text-xs font-extrabold text-slate-800">
                    <Eye className="w-4 h-4 text-emerald-600" />
                    Simulação de Envio no WhatsApp (Preview com dados reais):
                  </div>
                  {hasSpintax(editedTemplates[selectedTrigger.key] ?? selectedTrigger.currentTemplate) && (
                    <button
                      type="button"
                      onClick={() => setPreviewSeed(s => s + 1)}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors cursor-pointer w-fit"
                      title="Gera outra variação de texto simulada via Spintax Anti-Ban"
                    >
                      <Shuffle className="w-3.5 h-3.5" />
                      Sortear Variação Spintax
                    </button>
                  )}
                </div>

                <div
                  className="rounded-2xl p-4 border border-emerald-900/10 shadow-inner"
                  style={{ backgroundColor: '#E5DDD5' }}
                >
                  <div key={previewSeed} className="max-w-md bg-white rounded-2xl rounded-tl-xs p-3.5 shadow-sm text-xs text-slate-900 space-y-1.5 font-sans leading-relaxed whitespace-pre-wrap border border-black/5 animate-fade-in">
                    {renderPreview(
                      editedTemplates[selectedTrigger.key] ?? selectedTrigger.currentTemplate,
                      selectedTrigger.availableTags
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

    {/* Modal: Biblioteca de Mídias */}
    {showLibraryModal && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={() => setShowLibraryModal(false)}>
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Library className="w-5 h-5 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-800">Biblioteca de Mídias</h3>
              <span className="text-[11px] bg-emerald-100 text-emerald-700 font-bold px-2 py-0.5 rounded-full">{libraryItems.length} itens</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={fetchLibrary}
                disabled={libraryLoading}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCcw className={`w-3.5 h-3.5 ${libraryLoading ? 'animate-spin' : ''}`} />
                Atualizar Mídias
              </button>
              <button type="button" onClick={() => setShowLibraryModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Status dos Grupos Vinculados */}
          {configuredGroups.length > 0 && (
            <div className="px-6 py-2.5 bg-slate-50 border-b border-slate-200/80 flex flex-wrap gap-2 items-center">
              <span className="text-[11px] font-bold text-slate-600">Grupos Conectados:</span>
              {configuredGroups.map((cg) => (
                <div key={cg.instanceId} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white border border-slate-200 text-slate-800 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-slate-500">{cg.instanceName}:</span>
                  <strong className="text-emerald-700">{cg.groupName}</strong>
                </div>
              ))}
            </div>
          )}

          {/* Instrução */}
          <div className="px-6 py-3 bg-emerald-50/80 border-b border-emerald-100">
            <p className="text-[11px] text-emerald-800 leading-relaxed">
              <strong>Como adicionar mídias:</strong> Envie qualquer foto, banner, vídeo ou áudio no grupo vinculado no seu WhatsApp (você pode postar pelo próprio celular do bot ou como participante). O sistema captura na mesma hora e reenvia aos clientes <strong>como se fosse um humano encaminhando</strong>, sem re-upload!
            </p>
          </div>

          {/* Grid de items */}
          <div className="flex-1 overflow-y-auto p-4">
            {libraryLoading ? (
              <div className="flex items-center justify-center py-12 text-slate-400 text-sm gap-2">
                <RefreshCcw className="w-4 h-4 animate-spin" /> Carregando biblioteca...
              </div>
            ) : libraryItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <Library className="w-10 h-10 text-slate-200" />
                <p className="text-sm font-semibold text-slate-600">Nenhuma mídia capturada ainda</p>
                <p className="text-[11px] text-slate-500 max-w-sm">
                  {configuredGroups.length > 0
                    ? `Abra o grupo "${configuredGroups[0].groupName}" no WhatsApp, envie uma imagem ou vídeo e depois clique em "Atualizar Mídias" acima.`
                    : 'Nenhum grupo vinculado ainda. Vá em Aparelhos WhatsApp Conectados e escolha o grupo no aparelho desejado.'}
                </p>
                <button
                  type="button"
                  onClick={fetchLibrary}
                  className="mt-2 inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
                >
                  <RefreshCcw className="w-3.5 h-3.5" /> Verificar Agora
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {libraryItems.map(item => (
                  <button key={item.id} type="button" onClick={() => selectLibraryItem(item)}
                    className="group relative flex flex-col bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-400 rounded-xl overflow-hidden transition-all cursor-pointer text-left">
                    {/* Thumbnail */}
                    <div className="w-full aspect-video bg-slate-100 flex items-center justify-center overflow-hidden">
                      {item.thumbnailUrl ? (
                        <img src={item.thumbnailUrl} alt={item.caption || ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="text-slate-300">{mediaTypeIcon(item.mediaType)}</div>
                      )}
                      {/* Overlay tipo */}
                      <div className="absolute top-1.5 left-1.5 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1">
                        {mediaTypeIcon(item.mediaType)}
                        {item.mediaType.toUpperCase()}
                      </div>
                    </div>
                    {/* Caption */}
                    <div className="p-2">
                      <p className="text-[11px] font-semibold text-slate-700 truncate">{item.caption || '(sem legenda)'}</p>
                      <p className="text-[10px] text-slate-400">{item.mimeType || ''}</p>
                    </div>
                    {/* Hover overlay */}
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

          {/* Footer */}
          <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between">
            <button type="button" onClick={fetchLibrary}
              className="text-[11px] text-slate-500 hover:text-slate-700 flex items-center gap-1 cursor-pointer">
              <RefreshCcw className="w-3 h-3" /> Atualizar
            </button>
            <button type="button" onClick={() => setShowLibraryModal(false)}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer">
              Cancelar
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
