"use client";
/* eslint-disable @next/next/no-img-element */

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  MessageSquare, Sparkles, RefreshCcw, Save, RotateCcw,
  CheckCircle2, AlertCircle, Tag, Eye, Info, Check,
  Clock, ArrowRight, Sliders, ToggleLeft, ToggleRight,
  ShieldCheck, Zap, UserCheck, ShoppingCart, Bot,
  Image as ImageIcon, Video, Music, FileText, Library, X, Shuffle, ChevronDown, ChevronUp, Wifi,
  Upload, Trash2
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
  const [syncingGroup, setSyncingGroup] = useState(false);
  const [showLibraryModal, setShowLibraryModal] = useState(false);
  const [libraryTargetKey, setLibraryTargetKey] = useState<string>('');
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deletingMediaId, setDeletingMediaId] = useState<string | null>(null);
  const mediaFileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ key: string; success: boolean; message: string } | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const [wifiNetworkName, setWifiNetworkName] = useState<string>('');
  const [savingWifiName, setSavingWifiName] = useState(false);

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
          if (data.wifiName) {
            setWifiNetworkName(data.wifiName);
          }
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

  const fetchLibrary = useCallback((sync = false) => {
    setLibraryLoading(true);
    if (sync) setSyncingGroup(true);
    const url = sync ? '/api/admin/media-library?sync=true' : '/api/admin/media-library';
    fetch(url)
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
      .finally(() => {
        setLibraryLoading(false);
        setSyncingGroup(false);
      });
  }, []);

  const handleUploadMedia = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingMedia(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('caption', file.name.replace(/\.[^/.]+$/, ''));
      const res = await fetch('/api/admin/media-library', {
        method: 'POST',
        body: fd,
      });
      const data = await res.json();
      if (data.success && data.item) {
        setLibraryItems(prev => [data.item, ...prev]);
        setFeedback({ key: 'LIBRARY', success: true, message: 'Mídia adicionada com sucesso!' });
      } else {
        alert(data.message || 'Erro ao enviar mídia.');
      }
    } catch {
      alert('Falha na comunicação ao enviar arquivo.');
    } finally {
      setUploadingMedia(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleDeleteLibraryItem = async (itemId: string, force = false) => {
    if (!force && !confirm('Deseja apagar esta mídia para todos no WhatsApp e remover da Biblioteca Central?')) {
      return;
    }
    setDeletingMediaId(itemId);
    try {
      const res = await fetch('/api/admin/media-library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: itemId, forceLocal: force })
      });
      const data = await res.json();
      if (data.success) {
        setLibraryItems(prev => prev.filter(i => i.id !== itemId));
        setEditedForwardIds(prev => {
          const next = { ...prev };
          for (const k of Object.keys(next)) {
            if (next[k] === itemId) next[k] = '';
          }
          return next;
        });
        setFeedback({ key: 'LIBRARY', success: true, message: data.message || 'Mídia apagada com sucesso!' });
      } else {
        if (data.requireForceLocal) {
          if (confirm(`${data.message}\n\nDeseja forçar a remoção apenas da biblioteca do painel?`)) {
            await handleDeleteLibraryItem(itemId, true);
            return;
          }
        } else {
          alert(data.message || 'Não foi possível apagar a mídia.');
        }
      }
    } catch {
      alert('Falha na comunicação ao tentar apagar mídia.');
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handleClearAllMedia = async () => {
    if (!confirm('ATENÇÃO: Isso apagará todas as mídias salvas na Biblioteca Central do painel. Deseja continuar?')) return;
    setDeletingMediaId('all');
    try {
      const res = await fetch('/api/admin/media-library', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clearAll: true })
      });
      const data = await res.json();
      if (data.success) {
        setLibraryItems([]);
        setEditedForwardIds({});
        setFeedback({ key: 'LIBRARY', success: true, message: data.message || 'Todas as mídias foram limpas!' });
      } else {
        alert(data.message || 'Não foi possível limpar as mídias.');
      }
    } catch {
      alert('Falha na comunicação ao tentar limpar mídias.');
    } finally {
      setDeletingMediaId(null);
    }
  };

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

  const handleSaveWifiName = async () => {
    if (!wifiNetworkName.trim()) return;
    setSavingWifiName(true);
    try {
      const res = await fetch('/api/admin/whatsapp-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setWifiName', wifiName: wifiNetworkName.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setWifiNetworkName(data.wifiName);
        setFeedback({ key: 'WIFI_NAME', success: true, message: data.message });
      } else {
        setFeedback({ key: 'WIFI_NAME', success: false, message: data.message || 'Erro ao salvar' });
      }
    } catch {
      setFeedback({ key: 'WIFI_NAME', success: false, message: 'Falha na conexão com o servidor' });
    } finally {
      setSavingWifiName(false);
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
    fetchLibrary(true);
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
      let val = t.example;
      if (t.tag === '{rede_wifi}') {
        val = wifiNetworkName.trim() || 'Faculdade Adventista do Paraná';
      }
      preview = preview.replace(regex, val);
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

        {/* ── Banner de Configuração Exata do Nome da Rede Wi-Fi (SSID) ─────── */}
        <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-slate-50 border-2 border-blue-200 rounded-2xl p-4 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                <Wifi className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black text-slate-900">
                    Nome Exato da Rede Wi-Fi (SSID)
                  </h3>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                    Tag {'{rede_wifi}'}
                  </span>
                </div>
                <p className="text-xs text-slate-600 mt-0.5 max-w-2xl">
                  Digite o nome exato da sua rede Wi-Fi como ela aparece no celular do cliente (SSID). A tag <code className="font-bold text-blue-700 bg-blue-100/60 px-1 py-0.5 rounded">{'{rede_wifi}'}</code> e o link de login em todas as mensagens usarão exatamente este nome.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:shrink-0 w-full sm:w-auto">
              <input
                type="text"
                value={wifiNetworkName}
                onChange={(e) => setWifiNetworkName(e.target.value)}
                placeholder="Ex: Faculdade Adventista do Paraná"
                className="flex-1 sm:w-72 px-3.5 py-2 text-xs font-semibold bg-white text-slate-900 border-2 border-slate-300 rounded-xl focus:border-blue-500 focus:outline-hidden transition-all shadow-xs"
              />
              <button
                type="button"
                onClick={handleSaveWifiName}
                disabled={savingWifiName || !wifiNetworkName.trim()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                {savingWifiName ? (
                  <RefreshCcw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>Salvar Nome</span>
              </button>
            </div>
          </div>

          {feedback && feedback.key === 'WIFI_NAME' && (
            <div className={`mt-3 p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 animate-fade-in ${
              feedback.success ? 'bg-emerald-50 border-emerald-300 text-emerald-800' : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              {feedback.success ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" /> : <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />}
              <span>{feedback.message}</span>
            </div>
          )}
        </div>

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
                        if (!item) {
                          return (
                            <div className="flex-1 flex items-center justify-between gap-2.5 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2 text-xs">
                              <div className="flex items-center gap-2 text-amber-900 font-medium">
                                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                <span>Mídia anterior foi excluída da biblioteca. Selecione outra mídia para manter o envio ativo.</span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button type="button" onClick={() => openLibraryModal(currentTrigger.key)} className="text-[11px] font-bold text-amber-900 bg-amber-200/80 hover:bg-amber-200 px-2.5 py-1 rounded-lg cursor-pointer">Trocar</button>
                                <button type="button" onClick={() => { setEditedForwardIds(p => ({ ...p, [currentTrigger.key]: '' })); setMediaTab(p => ({ ...p, [currentTrigger.key]: 'url' })); }} className="text-amber-600 hover:text-rose-600 p-1 cursor-pointer"><X className="w-3.5 h-3.5" /></button>
                              </div>
                            </div>
                          );
                        }
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

      {/* Input oculto para upload de mídia diretamente do dispositivo */}
      <input
        type="file"
        ref={mediaFileInputRef}
        onChange={handleUploadMedia}
        accept="image/*,video/*,audio/*,application/pdf"
        className="hidden"
      />

      {/* Modal da Biblioteca de Mídias */}
      {showLibraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => setShowLibraryModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <Library className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Biblioteca de Mídias Central</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">{libraryItems.length} mídias</span>
                    <span className="text-[10px] text-slate-400">• Ativa online/offline</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => mediaFileInputRef.current?.click()}
                  disabled={uploadingMedia}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer disabled:opacity-50 transition-all"
                  title="Enviar foto, banner ou vídeo diretamente do seu dispositivo"
                >
                  <Upload className={`w-3.5 h-3.5 ${uploadingMedia ? 'animate-bounce' : ''}`} />
                  {uploadingMedia ? 'Enviando...' : 'Fazer Upload'}
                </button>
                <button
                  type="button"
                  onClick={handleClearAllMedia}
                  disabled={deletingMediaId === 'all'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-rose-600 bg-white hover:bg-rose-50 border border-rose-200 cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                  title="Apagar todas as mídias da biblioteca central"
                >
                  <Trash2 className={`w-3.5 h-3.5 ${deletingMediaId === 'all' ? 'animate-spin' : ''}`} />
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => fetchLibrary(true)}
                  disabled={libraryLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 cursor-pointer disabled:opacity-50 transition-all shadow-xs"
                  title="Buscar e sincronizar todas as mídias existentes no grupo do WhatsApp"
                >
                  <RefreshCcw className={`w-3.5 h-3.5 ${libraryLoading ? 'animate-spin text-emerald-600' : ''}`} />
                  {syncingGroup ? 'Sincronizando...' : 'Atualizar'}
                </button>
                <button type="button" onClick={() => setShowLibraryModal(false)} className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Aviso informativo de funcionamento */}
            <div className="px-6 py-2 bg-emerald-50/70 border-b border-emerald-100/80 text-[11px] text-emerald-900 flex items-center justify-between">
              <span>💡 Você pode enviar fotos no grupo do WhatsApp vinculado ou fazer upload direto acima (funciona mesmo com WhatsApp desconectado).</span>
            </div>

            <div className="flex-1 overflow-y-auto p-5">
              {libraryLoading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400 text-xs gap-2">
                  <RefreshCcw className="w-6 h-6 animate-spin text-emerald-600" />
                  <span>{syncingGroup ? 'Buscando todas as mídias existentes no grupo do WhatsApp...' : 'Sincronizando mídias da biblioteca central...'}</span>
                </div>
              ) : libraryItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-14 text-center gap-3 border-2 border-dashed border-slate-200 rounded-2xl">
                  <Library className="w-12 h-12 text-slate-300" />
                  <p className="text-sm font-bold text-slate-700">Nenhuma mídia capturada ainda</p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    Envie fotos/banners no grupo do WhatsApp ou faça upload direto pelo botão abaixo.
                  </p>
                  <button
                    type="button"
                    onClick={() => mediaFileInputRef.current?.click()}
                    disabled={uploadingMedia}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm cursor-pointer transition-all"
                  >
                    <Upload className="w-4 h-4" /> Fazer Upload de Mídia
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {libraryItems.map(item => (
                    <div
                      key={item.id}
                      className="group relative flex flex-col bg-slate-50 hover:bg-emerald-50/30 border border-slate-200 hover:border-emerald-300 rounded-2xl overflow-hidden transition-all text-left shadow-xs hover:shadow-md"
                    >
                      <div className="w-full aspect-video bg-slate-100 flex items-center justify-center overflow-hidden relative">
                        {item.thumbnailUrl ? (
                          item.thumbnailUrl.endsWith('.mp4') ? (
                            <video src={item.thumbnailUrl} className="w-full h-full object-cover" muted playsInline />
                          ) : (
                            <img src={item.thumbnailUrl} alt={item.caption || ''} className="w-full h-full object-cover" />
                          )
                        ) : (
                          <div className="text-slate-400">{mediaTypeIcon(item.mediaType)}</div>
                        )}
                        {/* Botão de Excluir da Biblioteca e Apagar no WhatsApp */}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); handleDeleteLibraryItem(item.id); }}
                          disabled={deletingMediaId === item.id}
                          className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/60 hover:bg-rose-600 text-white transition-all cursor-pointer z-20 shadow-xs"
                          title="Apagar mídia para todos no WhatsApp e remover da biblioteca"
                        >
                          <Trash2 className={`w-3.5 h-3.5 ${deletingMediaId === item.id ? 'animate-spin' : ''}`} />
                        </button>
                      </div>
                      <div className="p-2.5 flex-1 flex flex-col justify-between">
                        <div>
                          <p className="text-xs font-bold text-slate-800 truncate" title={item.caption || ''}>
                            {item.caption || '(sem legenda)'}
                          </p>
                          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {item.mediaType.toUpperCase()}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => selectLibraryItem(item)}
                          className="mt-2.5 w-full py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1 shadow-xs"
                        >
                          <Check className="w-3.5 h-3.5" /> Usar Esta Mídia
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
              <span className="text-[11px] text-slate-500">Mídias deletadas são removidas dos gatilhos automaticamente para evitar envios offline.</span>
              <button type="button" onClick={() => setShowLibraryModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl cursor-pointer transition-all">
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

