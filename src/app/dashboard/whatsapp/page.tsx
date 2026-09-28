"use client";

import { useEffect, useState, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import {
  Bot, Save, ShieldCheck, Link as LinkIcon,
  RefreshCcw, Trash2, Plus, Phone, WifiOff,
  QrCode, CheckCircle2, AlertTriangle, Zap, LogOut, RotateCw,
  Eye, MessageSquare, Clock, Layers, MousePointerClick, Pause,
  X, Smartphone, Activity,
  Users, FolderPlus, Check, Search, Library
} from 'lucide-react';
import { WhatsappMessageCustomizer } from '@/components/dashboard/whatsapp/WhatsappMessageCustomizer';

interface WhatsappInstance {
  id: string;
  name: string;
  number?: string | null;
  engine?: string;
  phoneId?: string | null;
  token?: string | null;
  status: string;
  active?: boolean;
  qrCode?: string | null;
  lastSeen?: string | null;
  dailyCount?: number;
  profilePicUrl?: string | null;
  libraryGroupJid?: string | null;
  libraryGroupName?: string | null;
  groupJoinError?: string | null;
}

interface ModeInfo {
  mode: 'meta' | 'baileys' | 'hybrid' | 'none';
  metaEnabled: boolean;
  baileysEnabled: boolean;
  status: string;
  qrCode: string | null;
}

interface MaskingConfig {
  enabled: boolean;
  browserFingerprint: boolean;
  simulateTyping: boolean;
  simulateReading: boolean;
  simulateReceipt: boolean;
  typingDelayBetweenChunks: boolean;
  standbyEnabled: boolean;
  standbyMinSeconds: number;
  standbyMaxSeconds: number;
  typingCancelSimulation: boolean;
}

const DEFAULT_MASKING: MaskingConfig = {
  enabled: false,
  browserFingerprint: true,
  simulateTyping: true,
  simulateReading: true,
  simulateReceipt: true,
  typingDelayBetweenChunks: true,
  standbyEnabled: false,
  standbyMinSeconds: 30,
  standbyMaxSeconds: 180,
  typingCancelSimulation: true,
};

// ─── Toggle Switch Component ─────────────────────────────────────────────────

function ToggleSwitch({
  enabled,
  onChange,
  disabled = false,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!enabled)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none shrink-0 ${
        enabled ? 'bg-emerald-600' : 'bg-slate-300'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
          enabled ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

// ─── Masking Mode Card ────────────────────────────────────────────────────────

function MaskingCard({
  icon: Icon,
  title,
  description,
  enabled,
  onToggle,
  masterEnabled,
  color = 'sky',
  children,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  masterEnabled: boolean;
  color?: string;
  children?: React.ReactNode;
}) {
  const colorMap: Record<string, string> = {
    sky: 'border-sky-300 bg-sky-50/60',
    amber: 'border-amber-300 bg-amber-50/60',
    violet: 'border-teal-300 bg-teal-50/60',
    emerald: 'border-emerald-300 bg-emerald-50/60',
    rose: 'border-rose-300 bg-rose-50/60',
  };
  const iconColorMap: Record<string, string> = {
    sky: 'text-sky-700 bg-sky-100 border border-sky-200',
    amber: 'text-amber-700 bg-amber-100 border border-amber-200',
    violet: 'text-teal-700 bg-teal-100 border border-teal-200',
    emerald: 'text-emerald-700 bg-emerald-100 border border-emerald-200',
    rose: 'text-rose-700 bg-rose-100 border border-rose-200',
  };

  const isEffectivelyEnabled = masterEnabled && enabled;

  return (
    <div
      className={`p-4 rounded-xl border transition-all duration-200 shadow-xs ${
        isEffectivelyEnabled
          ? colorMap[color] || colorMap.sky
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`p-2 rounded-lg shrink-0 ${isEffectivelyEnabled ? (iconColorMap[color] || iconColorMap.sky) : 'text-slate-500 bg-slate-200 border border-slate-300'}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-900">{title}</h4>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{description}</p>
          </div>
        </div>
        <ToggleSwitch enabled={enabled} onChange={onToggle} disabled={!masterEnabled} />
      </div>
      {isEffectivelyEnabled && children && (
        <div className="mt-3 pt-3 border-t border-slate-200/80">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WhatsappConnection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ success: boolean; message: string } | null>(null);

  const [instances, setInstances] = useState<WhatsappInstance[]>([]);
  const [verifyToken, setVerifyToken] = useState('');
  const [activeTab, setActiveTab] = useState<'connections' | 'messages' | 'masking'>('connections');

  // Dual-mode state
  const [modeInfo, setModeInfo] = useState<ModeInfo>({
    mode: 'baileys',
    metaEnabled: false,
    baileysEnabled: true,
    status: 'connected',
    qrCode: null
  });
  const [togglingEngine, setTogglingEngine] = useState<string | null>(null);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  // Masking config state
  const [masking, setMasking] = useState<MaskingConfig>(DEFAULT_MASKING);
  const [savingMask, setSavingMask] = useState(false);
  const [savedMaskSuccess, setSavedMaskSuccess] = useState(false);

  // New instance modal state (Baileys)
  const [isPairingModalOpen, setIsPairingModalOpen] = useState(false);
  const [pairingInstance, setPairingInstance] = useState<WhatsappInstance | null>(null);
  const [newInstanceName, setNewInstanceName] = useState('');
  const [creatingInstance, setCreatingInstance] = useState(false);

  // New instance form (Meta)
  const [newMetaName, setNewMetaName] = useState('');
  const [newMetaNumber, setNewMetaNumber] = useState('');
  const [newMetaPhoneId, setNewMetaPhoneId] = useState('');
  const [newMetaToken, setNewMetaToken] = useState('');

  // Group selection modal state (Biblioteca de Mídias)
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [selectedGroupInstance, setSelectedGroupInstance] = useState<WhatsappInstance | null>(null);
  const [groupsList, setGroupsList] = useState<{ jid: string; subject: string; participantsCount: number; creation?: number; desc?: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [savingGroup, setSavingGroup] = useState(false);
  const [groupSearchQuery, setGroupSearchQuery] = useState('');
  const [manualGroupJid, setManualGroupJid] = useState('');
  const [applyGroupToAll, setApplyGroupToAll] = useState(false);

  const showFeedback = (success: boolean, message: string) => {
    setFeedback({ success, message });
    setTimeout(() => setFeedback(null), 5000);
  };

  const handleOpenGroupModal = async (inst: WhatsappInstance) => {
    setSelectedGroupInstance(inst);
    setIsGroupModalOpen(true);
    setGroupSearchQuery('');
    setManualGroupJid(inst.libraryGroupJid || '');
    setApplyGroupToAll(false);
    setLoadingGroups(true);
    setGroupsList([]);

    try {
      const res = await fetch(`/api/admin/whatsapp-groups?instanceId=${inst.id}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.groups)) {
        setGroupsList(data.groups);
      } else {
        showFeedback(false, data.error || 'Nenhum grupo encontrado neste aparelho');
      }
    } catch {
      showFeedback(false, 'Falha ao buscar grupos no WhatsApp');
    } finally {
      setLoadingGroups(false);
    }
  };

  const handleSaveManualGroup = async () => {
    if (!selectedGroupInstance || !manualGroupJid.trim()) return;
    setSavingGroup(true);
    try {
      const cleanJid = manualGroupJid.trim();
      const res = await fetch('/api/admin/whatsapp-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedGroupInstance.id,
          groupJid: cleanJid,
          groupName: cleanJid.split('@')[0],
          applyToAll: applyGroupToAll,
        })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(true, data.message || 'Grupo vinculado com sucesso!');
        setIsGroupModalOpen(false);
        loadData();
      } else {
        showFeedback(false, data.error || 'Erro ao vincular grupo');
      }
    } catch {
      showFeedback(false, 'Falha ao salvar grupo');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleSelectGroup = async (group: { jid: string; subject: string }) => {
    if (!selectedGroupInstance) return;
    setSavingGroup(true);
    try {
      const res = await fetch('/api/admin/whatsapp-groups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instanceId: selectedGroupInstance.id,
          groupJid: group.jid,
          groupName: group.subject,
          applyToAll: applyGroupToAll,
        })
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(true, data.message || 'Grupo vinculado com sucesso!');
        setIsGroupModalOpen(false);
        loadData();
      } else {
        showFeedback(false, data.error || 'Erro ao vincular grupo');
      }
    } catch {
      showFeedback(false, 'Falha na comunicação com o servidor');
    } finally {
      setSavingGroup(false);
    }
  };

  const handleUnbindGroup = async (instanceId: string) => {
    if (!confirm('Deseja desvincular o grupo de biblioteca deste aparelho?')) return;
    try {
      const res = await fetch(`/api/admin/whatsapp-groups?instanceId=${instanceId}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showFeedback(true, 'Grupo desvinculado com sucesso!');
        loadData();
      } else {
        showFeedback(false, data.error || 'Erro ao desvincular');
      }
    } catch {
      showFeedback(false, 'Erro ao desvincular');
    }
  };

  const loadData = useCallback(async () => {
    try {
      const [configRes, instancesRes, modeRes, maskRes] = await Promise.all([
        fetch('/api/config/system'),
        fetch('/api/whatsapp/instances'),
        fetch('/api/admin/whatsapp-mode'),
        fetch('/api/admin/whatsapp-masking'),
      ]);

      if (configRes.ok) {
        const d = await configRes.json();
        if (d.success && d.data) setVerifyToken(d.data.meta_verify_token || '');
      }

      if (instancesRes.ok) {
        const d = await instancesRes.json();
        if (d.success) setInstances(d.data);
      }

      if (modeRes.ok) {
        const d = await modeRes.json();
        setModeInfo(d);
      }

      if (maskRes.ok) {
        const d = await maskRes.json();
        if (d.config) setMasking(d.config);
      }
    } catch (e) {
      console.error('[WhatsApp Page] Erro ao carregar dados:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  const pairingInstanceIdRef = useRef<string | null>(null);
  useEffect(() => {
    pairingInstanceIdRef.current = pairingInstance?.id || null;
  }, [pairingInstance?.id]);

  useEffect(() => {
    loadData();
    const pollIntervalMs = isPairingModalOpen ? 2000 : 3500;
    const interval = setInterval(() => {
      fetch('/api/whatsapp/instances')
        .then(r => r.ok ? r.json() : null)
        .then(d => {
          if (d?.success && Array.isArray(d.data)) {
            setInstances(d.data);
            if (pairingInstanceIdRef.current) {
              const currentId = pairingInstanceIdRef.current;
              const updated = d.data.find((inst: WhatsappInstance) => inst.id === currentId);
              if (updated) setPairingInstance(updated);
            }
          }
        })
        .catch(() => {});

      fetch('/api/admin/whatsapp-mode')
        .then(r => r.ok ? r.json() : null)
        .then(d => { if (d) setModeInfo(d); })
        .catch(() => {});
    }, pollIntervalMs);
    return () => clearInterval(interval);
  }, [loadData, isPairingModalOpen]);

  // Toggle independente de motor
  const handleToggleEngine = async (engine: 'meta' | 'baileys', currentStatus: boolean) => {
    setTogglingEngine(engine);
    const targetStatus = !currentStatus;
    try {
      const res = await fetch('/api/admin/whatsapp-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ engine, enabled: targetStatus })
      });
      const data = await res.json();
      if (res.ok) {
        showFeedback(true, data.message);
        loadData();
      } else {
        showFeedback(false, data.error || 'Erro ao alterar estado do motor.');
      }
    } catch {
      showFeedback(false, 'Erro de comunicação com o servidor.');
    } finally {
      setTogglingEngine(null);
    }
  };

  // Inicia pareamento com socket Baileys ativo e geração de QR code fresco
  const handleStartPairing = async (inst: WhatsappInstance, forceNew = true) => {
    setPairingInstance(inst);
    setIsPairingModalOpen(true);
    setActionInProgress(`pair_${inst.id}`);
    try {
      const res = await fetch('/api/admin/whatsapp-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'connect',
          instanceId: inst.id,
          name: inst.name,
          forceNewPairing: forceNew
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        if (data.qrCode) {
          setPairingInstance(prev => prev ? { ...prev, qrCode: data.qrCode, status: 'waiting_qr' } : null);
        }
      } else {
        showFeedback(false, data.error || 'Erro ao inicializar pareamento.');
      }
      loadData();
    } catch (err) {
      console.error('[handleStartPairing] Erro:', err);
      showFeedback(false, 'Falha ao solicitar QR Code ao servidor.');
    } finally {
      setActionInProgress(null);
    }
  };

  // Criação de nova instância Baileys para pareamento
  const handleCreateBaileysInstance = async () => {
    setCreatingInstance(true);
    try {
      const res = await fetch('/api/whatsapp/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newInstanceName.trim() || `WhatsApp Chip ${instances.filter(i => i.engine === 'baileys').length + 1}`,
          engine: 'baileys'
        })
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPairingInstance(data.data);
        setIsPairingModalOpen(true);
        setNewInstanceName('');
        loadData();
      } else {
        showFeedback(false, data.error || 'Falha ao criar nova instância.');
      }
    } catch {
      showFeedback(false, 'Erro ao criar instância no servidor.');
    } finally {
      setCreatingInstance(false);
    }
  };

  // Ações de instância Baileys (Reiniciar, Desconectar, Excluir)
  const handleInstanceAction = async (id: string, action: 'restart' | 'disconnect' | 'delete') => {
    if (action === 'delete' && !confirm('Tem certeza que deseja excluir esta instância de WhatsApp?')) return;
    setActionInProgress(`${action}_${id}`);
    try {
      if (action === 'delete') {
        const res = await fetch(`/api/whatsapp/instances?id=${id}`, { method: 'DELETE' });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          showFeedback(true, 'Instância excluída com sucesso.');
          // Atualização otimista imediata
          setInstances(prev => prev.filter(i => i.id !== id));
          if (pairingInstance?.id === id) {
            setIsPairingModalOpen(false);
            setPairingInstance(null);
          }
          loadData();
        } else {
          showFeedback(false, data.error || 'Erro ao excluir instância.');
        }
      } else {
        const res = await fetch('/api/admin/whatsapp-mode', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: action === 'disconnect' ? 'logout' : 'restart',
            instanceId: id,
            forceNewPairing: action === 'restart'
          })
        });
        const data = await res.json();
        if (res.ok) {
          showFeedback(true, data.message);
          loadData();
        } else {
          showFeedback(false, data.error || 'Erro ao processar ação.');
        }
      }
    } catch {
      showFeedback(false, 'Falha na comunicação com o servidor.');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleSaveVerifyToken = async () => {
    if (!verifyToken.trim()) {
      showFeedback(false, 'Preencha o Webhook Verify Token.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/config/system', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'meta_verify_token', value: verifyToken.trim() })
      });
      if (res.ok) {
        showFeedback(true, 'Verify Token salvo com sucesso!');
      } else {
        showFeedback(false, 'Falha ao salvar configuração.');
      }
    } catch {
      showFeedback(false, 'Erro ao salvar.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMetaInstance = async () => {
    if (!newMetaPhoneId.trim() || !newMetaToken.trim() || !newMetaNumber.trim()) {
      alert('Preencha os campos obrigatórios: Número, Phone ID e Token.');
      return;
    }
    try {
      const res = await fetch('/api/whatsapp/instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newMetaName.trim() || 'WhatsApp Meta Oficial',
          number: newMetaNumber.trim(),
          phoneId: newMetaPhoneId.trim(),
          token: newMetaToken.trim(),
          engine: 'meta'
        })
      });
      if (res.ok) {
        setNewMetaName(''); setNewMetaNumber(''); setNewMetaPhoneId(''); setNewMetaToken('');
        loadData();
        showFeedback(true, 'Número da Meta cadastrado com sucesso!');
      } else {
        alert('Erro ao cadastrar número da Meta.');
      }
    } catch (e) {
      console.error(e);
      alert('Falha na comunicação com o servidor.');
    }
  };

  const patchMasking = async (patch: Partial<MaskingConfig>) => {
    const updated = { ...masking, ...patch };
    setMasking(updated);
    setSavingMask(true);
    try {
      const res = await fetch('/api/admin/whatsapp-masking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch)
      });
      const data = await res.json();
      if (data.success && data.config) {
        setMasking(data.config);
        setSavedMaskSuccess(true);
        setTimeout(() => setSavedMaskSuccess(false), 2500);
      }
    } catch (e) {
      console.error('Erro ao sincronizar mascaramento:', e);
    } finally {
      setSavingMask(false);
    }
  };

  const handleSaveMasking = async () => {
    setSavingMask(true);
    try {
      const res = await fetch('/api/admin/whatsapp-masking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(masking)
      });
      const data = await res.json();
      if (data.success && data.config) {
        setMasking(data.config);
        setSavedMaskSuccess(true);
        setTimeout(() => setSavedMaskSuccess(false), 3000);
        showFeedback(true, 'Configurações de proteção anti-ban salvas e ativas em todos os números!');
      } else {
        showFeedback(false, data.error || 'Erro ao salvar mascaramento');
      }
    } catch (e) {
      console.error('Erro ao salvar mascaramento anti-ban:', e);
      showFeedback(false, 'Falha de comunicação ao salvar anti-ban');
    } finally {
      setSavingMask(false);
    }
  };

  const baileysInstances = instances.filter(i => (i.engine || 'baileys') === 'baileys');
  const metaInstances = instances.filter(i => i.engine === 'meta');

  const getStatusBadge = (s: string) => {
    switch (s) {
      case 'connected':
        return { label: 'Conectado', classes: 'text-emerald-700 bg-emerald-50 border-emerald-300 font-bold' };
      case 'waiting_qr':
        return { label: 'Aguardando QR Code', classes: 'text-amber-800 bg-amber-50 border-amber-300 font-bold animate-pulse' };
      case 'reconnecting':
        return { label: 'Reconectando...', classes: 'text-sky-800 bg-sky-50 border-sky-300 font-bold' };
      case 'suspended':
        return { label: 'Suspenso (Preservado)', classes: 'text-sky-800 bg-sky-50 border-sky-200 font-bold' };
      default:
        return { label: 'Desconectado', classes: 'text-slate-600 bg-slate-100 border-slate-300 font-bold' };
    }
  };

  const activeMaskModes = masking.enabled ? [
    masking.browserFingerprint,
    masking.simulateTyping,
    masking.simulateReading,
    masking.simulateReceipt,
    masking.typingDelayBetweenChunks,
    masking.standbyEnabled,
    masking.typingCancelSimulation,
  ].filter(Boolean).length : 0;

  return (
    <main className="mg-page-container max-w-6xl mx-auto">

      {/* ── HEADER ─────────────────────────────────────────── */}
      <header className="mg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${
              modeInfo.mode === 'hybrid' ? 'bg-teal-500 shadow-[0_0_8px_hsl(174,72%,40%)]' :
              modeInfo.mode === 'meta' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' :
              modeInfo.mode === 'baileys' ? 'bg-sky-500 shadow-[0_0_8px_#0ea5e9]' :
              'bg-slate-400'
            }`} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--mg-text-muted)' }}>
              WHATSAPP HUB // DUAL-ENGINE HÍBRIDO & MULTI-INSTÂNCIA
            </span>
          </div>
          <h1 className="mg-page-title flex items-center gap-3">
            Central de WhatsApp
            <span className={`text-xs px-2.5 py-1 rounded-full font-bold border uppercase tracking-wider ${
              modeInfo.mode === 'hybrid' ? 'bg-teal-50 dark:bg-teal-950/50 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/60' :
              modeInfo.mode === 'meta' ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/60' :
              modeInfo.mode === 'baileys' ? 'bg-sky-50 dark:bg-sky-950/50 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800/60' :
              'mg-badge-neutral'
            }`}>
              {modeInfo.mode === 'hybrid' ? '⚡ Modo Híbrido Concorrente' :
               modeInfo.mode === 'meta' ? '🛡️ Apenas Meta Cloud API' :
               modeInfo.mode === 'baileys' ? '📱 Apenas Baileys Multi-Device' :
               '○ Motores Desativados'}
            </span>
          </h1>
          <p className="mg-page-subtitle mt-1 max-w-3xl leading-relaxed">
            Opere a API Oficial da Meta e o WhatsApp Web Baileys simultaneamente ou de forma isolada. Suporte a múltiplos aparelhos com rotação inteligente, Session Pinning e proteção anti-ban.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <div className="px-4 py-2 rounded-xl border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)] text-xs font-bold" style={{ color: 'var(--mg-text-heading)' }}>
            {baileysInstances.filter(i => i.status === 'connected').length} Baileys Online • {metaInstances.length} Meta Ativos
          </div>
        </div>
      </header>

      {/* ── TABS NAVIGATION ─────────────────────────────────── */}
      <nav className="mg-tabs-container">
        <button
          type="button"
          onClick={() => setActiveTab('connections')}
          className={`mg-tab-item ${activeTab === 'connections' ? 'active' : ''}`}
        >
          <Smartphone className="w-4 h-4 text-sky-600" />
          <span>Conexões & Motores</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full border border-[var(--mg-card-border)] bg-[var(--mg-card-bg-subtle)]" style={{ color: 'var(--mg-text-muted)' }}>
            {instances.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('messages')}
          className={`mg-tab-item ${activeTab === 'messages' ? 'active' : ''}`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-600" />
          <span>Personalização de Mensagens</span>
          <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 font-extrabold">
            NOVO
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('masking')}
          className={`mg-tab-item ${activeTab === 'masking' ? 'active' : ''}`}
        >
          <ShieldCheck className="w-4 h-4 text-teal-600" />
          <span>Proteção Anti-Ban</span>
          {masking.enabled && (
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          )}
        </button>
      </nav>

      {/* ── FEEDBACK ──────────────────────────────────────── */}
      {feedback && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border text-sm font-medium transition-all ${
          feedback.success
            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
            : 'bg-amber-50 border-amber-300 text-amber-800'
        }`}>
          {feedback.success
            ? <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            : <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          }
          <span>{feedback.message}</span>
        </div>
      )}

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
          <RefreshCcw className="w-8 h-8 animate-spin text-emerald-600" />
          <p className="text-xs uppercase tracking-wider font-semibold text-slate-600">Carregando motores e instâncias...</p>
        </div>
      ) : (
        <div className="space-y-8">

          {/* ════════════════════════════════════════════════════════
              ABA 1: CONEXÕES & MOTORES
             ════════════════════════════════════════════════════════ */}
          {activeTab === 'connections' && (
            <div className="space-y-8">
              {/* 1. DUAL-ENGINE CONTROLS */}
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <Zap className="w-5 h-5 text-amber-500" />
                      Controle Independente de Motores (Dual-Engine)
                    </h2>
                    <p className="text-xs text-slate-600">
                      Ambos os motores podem rodar em paralelo ou de forma exclusiva sem exclusão mútua.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* CARD: BAILEYS MULTI-DEVICE */}
                  <div className={`p-6 rounded-2xl border transition-all duration-200 bg-white ${
                    modeInfo.baileysEnabled ? 'border-blue-600/40 shadow-sm' : 'border-slate-200/80 shadow-xs'
                  }`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${modeInfo.baileysEnabled ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-500'}`}>
                          <Bot className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">WhatsApp Multi-Device (Baileys)</h3>
                          <span className="text-[10px] font-mono text-blue-600 uppercase tracking-widest font-bold">
                            Multi-Aparelhos // Rotação Round-Robin
                          </span>
                        </div>
                      </div>
                      <ToggleSwitch
                        enabled={modeInfo.baileysEnabled}
                        onChange={() => handleToggleEngine('baileys', modeInfo.baileysEnabled)}
                        disabled={togglingEngine === 'baileys'}
                      />
                    </div>
                    <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">
                      Conecte múltiplos números através de QR Code. Disparos rotativos de vouchers, suporte interativo e respostas bidirecionais autônomas.
                    </p>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className={modeInfo.baileysEnabled ? 'mg-badge-info' : 'mg-badge-neutral'}>
                        {modeInfo.baileysEnabled ? '● Motor Ativo' : '○ Motor Desligado'}
                      </span>
                      <span className="text-slate-600 font-semibold">{baileysInstances.length} aparelho(s) cadastrado(s)</span>
                    </div>
                  </div>

                  {/* CARD: META CLOUD API */}
                  <div className={`p-6 rounded-2xl border transition-all duration-200 bg-white ${
                    modeInfo.metaEnabled ? 'border-emerald-600/40 shadow-sm' : 'border-slate-200/80 shadow-xs'
                  }`}>
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${modeInfo.metaEnabled ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                          <ShieldCheck className="w-6 h-6" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-base">API Oficial da Meta Cloud</h3>
                          <span className="text-[10px] font-mono text-emerald-600 uppercase tracking-widest font-bold">
                            Meta Graph API // Templates Pré-Aprovados
                          </span>
                        </div>
                      </div>
                      <ToggleSwitch
                        enabled={modeInfo.metaEnabled}
                        onChange={() => handleToggleEngine('meta', modeInfo.metaEnabled)}
                        disabled={togglingEngine === 'meta'}
                      />
                    </div>
                    <p className="text-xs text-slate-600 mb-4 leading-relaxed font-medium">
                      Disparo de notificações oficiais com zero risco de banimento. Ao suspender o motor, todos os tokens e IDs permanecem preservados em definitivo.
                    </p>
                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                      <span className={modeInfo.metaEnabled ? 'mg-badge-success' : 'mg-badge-neutral'}>
                        {modeInfo.metaEnabled ? '● Motor Ativo' : '🛡️ Suspenso (Dados Salvos)'}
                      </span>
                      <span className="text-slate-600 font-semibold">{metaInstances.length} número(s) Meta</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* 2. BAILEYS MULTI-INSTANCE MANAGEMENT */}
              {modeInfo.baileysEnabled && (
                <section className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-sky-600" />
                        Aparelhos WhatsApp Conectados ({baileysInstances.length})
                      </h2>
                      <p className="text-xs text-slate-600">
                        Gerencie cada conexão individualmente. Mensagens e vouchers serão distribuídos em Round-Robin entre os números online.
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCreateBaileysInstance}
                        disabled={creatingInstance}
                        className="px-4 py-2.5 rounded-xl text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                      >
                        <Plus className="w-4 h-4" />
                        Conectar Novo WhatsApp
                      </button>
                    </div>
                  </div>

                  {/* Instances Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {baileysInstances.map((inst) => {
                      const bStatus = getStatusBadge(inst.status);
                      const isBusy = actionInProgress === inst.id;

                      return (
                        <div
                          key={inst.id}
                          className={`p-5 rounded-2xl bg-white border-2 transition-all flex flex-col justify-between gap-4 shadow-xs ${
                            inst.status === 'connected'
                              ? 'border-emerald-500/60 shadow-emerald-500/5'
                              : inst.status === 'waiting_qr'
                              ? 'border-amber-400/80 shadow-amber-500/5'
                              : 'border-slate-200'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2.5 min-w-0">
                                <div className={`p-2.5 rounded-xl shrink-0 ${
                                  inst.status === 'connected' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                                }`}>
                                  <Phone className="w-4 h-4" />
                                </div>
                                <div className="min-w-0">
                                  <h3 className="font-black text-slate-900 text-sm truncate">{inst.name}</h3>
                                  <p className="text-[11px] font-mono text-slate-700 font-bold truncate">
                                    {inst.number || 'Aguardando pareamento'}
                                  </p>
                                </div>
                              </div>
                              <span className={`px-2.5 py-1 rounded-full text-[10px] border uppercase shrink-0 ${bStatus.classes}`}>
                                {bStatus.label}
                              </span>
                            </div>

                            {inst.dailyCount !== undefined && (
                              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5 flex items-center justify-between text-xs text-slate-600 mb-2">
                                <span className="flex items-center gap-1.5 font-medium">
                                  <Activity className="w-3.5 h-3.5 text-slate-400" />
                                  Mensagens hoje:
                                </span>
                                <span className="font-bold text-slate-900">{inst.dailyCount}</span>
                              </div>
                            )}

                            {/* Grupo da Biblioteca de Mídias */}
                            <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-2.5 text-xs mb-1">
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="flex items-center gap-1.5 font-bold text-slate-700 text-[10px] uppercase tracking-wider">
                                  <Library className="w-3.5 h-3.5 text-emerald-600" />
                                  Grupo de Mídias
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleOpenGroupModal(inst)}
                                  className="text-[11px] font-bold text-emerald-600 hover:text-emerald-700 hover:underline flex items-center gap-1 cursor-pointer"
                                >
                                  <FolderPlus className="w-3 h-3" />
                                  {inst.libraryGroupJid ? 'Alterar' : 'Escolher Grupo'}
                                </button>
                              </div>
                              {inst.libraryGroupJid ? (
                                <div className="flex items-center justify-between gap-1.5 bg-emerald-50/80 border border-emerald-200 rounded-lg px-2.5 py-1.5">
                                  <div className="min-w-0">
                                    <p className="font-bold text-emerald-950 text-xs truncate flex items-center gap-1">
                                      <Users className="w-3 h-3 text-emerald-600 shrink-0" />
                                      {inst.libraryGroupName || 'Grupo Conectado'}
                                    </p>
                                    <p className="text-[10px] font-mono text-emerald-700/80 truncate">
                                      {inst.libraryGroupJid}
                                    </p>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleUnbindGroup(inst.id)}
                                    className="text-slate-400 hover:text-rose-600 p-1 cursor-pointer shrink-0 transition-colors"
                                    title="Desvincular grupo deste número"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <p className="text-[10px] text-slate-600 leading-tight">
                                  Nenhum grupo vinculado.{' '}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenGroupModal(inst)}
                                    className="font-bold text-emerald-600 hover:underline cursor-pointer"
                                  >
                                    Clique em Escolher Grupo para vincular.
                                  </button>
                                </p>
                              )}
                            </div>

                            {/* ⚠️ Aviso de falha de ingresso no grupo */}
                            {inst.groupJoinError && (
                              <div className="mt-2 flex items-start gap-2 bg-amber-50 border border-amber-300 rounded-xl px-3 py-2.5">
                                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-[10px] font-black text-amber-800 uppercase tracking-wide mb-0.5">Falha ao ingressar no grupo</p>
                                  <p className="text-[11px] text-amber-700 leading-snug break-words">{inst.groupJoinError}</p>
                                  {inst.status === 'connected' && (
                                    <button
                                      type="button"
                                      onClick={() => handleInstanceAction(inst.id, 'restart')}
                                      className="mt-1.5 text-[10px] font-bold text-amber-700 hover:text-amber-900 underline underline-offset-2 cursor-pointer flex items-center gap-1"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      Tentar novamente (reiniciar)
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Botões de Ação */}
                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5">
                              {inst.status !== 'connected' && (
                                <button
                                  type="button"
                                  onClick={() => handleStartPairing(inst, true)}
                                  disabled={actionInProgress === `pair_${inst.id}`}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200 flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  title="Parear aparelho via QR Code"
                                >
                                  <QrCode className={`w-3.5 h-3.5 ${actionInProgress === `pair_${inst.id}` ? 'animate-spin' : ''}`} />
                                  Parear
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => handleInstanceAction(inst.id, 'restart')}
                                disabled={isBusy}
                                className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 border border-slate-200 cursor-pointer"
                                title="Reiniciar Conexão"
                              >
                                <RotateCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                              </button>
                              {inst.status === 'connected' && (
                                <button
                                  type="button"
                                  onClick={() => handleInstanceAction(inst.id, 'disconnect')}
                                  disabled={isBusy}
                                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 flex items-center gap-1 cursor-pointer"
                                  title="Desconectar com Graceful Shutdown"
                                >
                                  <LogOut className="w-3.5 h-3.5" />
                                  Desconectar
                                </button>
                              )}
                            </div>

                            <button
                              type="button"
                              onClick={() => handleInstanceAction(inst.id, 'delete')}
                              disabled={isBusy}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                              title="Excluir Instância"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      );
                    })}

                    {baileysInstances.length === 0 && (
                      <div className="col-span-full p-8 rounded-2xl bg-slate-50 border border-slate-200 border-dashed text-center space-y-3">
                        <WifiOff className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm font-bold text-slate-700">Nenhum aparelho WhatsApp conectado no Baileys.</p>
                        <p className="text-xs text-slate-500">Clique em &quot;Conectar Novo WhatsApp&quot; para parear seu primeiro número.</p>
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* META CLOUD API CONFIG */}
              <section className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                      <ShieldCheck className="w-5 h-5 text-emerald-600" />
                      Configuração da Meta Cloud API Oficial
                    </h2>
                    <p className="text-xs text-slate-600">
                      Conecte números da Meta Cloud API via Access Token permanente.
                    </p>
                  </div>
                </div>

                {/* Add Meta Number Form */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
                  <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    Adicionar Novo Número Oficial (Meta)
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">Nome de Identificação</label>
                      <input
                        type="text" value={newMetaName} onChange={(e) => setNewMetaName(e.target.value)}
                        placeholder="Ex: WhatsApp Oficial Suporte"
                        className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">Número (com DDI)</label>
                      <input
                        type="text" value={newMetaNumber} onChange={(e) => setNewMetaNumber(e.target.value)}
                        placeholder="Ex: 5544999999999"
                        className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">Phone Number ID (Meta Developers)</label>
                      <input
                        type="text" value={newMetaPhoneId} onChange={(e) => setNewMetaPhoneId(e.target.value)}
                        placeholder="Ex: 105829482910482"
                        className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">Permanent Access Token</label>
                      <input
                        type="password" value={newMetaToken} onChange={(e) => setNewMetaToken(e.target.value)}
                        placeholder="EAALX..."
                        className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMetaInstance}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-4 h-4" /> Cadastrar Número da Meta
                  </button>
                </div>
              </section>
            </div>
          )}

          {/* ════════════════════════════════════════════════════════
              ABA 2: PERSONALIZAÇÃO DE MENSAGENS (NOVO)
             ════════════════════════════════════════════════════════ */}
          {activeTab === 'messages' && (
            <WhatsappMessageCustomizer />
          )}

          {/* ════════════════════════════════════════════════════════
              ABA 3: PROTEÇÃO ANTI-BAN
             ════════════════════════════════════════════════════════ */}
          {activeTab === 'masking' && (
            <section className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                    <span className="text-xl">🎭</span>
                    Modos de Mascaramento Anti-Ban (Humano)
                  </h2>
                  <p className="text-xs text-slate-600 leading-relaxed max-w-xl">
                    Cada aparelho Baileys herda estes padrões comportamentais: fingerprint Chrome legítimo, digitação humana (50-70 WPM) e pausas naturais.
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {activeMaskModes > 0 && (
                    <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
                      {activeMaskModes}/7 ativos
                    </span>
                  )}
                  <ToggleSwitch
                    enabled={masking.enabled}
                    onChange={(v) => patchMasking({ enabled: v })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MaskingCard
                  icon={Layers}
                  title="Browser Fingerprint (Chrome)"
                  description="Identifica todos os clientes como Google Chrome 125.0 no protocolo WhatsApp Web."
                  enabled={masking.browserFingerprint}
                  onToggle={(v) => patchMasking({ browserFingerprint: v })}
                  masterEnabled={masking.enabled}
                  color="sky"
                />

                <MaskingCard
                  icon={MessageSquare}
                  title="Simulação de Digitação"
                  description='Exibe "digitando..." por tempo proporcional ao comprimento da mensagem.'
                  enabled={masking.simulateTyping}
                  onToggle={(v) => patchMasking({ simulateTyping: v })}
                  masterEnabled={masking.enabled}
                  color="amber"
                />

                <MaskingCard
                  icon={Eye}
                  title="Simulação de Leitura"
                  description="Marca mensagens recebidas como lidas após 2–8 segundos de leitura humana."
                  enabled={masking.simulateReading}
                  onToggle={(v) => patchMasking({ simulateReading: v })}
                  masterEnabled={masking.enabled}
                  color="emerald"
                />

                <MaskingCard
                  icon={CheckCircle2}
                  title="Confirmação de Recebimento"
                  description="Adiciona delay de 0.5–2s antes de confirmar entrega para simular latência de rede móvel."
                  enabled={masking.simulateReceipt}
                  onToggle={(v) => patchMasking({ simulateReceipt: v })}
                  masterEnabled={masking.enabled}
                  color="sky"
                />

                <MaskingCard
                  icon={Pause}
                  title="Delay entre Blocos de Texto"
                  description="Quebra textos longos em parágrafos com intervalo de 1–3.5s entre cada envio."
                  enabled={masking.typingDelayBetweenChunks}
                  onToggle={(v) => patchMasking({ typingDelayBetweenChunks: v })}
                  masterEnabled={masking.enabled}
                  color="violet"
                />

                <MaskingCard
                  icon={MousePointerClick}
                  title="Digitação com Hesitação"
                  description='Simula digitação humana realista: "digitando..." → pausa → "digitando..." novamente.'
                  enabled={masking.typingCancelSimulation}
                  onToggle={(v) => patchMasking({ typingCancelSimulation: v })}
                  masterEnabled={masking.enabled}
                  color="amber"
                />

                {/* Standby Full Width */}
                <div className="md:col-span-2">
                  <MaskingCard
                    icon={Clock}
                    title="Simulação de Standby (Delay de Atendimento)"
                    description="Aguarda um intervalo aleatório antes de iniciar a resposta, simulando um atendente humano ocupado."
                    enabled={masking.standbyEnabled}
                    onToggle={(v) => patchMasking({ standbyEnabled: v })}
                    masterEnabled={masking.enabled}
                    color="rose"
                  >
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Delay Mínimo</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={10} max={masking.standbyMaxSeconds - 10} step={5}
                            value={masking.standbyMinSeconds}
                            onChange={(e) => patchMasking({ standbyMinSeconds: parseInt(e.target.value) })}
                            className="flex-1 accent-rose-500"
                          />
                          <span className="text-xs font-mono font-bold text-rose-700 w-12 text-right shrink-0">{masking.standbyMinSeconds}s</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5 block">Delay Máximo</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="range" min={masking.standbyMinSeconds + 10} max={300} step={5}
                            value={masking.standbyMaxSeconds}
                            onChange={(e) => patchMasking({ standbyMaxSeconds: parseInt(e.target.value) })}
                            className="flex-1 accent-rose-500"
                          />
                          <span className="text-xs font-mono font-bold text-rose-700 w-12 text-right shrink-0">{masking.standbyMaxSeconds}s</span>
                        </div>
                      </div>
                    </div>
                  </MaskingCard>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-slate-600">Configurações aplicadas dinamicamente a todas as instâncias Baileys.</p>
                  {savedMaskSuccess && (
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200 flex items-center gap-1.5 animate-fade-in">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      Salvo e sincronizado com o Baileys!
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleSaveMasking}
                  disabled={savingMask}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors flex items-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <Save className={`w-4 h-4 ${savingMask ? 'animate-spin' : ''}`} />
                  {savingMask ? 'Salvando...' : 'Salvar Mascaramento'}
                </button>
              </div>
            </section>
          )}

          {/* ════════════════════════════════════════════════════════
              4. META CLOUD API SECTION
             ════════════════════════════════════════════════════════ */}
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  Configuração da Meta Cloud API Oficial
                </h2>
                <p className="text-xs text-slate-600">
                  Gerenciamento de credenciais permanentes, Webhook e números oficiais da Meta.
                </p>
              </div>
            </div>

            {/* Webhook Settings */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <LinkIcon className="w-4 h-4 text-emerald-600" />
                Webhook Verify Token
              </h3>
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={verifyToken}
                  onChange={(e) => setVerifyToken(e.target.value)}
                  placeholder="Seu token secreto de webhook configurado na Meta"
                  className="flex-1 bg-slate-50 border border-slate-300 focus:bg-white focus:border-emerald-500 rounded-xl px-4 py-2.5 text-sm text-slate-900 focus:outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveVerifyToken}
                  disabled={saving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Salvando...' : 'Salvar Token'}
                </button>
              </div>
            </div>

            {/* Meta Numbers Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {metaInstances.map((inst) => (
                <div key={inst.id} className="p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{inst.name}</h3>
                      <p className="text-slate-600 font-mono text-sm">{inst.number || 'Número Meta'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleInstanceAction(inst.id, 'delete')}
                      className="text-slate-400 hover:text-rose-600 p-1 transition-colors cursor-pointer"
                      title="Excluir Número"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-slate-500 font-mono text-[11px]">Phone ID: {inst.phoneId}</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                      modeInfo.metaEnabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-teal-50 text-teal-700 border border-teal-200'
                    }`}>
                      {modeInfo.metaEnabled ? 'Ativo' : 'Suspenso'}
                    </span>
                  </div>
                </div>
              ))}

              {metaInstances.length === 0 && (
                <div className="col-span-full p-8 rounded-2xl bg-slate-50 border border-slate-200 border-dashed text-center text-slate-500 text-xs">
                  Nenhum número da Meta cadastrado no momento. Cadastre abaixo.
                </div>
              )}
            </div>

            {/* Add Meta Number Form */}
            <div className="p-6 rounded-2xl bg-white border border-slate-200/90 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                Adicionar Novo Número Oficial (Meta)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">Nome de Identificação</label>
                  <input
                    type="text" value={newMetaName} onChange={(e) => setNewMetaName(e.target.value)}
                    placeholder="Ex: WhatsApp Oficial Suporte"
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">Número (com DDI)</label>
                  <input
                    type="text" value={newMetaNumber} onChange={(e) => setNewMetaNumber(e.target.value)}
                    placeholder="Ex: 5544999999999"
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">Phone Number ID (Meta Developers)</label>
                  <input
                    type="text" value={newMetaPhoneId} onChange={(e) => setNewMetaPhoneId(e.target.value)}
                    placeholder="Ex: 105829482910482"
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="text-[10px] font-bold text-slate-700 uppercase tracking-wider mb-1 block">Permanent Access Token</label>
                  <input
                    type="password" value={newMetaToken} onChange={(e) => setNewMetaToken(e.target.value)}
                    placeholder="EAALX..."
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white rounded-xl px-3.5 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-emerald-500 font-mono"
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddMetaInstance}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" /> Cadastrar Número da Meta
              </button>
            </div>
          </section>

        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          5. MODAL DE PAREAMENTO MULTI-QR (BAILEYS)
         ════════════════════════════════════════════════════════ */}
      {isPairingModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.72)' }}
        >
          <div className="bg-white border-2 border-slate-300 rounded-3xl shadow-2xl max-w-xl w-full p-6 md:p-8 space-y-6 relative animate-scale-in text-slate-900">
            <button
              type="button"
              onClick={() => setIsPairingModalOpen(false)}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer transition-colors"
              title="Fechar"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-500 animate-ping" />
                <span className="text-[11px] font-mono text-sky-900 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-300 uppercase font-black tracking-widest">
                  PAREAMENTO BAILEYS // {pairingInstance?.name || 'NOVA INSTÂNCIA'}
                </span>
              </div>
              <h3 className="text-xl font-black text-slate-900 tracking-tight">
                Escaneie o QR Code com seu WhatsApp
              </h3>
              <p className="text-xs text-slate-600 mt-1 font-medium">
                Aponte o leitor de aparelhos conectados do aplicativo para sincronizar este número.
              </p>
            </div>

            <div className="flex flex-col md:flex-row items-center justify-center gap-6 pt-1">
              <div className="p-3 bg-white border-2 border-slate-300 rounded-2xl shadow-sm shrink-0 flex flex-col items-center">
                {pairingInstance?.status === 'connected' ? (
                  <div className="w-[210px] h-[210px] flex flex-col items-center justify-center gap-2 text-emerald-900 bg-emerald-50 border-2 border-emerald-300 rounded-xl p-3 text-center">
                    <div className="w-14 h-14 rounded-full bg-emerald-600 flex items-center justify-center text-white shadow-md mb-1">
                      <CheckCircle2 className="w-9 h-9" />
                    </div>
                    <span className="font-extrabold text-sm uppercase tracking-wider text-emerald-950">Aparelho Pareado!</span>
                    <span className="text-xs font-black text-slate-900 font-mono bg-white px-3 py-1 rounded-lg border border-emerald-300 shadow-xs">
                      +{pairingInstance.number}
                    </span>
                    <span className="text-[11px] font-bold text-emerald-700 mt-0.5 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      Sincronizado & Online
                    </span>
                  </div>
                ) : pairingInstance?.qrCode ? (
                  <>
                    <div className="p-2 bg-white rounded-xl border border-slate-200 shadow-inner">
                      <QRCodeSVG value={pairingInstance.qrCode} size={190} level="M" includeMargin={true} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-2.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-[11px] font-extrabold tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
                      QR CODE ATIVO & PRONTO
                    </div>
                  </>
                ) : (
                  <div className="w-[210px] h-[210px] flex flex-col items-center justify-center gap-2.5 bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
                    <RefreshCcw className="w-9 h-9 animate-spin text-sky-600" />
                    <span className="text-xs font-bold text-slate-800">Gerando QR Code...</span>
                    <span className="text-[11px] font-medium text-slate-500">Iniciando socket Baileys</span>
                  </div>
                )}
              </div>

              <div className="space-y-3.5 text-xs text-slate-800 flex-1">
                <div className="flex items-center gap-2 pb-1.5 border-b border-slate-200">
                  <Smartphone className="w-4 h-4 text-sky-600 shrink-0" />
                  <h4 className="font-black text-slate-900 uppercase tracking-wider text-xs">
                    Instruções de conexão:
                  </h4>
                </div>

                <ol className="space-y-2.5">
                  {[
                    { num: '1', title: 'Abra o WhatsApp', desc: 'No celular com o chip deste número.' },
                    { num: '2', title: 'Aparelhos Conectados', desc: 'Toque em ⋮ (Android) ou Configurações (iPhone).' },
                    { num: '3', title: 'Conectar um Aparelho', desc: 'Toque no botão de conexão verde.' },
                    { num: '4', title: 'Aponte a Câmera', desc: 'Escaneie o QR Code em destaque ao lado.' },
                  ].map((item) => (
                    <li key={item.num} className="flex items-start gap-2.5">
                      <span className="flex items-center justify-center w-5 h-5 rounded-full bg-slate-900 text-white font-black shrink-0 text-[11px] shadow-xs">
                        {item.num}
                      </span>
                      <div className="text-xs leading-snug">
                        <span className="font-extrabold text-slate-900">{item.title}: </span>
                        <span className="font-medium text-slate-700">{item.desc}</span>
                      </div>
                    </li>
                  ))}
                </ol>

                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2 text-[11px] text-amber-950 font-medium">
                  <span className="text-amber-600 font-bold shrink-0">💡</span>
                  <span>Mantenha o aparelho conectado à internet até concluir a primeira sincronização.</span>
                </div>

                {pairingInstance?.id && (
                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => handleStartPairing(pairingInstance, true)}
                      disabled={actionInProgress === `pair_${pairingInstance.id}`}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 border border-slate-300 flex items-center gap-2 cursor-pointer shadow-xs transition-colors disabled:opacity-50"
                    >
                      <RotateCw className={`w-3.5 h-3.5 text-sky-600 ${actionInProgress === `pair_${pairingInstance.id}` ? 'animate-spin' : ''}`} />
                      <span>Gerar Novo QR Code</span>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 flex justify-end">
              <button
                type="button"
                onClick={() => setIsPairingModalOpen(false)}
                className="px-6 py-2.5 rounded-xl text-xs font-extrabold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer shadow-md hover:shadow-lg transition-all"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: SELEÇÃO DE GRUPO DA BIBLIOTECA DE MÍDIAS */}
      {isGroupModalOpen && selectedGroupInstance && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
                  <Library className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-800">
                    Escolher Grupo da Biblioteca
                  </h3>
                  <p className="text-xs text-slate-500">
                    Aparelho: <span className="font-semibold text-slate-700">{selectedGroupInstance.name}</span>
                    {selectedGroupInstance.number ? ` (${selectedGroupInstance.number})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explicação da flexibilidade */}
            <div className="mt-4 p-3.5 bg-emerald-50/70 border border-emerald-200/80 rounded-2xl text-xs text-emerald-900 leading-relaxed">
              <p className="font-semibold flex items-center gap-1.5 mb-1">
                <span>💡</span> Como funciona o reencaminhamento humano:
              </p>
              <p>
                Crie um grupo no WhatsApp e adicione este número nele. Qualquer imagem, banner, vídeo ou áudio enviado no grupo é salvo automaticamente nesta biblioteca para reenvio sem upload repetido.
              </p>
              <p className="mt-1 text-emerald-800 font-medium">
                • <strong>Grupos individuais:</strong> Cada número pode ter seu próprio grupo com banners e mídias exclusivas.
                <br />
                • <strong>Grupo único compartilhado:</strong> Ou adicione os 4 números no mesmo grupo e marque a caixa abaixo para que todos usem as mesmas mídias.
              </p>
            </div>

            {/* Vínculo Manual ou Busca */}
            <div className="mt-4 p-3 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>🔗</span> Vincular Grupo por ID / JID (funciona mesmo com WhatsApp desconectado):
                </span>
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Ex: 120363430512775259@g.us"
                  value={manualGroupJid}
                  onChange={(e) => setManualGroupJid(e.target.value)}
                  className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 font-mono"
                />
                <button
                  type="button"
                  onClick={handleSaveManualGroup}
                  disabled={savingGroup || !manualGroupJid.trim()}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl disabled:opacity-50 cursor-pointer shadow-xs transition-all"
                >
                  {savingGroup ? 'Salvando...' : 'Salvar Grupo'}
                </button>
              </div>
            </div>

            {/* Barra de busca e atualizar */}
            <div className="mt-3 flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Pesquisar grupo pelo nome..."
                  value={groupSearchQuery}
                  onChange={(e) => setGroupSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
              <button
                type="button"
                onClick={() => handleOpenGroupModal(selectedGroupInstance)}
                disabled={loadingGroups}
                title="Recarregar grupos do WhatsApp"
                className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-all disabled:opacity-50"
              >
                <RefreshCcw className={`w-4 h-4 ${loadingGroups ? 'animate-spin text-emerald-600' : ''}`} />
              </button>
            </div>

            {/* Lista de Grupos */}
            <div className="mt-3 flex-1 overflow-y-auto min-h-[220px] max-h-[340px] pr-1 space-y-2">
              {loadingGroups ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                  <RefreshCcw className="w-6 h-6 animate-spin text-emerald-600" />
                  <span className="text-xs font-medium">Consultando grupos onde este número participa...</span>
                </div>
              ) : groupsList.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 px-4 text-center border-2 border-dashed border-slate-200 rounded-2xl">
                  <Users className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-700">Nenhum grupo encontrado</p>
                  <p className="text-[11px] text-slate-500 mt-1 max-w-sm">
                    Certifique-se de que o aparelho está conectado e já foi adicionado a pelo menos um grupo no WhatsApp.
                  </p>
                </div>
              ) : (
                (() => {
                  const filtered = groupsList.filter((g) =>
                    g.subject.toLowerCase().includes(groupSearchQuery.toLowerCase())
                  );

                  if (filtered.length === 0) {
                    return (
                      <div className="py-8 text-center text-xs text-slate-400">
                        Nenhum grupo corresponde à busca &quot;{groupSearchQuery}&quot;
                      </div>
                    );
                  }

                  return filtered.map((g) => {
                    const isCurrent = selectedGroupInstance.libraryGroupJid === g.jid;
                    return (
                      <div
                        key={g.jid}
                        className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                          isCurrent
                            ? 'bg-emerald-50/60 border-emerald-300'
                            : 'bg-white hover:bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isCurrent ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            <Users className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <h4 className="text-xs font-bold text-slate-800 truncate">
                                {g.subject}
                              </h4>
                              {isCurrent && (
                                <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                  <Check className="w-2.5 h-2.5" /> Ativo
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-400 truncate">
                              {g.participantsCount} participantes • <span className="font-mono text-[9px] text-slate-300">{g.jid.split('@')[0]}</span>
                            </p>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSelectGroup(g)}
                          disabled={savingGroup}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                            isCurrent
                              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm'
                              : 'bg-slate-900 hover:bg-slate-800 text-white shadow-sm'
                          }`}
                        >
                          {savingGroup ? 'Salvando...' : isCurrent ? 'Selecionado' : 'Usar Este'}
                        </button>
                      </div>
                    );
                  });
                })()
              )}
            </div>

            {/* Checkbox aplicar para todos os 4 números */}
            <div className="mt-4 pt-3 border-t border-slate-100">
              <label className="flex items-start gap-2.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={applyGroupToAll}
                  onChange={(e) => setApplyGroupToAll(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                />
                <span className="text-xs text-slate-700 font-medium">
                  <strong>Vincular este mesmo grupo para os outros números cadastrados</strong>
                  <br />
                  <span className="text-[11px] text-slate-500 font-normal">
                    Permite que todos os 4 números enviem os mesmos banners, imagens e vídeos da mesma biblioteca.
                  </span>
                </span>
              </label>
            </div>

            {/* Footer */}
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-[11px] text-slate-400">
                {groupsList.length} grupo(s) detectado(s)
              </span>
              <button
                type="button"
                onClick={() => setIsGroupModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

    </main>
  );
}
