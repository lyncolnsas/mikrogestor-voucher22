"use client";

import React, { useState } from 'react';
import {
  Layers,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  Trash2,
  Plus,
  Sliders,
  Sparkles,
  KeyRound,
  Zap,
  Megaphone,
  Wifi,
  ShieldCheck,
  MessageCircle,
  MapPin,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Box,
  Palette,
  Check,
  Type,
  Maximize2,
  GripVertical,
  Image as ImageIcon,
  FolderOpen,
  Code2,
  FileText,
  AlertCircle
} from 'lucide-react';

export type TaxonomyCategory = 
  | 'identity' 
  | 'communication' 
  | 'feedback' 
  | 'interaction' 
  | 'incentive' 
  | 'marketing' 
  | 'status' 
  | 'support' 
  | 'metadata';

export interface ModularBlockItem {
  id: string;
  type: 'branding' | 'welcome' | 'ads' | 'auth' | 'trial' | 'badges' | 'props' | 'whatsapp' | 'footer';
  taxonomy?: TaxonomyCategory;
  taxonomyLabel?: string;
  label: string;
  description: string;
  enabled: boolean;
  canDelete?: boolean;
}

export function getTaxonomyBadge(type: ModularBlockItem['type']) {
  switch (type) {
    case 'branding':
      return { code: 'IDENTITY', label: 'Identidade', colorCls: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20' };
    case 'welcome':
      return { code: 'COMMUNICATION', label: 'Comunicação', colorCls: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20' };
    case 'auth':
      return { code: 'INTERACTION', label: 'Autenticação', colorCls: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' };
    case 'trial':
      return { code: 'INCENTIVE', label: 'Cortesia', colorCls: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20' };
    case 'ads':
      return { code: 'MARKETING', label: 'Mídia & Ads', colorCls: 'bg-pink-500/10 text-pink-600 dark:text-pink-400 border-pink-500/20' };
    case 'badges':
      return { code: 'STATUS', label: 'Diagnóstico', colorCls: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20' };
    case 'props':
      return { code: 'FEEDBACK', label: 'Regras & Alerta', colorCls: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20' };
    case 'whatsapp':
      return { code: 'SUPPORT', label: 'Atendimento', colorCls: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20' };
    case 'footer':
      return { code: 'METADATA', label: 'Metadados', colorCls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
    default:
      return { code: 'BLOCK', label: 'Bloco', colorCls: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' };
  }
}

export const DEFAULT_FAP_BLOCKS: ModularBlockItem[] = [
  { id: 'branding', type: 'branding', taxonomy: 'identity', taxonomyLabel: 'Identidade', label: 'Cabeçalho & Logotipo FAP', description: 'Logo institucional e identificação do campus', enabled: true, canDelete: false },
  { id: 'welcome', type: 'welcome', taxonomy: 'communication', taxonomyLabel: 'Comunicação', label: 'Mensagem de Boas-Vindas', description: 'Instruções de acesso e subtítulo', enabled: true, canDelete: false },
  { id: 'ads', type: 'ads', taxonomy: 'marketing', taxonomyLabel: 'Mídia & Ads', label: 'Campanhas & Vídeo Ads', description: 'Vídeos institucionais e banners', enabled: true, canDelete: true },
  { id: 'auth', type: 'auth', taxonomy: 'interaction', taxonomyLabel: 'Autenticação', label: 'Formulário de Acesso', description: 'Campos de login/voucher e botões', enabled: true, canDelete: false },
  { id: 'trial', type: 'trial', taxonomy: 'incentive', taxonomyLabel: 'Cortesia', label: 'Acesso Grátis (1-Clique)', description: 'Botão de cortesia de 15 a 30 minutos', enabled: true, canDelete: true },
  { id: 'props', type: 'props', taxonomy: 'feedback', taxonomyLabel: 'Regras & Alerta', label: 'Regras & Anti-Tethering', description: 'Avisos de rede e bloqueio de compartilhamento', enabled: true, canDelete: true },
  { id: 'whatsapp', type: 'whatsapp', taxonomy: 'support', taxonomyLabel: 'Atendimento', label: 'Suporte WhatsApp', description: 'Canal de atendimento direto', enabled: true, canDelete: true },
  { id: 'footer', type: 'footer', taxonomy: 'metadata', taxonomyLabel: 'Metadados', label: 'Rodapé Institucional', description: 'Copyright e identificação do sistema', enabled: true, canDelete: false },
];

export const DEFAULT_CYBER_BLOCKS: ModularBlockItem[] = [
  { id: 'badges', type: 'badges', taxonomy: 'status', taxonomyLabel: 'Diagnóstico', label: 'Badges de Conexão Wi-Fi', description: 'Indicador 5G Ultra Rápido e WPA3', enabled: true, canDelete: true },
  { id: 'branding', type: 'branding', taxonomy: 'identity', taxonomyLabel: 'Identidade', label: 'Identidade & Logotipo', description: 'Logo da empresa e nome da rede', enabled: true, canDelete: false },
  { id: 'welcome', type: 'welcome', taxonomy: 'communication', taxonomyLabel: 'Comunicação', label: 'Mensagem de Boas-Vindas', description: 'Instruções de login por voucher', enabled: true, canDelete: false },
  { id: 'auth', type: 'auth', taxonomy: 'interaction', taxonomyLabel: 'Autenticação', label: 'Formulário Voucher', description: 'Campos de acesso e botão conectar', enabled: true, canDelete: false },
  { id: 'trial', type: 'trial', taxonomy: 'incentive', taxonomyLabel: 'Cortesia', label: 'Acesso de Teste (Trial)', description: 'Liberação temporária de 15 minutos', enabled: true, canDelete: true },
  { id: 'ads', type: 'ads', taxonomy: 'marketing', taxonomyLabel: 'Mídia & Ads', label: 'Banner Patrocinador', description: 'Campanhas de patrocinadores locais', enabled: true, canDelete: true },
  { id: 'props', type: 'props', taxonomy: 'feedback', taxonomyLabel: 'Regras & Alerta', label: 'Regras & Anti-Tethering', description: 'Avisos anti-fraude e bloqueio TTL=1', enabled: true, canDelete: true },
  { id: 'whatsapp', type: 'whatsapp', taxonomy: 'support', taxonomyLabel: 'Atendimento', label: 'Suporte WhatsApp', description: 'Atendimento e suporte ao cliente', enabled: true, canDelete: true },
  { id: 'footer', type: 'footer', taxonomy: 'metadata', taxonomyLabel: 'Metadados', label: 'Rodapé MikroGestor', description: 'Identificação oficial da plataforma', enabled: true, canDelete: false },
];

const AVAILABLE_CATALOG_BLOCKS: Array<{ type: ModularBlockItem['type']; taxonomy: TaxonomyCategory; taxonomyLabel: string; label: string; description: string }> = [
  { type: 'ads', taxonomy: 'marketing', taxonomyLabel: 'Mídia & Ads', label: 'Campanhas & Vídeo Ads', description: 'Vídeo em tela cheia com timer de visualização' },
  { type: 'badges', taxonomy: 'status', taxonomyLabel: 'Diagnóstico', label: 'Badges Wi-Fi 5G & WPA3', description: 'Indicadores modernos de alta velocidade' },
  { type: 'trial', taxonomy: 'incentive', taxonomyLabel: 'Cortesia', label: 'Acesso Grátis de Cortesia', description: '15 minutos de internet livre com 1 clique' },
  { type: 'props', taxonomy: 'feedback', taxonomyLabel: 'Regras & Alerta', label: 'Regras & Anti-Tethering', description: 'Avisos de bloqueio contra compartilhamento' },
  { type: 'whatsapp', taxonomy: 'support', taxonomyLabel: 'Atendimento', label: 'Botão de Suporte WhatsApp', description: 'Canal de suporte direto ao cliente' },
];

function getBlockIcon(type: ModularBlockItem['type']) {
  switch (type) {
    case 'branding': return Layers;
    case 'welcome': return Sparkles;
    case 'ads': return Megaphone;
    case 'auth': return KeyRound;
    case 'trial': return Zap;
    case 'badges': return Wifi;
    case 'props': return ShieldCheck;
    case 'whatsapp': return MessageCircle;
    case 'footer': return MapPin;
    default: return Box;
  }
}

// Cálculo WCAG de contraste
function getLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return 0.5;
  const rgb = [0, 2, 4].map(idx => parseInt(clean.slice(idx, idx + 2), 16) / 255);
  const a = rgb.map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
}

function getContrastRatio(hex1: string, hex2: string): number {
  try {
    const l1 = getLuminance(hex1);
    const l2 = getLuminance(hex2);
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    return Math.round(ratio * 10) / 10;
  } catch {
    return 5.0;
  }
}

interface BlocksStudioPanelProps {
  blocks: ModularBlockItem[];
  setBlocks: React.Dispatch<React.SetStateAction<ModularBlockItem[]>>;
  studio: any;
  setStudio: React.Dispatch<React.SetStateAction<any>>;
  template: string;
  setTemplate: (tpl: string) => void;
  availableTemplates?: string[];
  businessName?: string;
  setBusinessName?: (name: string) => void;
  message?: string;
  setMessage?: (msg: string) => void;
  brand?: any;
  setBrand?: React.Dispatch<React.SetStateAction<any>>;
  social?: any;
  setSocial?: React.Dispatch<React.SetStateAction<any>>;
  badges?: any;
  setBadges?: React.Dispatch<React.SetStateAction<any>>;
  loginButtonLabel?: string;
  setLoginButtonLabel?: (lbl: string) => void;
  registerButtonText?: string;
  setRegisterButtonText?: (txt: string) => void;
  enabled?: boolean;
  setEnabled?: (en: boolean) => void;
  trialText?: string;
  setTrialText?: (txt: string) => void;
  trialLinkText?: string;
  setTrialLinkText?: (txt: string) => void;
  termsText?: string;
  setTermsText?: (txt: string) => void;
  colors?: any;
  setColors?: React.Dispatch<React.SetStateAction<any>>;
  bg?: any;
  setBg?: React.Dispatch<React.SetStateAction<any>>;
  effects?: any;
  setEffects?: React.Dispatch<React.SetStateAction<any>>;
  ad?: any;
  setAd?: React.Dispatch<React.SetStateAction<any>>;
  customCode?: any;
  setCustomCode?: React.Dispatch<React.SetStateAction<any>>;
  colorPresets?: any[];
  nicheEffects?: any[];
  onOpenMediaPicker?: (target: { type: 'bg' | 'logo' | 'ad_single' | 'ad_slot' | 'general'; slot?: number; title: string }) => void;
  onSelectBlockForEdit?: (blockType: ModularBlockItem['type']) => void;
}

export default function BlocksStudioPanel({
  blocks,
  setBlocks,
  studio,
  setStudio,
  template,
  setTemplate,
  availableTemplates = ['default', 'FAP'],
  businessName,
  setBusinessName,
  message,
  setMessage,
  brand,
  setBrand,
  social,
  setSocial,
  badges,
  setBadges,
  loginButtonLabel,
  setLoginButtonLabel,
  registerButtonText,
  setRegisterButtonText,
  enabled,
  setEnabled,
  trialText,
  setTrialText,
  trialLinkText,
  setTrialLinkText,
  termsText,
  setTermsText,
  colors,
  setColors,
  bg,
  setBg,
  effects,
  setEffects,
  ad,
  setAd,
  customCode,
  setCustomCode,
  colorPresets = [],
  nicheEffects = [],
  onOpenMediaPicker,
  onSelectBlockForEdit
}: BlocksStudioPanelProps) {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [dimensionsOpen, setDimensionsOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  // Drag and drop states
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  // Mover bloco para cima
  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setBlocks(prev => {
      const next = [...prev];
      const temp = next[index - 1];
      next[index - 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Mover bloco para baixo
  const handleMoveDown = (index: number) => {
    if (index === blocks.length - 1) return;
    setBlocks(prev => {
      const next = [...prev];
      const temp = next[index + 1];
      next[index + 1] = next[index];
      next[index] = temp;
      return next;
    });
  };

  // Drag and drop drop handler
  const handleDrop = (targetIdx: number) => {
    if (draggedIdx === null || draggedIdx === targetIdx) {
      setDraggedIdx(null);
      setDragOverIdx(null);
      return;
    }
    setBlocks(prev => {
      const next = [...prev];
      const [item] = next.splice(draggedIdx, 1);
      next.splice(targetIdx, 0, item);
      return next;
    });
    setDraggedIdx(null);
    setDragOverIdx(null);
  };

  // Alternar visibilidade do bloco (👁️)
  const handleToggleVisibility = (id: string) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, enabled: !b.enabled } : b));
  };

  // Remover bloco da lista
  const handleDeleteBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
  };

  // Adicionar bloco do catálogo
  const handleAddBlock = (cat: typeof AVAILABLE_CATALOG_BLOCKS[0]) => {
    setBlocks(prev => {
      const existing = prev.find(b => b.type === cat.type);
      if (existing) {
        return prev.map(b => b.type === cat.type ? { ...b, enabled: true } : b);
      }
      return [
        ...prev,
        {
          id: `blk-${cat.type}-${Date.now().toString().slice(-4)}`,
          type: cat.type,
          taxonomy: cat.taxonomy,
          taxonomyLabel: cat.taxonomyLabel,
          label: cat.label,
          description: cat.description,
          enabled: true,
          canDelete: true
        }
      ];
    });
    setShowAddMenu(false);
  };

  // Restaurar ordem padrão do preset
  const handleResetOrder = () => {
    if (template.toLowerCase() === 'fap') {
      setBlocks(DEFAULT_FAP_BLOCKS);
    } else {
      setBlocks(DEFAULT_CYBER_BLOCKS);
    }
  };

  // Cálculo de contraste WCAG
  const textClr = colors?.ink || '#ffffff';
  const cardClr = colors?.cardBg || '#002B49';
  const contrastRatio = getContrastRatio(textClr, cardClr);
  const isContrastGood = contrastRatio >= 4.5;
  const isContrastExcellent = contrastRatio >= 7.0;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto p-3 space-y-3 select-none">
      
      {/* ── SELETOR DE PRESETS ── */}
      <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <span>Preset Hotspot</span>
          </span>
          <button
            type="button"
            onClick={handleResetOrder}
            title="Restaurar blocos para o padrão deste preset"
            className="text-[10px] font-semibold text-slate-500 hover:text-blue-600 dark:hover:text-blue-400 flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Restaurar Ordem</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {availableTemplates.map(t => {
            const isCur = (template || 'default').toLowerCase() === t.toLowerCase();
            const isFap = t.toLowerCase() === 'fap';
            return (
              <button
                key={t}
                type="button"
                onClick={() => setTemplate(t)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  isCur
                    ? 'border-blue-500 bg-blue-50/90 dark:bg-blue-950/70 ring-2 ring-blue-500/20 shadow-xs'
                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-base">{isFap ? '🎓' : '⚡'}</span>
                  {isCur && (
                    <span className="text-[8.5px] font-black uppercase tracking-wider bg-blue-600 text-white px-1.5 py-0.5 rounded">
                      Ativo
                    </span>
                  )}
                </div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 truncate">
                  {isFap ? 'FAP Campus' : 'Padrão Cyber'}
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">
                  {isFap ? 'Faculdade Adventista' : 'Tema Dark Voucher'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── ACORDEÃO: DIMENSIONAMENTO & PROPORÇÕES ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs">
        <button
          type="button"
          onClick={() => setDimensionsOpen(prev => !prev)}
          className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <div>
              <div className="text-xs font-bold text-slate-900 dark:text-slate-100">
                Dimensionamento & Proporções
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400">
                Largura do cartão ({studio?.cardMaxWidth || 420}px), cantos, espaçamentos e botões
              </div>
            </div>
          </div>
          {dimensionsOpen ? (
            <ChevronUp className="w-4 h-4 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-slate-400" />
          )}
        </button>

        {dimensionsOpen && (
          <div className="p-3 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
            {/* Largura Máxima do Cartão */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Largura do Cartão</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{studio?.cardMaxWidth || 420}px</span>
              </div>
              <input
                type="range"
                min="320"
                max="560"
                step="10"
                value={studio?.cardMaxWidth || 420}
                onChange={e => setStudio((prev: any) => ({ ...prev, cardMaxWidth: Number(e.target.value) }))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Espaçamento Interno (Padding) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Espaçamento Interno (Padding)</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{studio?.cardPaddingLeft || 24}px</span>
              </div>
              <input
                type="range"
                min="12"
                max="44"
                step="2"
                value={studio?.cardPaddingLeft || 24}
                onChange={e => {
                  const val = Number(e.target.value);
                  setStudio((prev: any) => ({
                    ...prev,
                    cardPaddingTop: val,
                    cardPaddingBottom: val,
                    cardPaddingLeft: val,
                    cardPaddingRight: val
                  }));
                }}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Espaço Vertical Entre Blocos (Gap) */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Espaço Vertical Entre Blocos (Gap)</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{studio?.cardGap !== undefined ? studio.cardGap : 16}px</span>
              </div>
              <input
                type="range"
                min="6"
                max="32"
                step="2"
                value={studio?.cardGap !== undefined ? studio.cardGap : 16}
                onChange={e => setStudio((prev: any) => ({ ...prev, cardGap: Number(e.target.value) }))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Arredondamento do Cartão */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Arredondamento do Cartão</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{studio?.cardRadiusTL !== undefined ? studio.cardRadiusTL : 12}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="36"
                step="2"
                value={studio?.cardRadiusTL !== undefined ? studio.cardRadiusTL : 12}
                onChange={e => {
                  const val = Number(e.target.value);
                  setStudio((prev: any) => ({
                    ...prev,
                    cardRadiusTL: val,
                    cardRadiusTR: val,
                    cardRadiusBR: val,
                    cardRadiusBL: val
                  }));
                }}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Altura dos Botões */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Altura dos Botões</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{studio?.btnHeight || 44}px</span>
              </div>
              <input
                type="range"
                min="36"
                max="56"
                step="2"
                value={studio?.btnHeight || 44}
                onChange={e => setStudio((prev: any) => ({ ...prev, btnHeight: Number(e.target.value) }))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Arredondamento dos Botões */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Arredondamento dos Botões</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{studio?.btnRadiusTL !== undefined ? studio.btnRadiusTL : 10}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="26"
                step="2"
                value={studio?.btnRadiusTL !== undefined ? studio.btnRadiusTL : 10}
                onChange={e => {
                  const val = Number(e.target.value);
                  setStudio((prev: any) => ({
                    ...prev,
                    btnRadiusTL: val,
                    btnRadiusTR: val,
                    btnRadiusBR: val,
                    btnRadiusBL: val
                  }));
                }}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>

            {/* Altura dos Inputs */}
            <div className="space-y-1">
              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                <span className="font-semibold">Altura dos Campos (Inputs)</span>
                <span className="font-mono text-blue-600 dark:text-blue-400 font-bold">{studio?.inputHeight || 44}px</span>
              </div>
              <input
                type="range"
                min="36"
                max="54"
                step="2"
                value={studio?.inputHeight || 44}
                onChange={e => setStudio((prev: any) => ({ ...prev, inputHeight: Number(e.target.value) }))}
                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── ACORDEÃO: ESTILO, CORES & FUNDO (SEM MODAL) ── */}
      {colors && setColors && (
        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 overflow-hidden shadow-2xs">
          <button
            type="button"
            onClick={() => setStyleOpen(prev => !prev)}
            className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Palette className="w-4 h-4 text-amber-500" />
              <div>
                <div className="text-xs font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <span>Cores, Fundo & Efeitos</span>
                  <span className={`text-[9px] font-black px-1.5 py-0.5 rounded ${
                    isContrastExcellent
                      ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                      : isContrastGood
                      ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400'
                      : 'bg-amber-500/20 text-amber-600 dark:text-amber-400'
                  }`}>
                    WCAG {contrastRatio}:1
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400">
                  Paleta de cores, papel de parede e efeitos dinâmicos
                </div>
              </div>
            </div>
            {styleOpen ? (
              <ChevronUp className="w-4 h-4 text-slate-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-slate-400" />
            )}
          </button>

          {styleOpen && (
            <div className="p-3 pt-1 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs">
              
              {/* Auditoria WCAG de Contraste */}
              <div className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/60 flex items-center justify-between">
                <div>
                  <div className="text-[11px] font-bold text-slate-800 dark:text-slate-200">
                    Auditoria de Acessibilidade & Contraste
                  </div>
                  <div className="text-[10px] text-slate-500">
                    Texto ({textClr}) vs Fundo ({cardClr})
                  </div>
                </div>
                <span className={`text-[10px] font-bold px-2 py-1 rounded-md ${
                  isContrastExcellent
                    ? 'bg-emerald-600 text-white'
                    : isContrastGood
                    ? 'bg-blue-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}>
                  {isContrastExcellent ? 'Excelente (AAA)' : isContrastGood ? 'Bom (AA)' : 'Baixo Contraste'}
                </span>
              </div>

              {/* 4 Swatches de Cores Principais */}
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Fundo da Página</label>
                  <div className="flex items-center gap-1.5 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <input
                      type="color"
                      value={colors.bg || '#001726'}
                      onChange={e => setColors((prev: any) => ({ ...prev, bg: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={colors.bg || '#001726'}
                      onChange={e => setColors((prev: any) => ({ ...prev, bg: e.target.value }))}
                      className="w-full text-[11px] font-mono bg-transparent outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Fundo do Cartão</label>
                  <div className="flex items-center gap-1.5 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <input
                      type="color"
                      value={colors.cardBg || '#ffffff'}
                      onChange={e => setColors((prev: any) => ({ ...prev, cardBg: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={colors.cardBg || '#ffffff'}
                      onChange={e => setColors((prev: any) => ({ ...prev, cardBg: e.target.value }))}
                      className="w-full text-[11px] font-mono bg-transparent outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Texto Principal</label>
                  <div className="flex items-center gap-1.5 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <input
                      type="color"
                      value={colors.ink || '#000000'}
                      onChange={e => setColors((prev: any) => ({ ...prev, ink: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={colors.ink || '#000000'}
                      onChange={e => setColors((prev: any) => ({ ...prev, ink: e.target.value }))}
                      className="w-full text-[11px] font-mono bg-transparent outline-none uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-slate-500">Destaque & Botão</label>
                  <div className="flex items-center gap-1.5 p-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
                    <input
                      type="color"
                      value={colors.blue || colors.brand || '#F39200'}
                      onChange={e => setColors((prev: any) => ({ ...prev, blue: e.target.value, brand: e.target.value }))}
                      className="w-6 h-6 rounded cursor-pointer border-0 p-0"
                    />
                    <input
                      type="text"
                      value={colors.blue || colors.brand || '#F39200'}
                      onChange={e => setColors((prev: any) => ({ ...prev, blue: e.target.value, brand: e.target.value }))}
                      className="w-full text-[11px] font-mono bg-transparent outline-none uppercase"
                    />
                  </div>
                </div>
              </div>

              {/* Tipo de Fundo & URL */}
              {bg && setBg && (
                <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Tipo de Fundo</label>
                    <select
                      value={bg.type || 'color'}
                      onChange={e => setBg((prev: any) => ({ ...prev, type: e.target.value }))}
                      className="text-xs p-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                    >
                      <option value="color">Cor Sólida</option>
                      <option value="image">Imagem em Tela Cheia</option>
                      <option value="video">Vídeo em Loop</option>
                    </select>
                  </div>

                  {(bg.type === 'image' || bg.type === 'video') && (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="text"
                        placeholder="https://... ou escolha na galeria"
                        value={bg.url || ''}
                        onChange={e => setBg((prev: any) => ({ ...prev, url: e.target.value }))}
                        className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                      {onOpenMediaPicker && (
                        <button
                          type="button"
                          onClick={() => onOpenMediaPicker({ type: 'bg', title: 'Selecionar Fundo do Hotspot' })}
                          className="p-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                          <span>Galeria</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Efeito Canvas Dinâmico */}
              {effects && setEffects && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Efeito Canvas Dinâmico</label>
                  <select
                    value={effects.bgEffect || 'none'}
                    onChange={e => setEffects((prev: any) => ({ ...prev, bgEffect: e.target.value }))}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="none">Nenhum (Clean Oficial)</option>
                    <option value="particles">Partículas Conectadas (Constelação)</option>
                    <option value="matrix">Chuva Digital Matrix</option>
                    <option value="waves">Ondas Sinusoidais Fluídas</option>
                    <option value="cybergrid">Malha Cibernética 3D (Cyber Grid)</option>
                    <option value="orbs">Orbes Iluminados Flutuantes</option>
                    <option value="fireflies">Pirilampos Noturnos</option>
                    <option value="aurora">Aurora Boreal Dinâmica</option>
                  </select>
                </div>
              )}

              {/* CSS Pro Customizado */}
              {customCode && setCustomCode && (
                <div className="space-y-1 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-[11px] font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-blue-500" />
                    <span>CSS Pro Injetado no MikroTik</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="/* Regras CSS personalizadas injetadas diretamente no template */"
                    value={customCode.css || ''}
                    onChange={e => setCustomCode((prev: any) => ({ ...prev, css: e.target.value }))}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-950 text-emerald-400 font-mono text-[11px] outline-none"
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── LISTA DE BLOCOS MODULARES COM DRAG & DROP ── */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-slate-200">
              Estrutura & Blocos Modulares
            </h3>
          </div>
          <span className="text-[10px] font-semibold text-slate-500">
            {blocks.filter(b => b.enabled).length}/{blocks.length} visíveis
          </span>
        </div>

        <div className="space-y-1.5">
          {blocks.map((block, idx) => {
            const Icon = getBlockIcon(block.type);
            const taxBadge = getTaxonomyBadge(block.type);
            const isFirst = idx === 0;
            const isLast = idx === blocks.length - 1;
            const isExpanded = expandedBlockId === block.id;
            const isDragOver = dragOverIdx === idx;

            return (
              <div
                key={block.id}
                draggable={true}
                onDragStart={e => {
                  e.dataTransfer.setData('text/plain', String(idx));
                  setDraggedIdx(idx);
                }}
                onDragOver={e => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverIdx !== idx) setDragOverIdx(idx);
                }}
                onDragLeave={() => {
                  if (dragOverIdx === idx) setDragOverIdx(null);
                }}
                onDrop={e => {
                  e.preventDefault();
                  handleDrop(idx);
                }}
                onDragEnd={() => {
                  setDraggedIdx(null);
                  setDragOverIdx(null);
                }}
                className={`rounded-xl border transition-all ${
                  isDragOver
                    ? 'border-blue-500 ring-2 ring-blue-500/30 scale-[1.01] bg-blue-50/40 dark:bg-blue-950/40'
                    : block.enabled
                    ? 'border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-800/90 shadow-2xs'
                    : 'border-slate-200/60 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-900/40 opacity-55'
                }`}
              >
                <div className="flex items-center justify-between p-2">
                  
                  {/* Handle Drag & Drop + Ordem */}
                  <div className="flex items-center gap-1 shrink-0 pr-1 cursor-grab active:cursor-grabbing text-slate-400 hover:text-blue-500">
                    <GripVertical className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-mono font-bold text-slate-400 dark:text-slate-500 w-3.5 text-center">
                      #{idx + 1}
                    </span>
                  </div>

                  {/* Ícone + Nome (clicável para expandir ajustes inline) */}
                  <button
                    type="button"
                    onClick={() => setExpandedBlockId(isExpanded ? null : block.id)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left cursor-pointer group pr-2"
                    title={`Clique para ajustar parâmetros de ${block.label}`}
                  >
                    <div className={`p-1.5 rounded-lg shrink-0 transition-colors ${
                      block.enabled
                        ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 group-hover:bg-blue-600 group-hover:text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className={`text-xs font-bold truncate ${
                          block.enabled ? 'text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400' : 'text-slate-500 line-through'
                        }`}>
                          {block.label}
                        </span>
                        <span className={`text-[8.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded border shrink-0 ${taxBadge.colorCls}`}>
                          {taxBadge.label}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                        {block.description}
                      </p>
                    </div>

                    <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </button>

                  {/* Controles de Ação (Subir, Descer, Olho, Lixeira) */}
                  <div className="flex items-center gap-0.5 shrink-0 bg-slate-50 dark:bg-slate-800/80 p-0.5 rounded-lg border border-slate-200/70 dark:border-slate-700/70">
                    <button
                      type="button"
                      disabled={isFirst}
                      onClick={() => handleMoveUp(idx)}
                      title="Mover para cima"
                      className={`p-1 rounded transition-colors ${
                        isFirst
                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                          : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer'
                      }`}
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      disabled={isLast}
                      onClick={() => handleMoveDown(idx)}
                      title="Mover para baixo"
                      className={`p-1 rounded transition-colors ${
                        isLast
                          ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed'
                          : 'text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-slate-200/60 dark:hover:bg-slate-700 cursor-pointer'
                      }`}
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggleVisibility(block.id)}
                      title={block.enabled ? 'Ocultar esta seção' : 'Exibir esta seção'}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        block.enabled
                          ? 'text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50'
                          : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                    >
                      {block.enabled ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    </button>

                    {block.canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDeleteBlock(block.id)}
                        title="Remover esta seção"
                        className="p-1 rounded text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* ── GAVETA DE AJUSTES INLINE DO BLOCO ESPECÍFICO ── */}
                {isExpanded && (
                  <div className="p-3 pt-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/60 space-y-2.5 animate-fade-in text-xs">
                    
                    {/* Bloco: BRANDING */}
                    {block.type === 'branding' && (
                      <div className="space-y-2">
                        {businessName !== undefined && setBusinessName && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500">Nome / Título da Empresa</label>
                            <input
                              type="text"
                              value={businessName}
                              onChange={e => setBusinessName(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              placeholder="Ex: FAP ou Sua Empresa"
                            />
                          </div>
                        )}

                        {brand && setBrand && (
                          <>
                            <div className="space-y-1">
                              <label className="text-[10px] font-semibold text-slate-500">Slogan / Subtítulo</label>
                              <input
                                type="text"
                                value={brand.subtitle || ''}
                                onChange={e => setBrand((prev: any) => ({ ...prev, subtitle: e.target.value }))}
                                className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                                placeholder="Ex: Educação Adventista"
                              />
                            </div>

                            <div className="space-y-1">
                              <div className="flex justify-between text-[11px] text-slate-600 dark:text-slate-300">
                                <span className="font-semibold">Tamanho do Logotipo</span>
                                <span className="font-mono text-blue-600 font-bold">{brand.logoSize || 120}px</span>
                              </div>
                              <input
                                type="range"
                                min="40"
                                max="280"
                                step="5"
                                value={brand.logoSize || 120}
                                onChange={e => setBrand((prev: any) => ({ ...prev, logoSize: Number(e.target.value) }))}
                                className="w-full accent-blue-600 h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg cursor-pointer"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Bloco: WELCOME */}
                    {block.type === 'welcome' && (
                      <div className="space-y-2">
                        {message !== undefined && setMessage && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500">Texto de Boas-Vindas</label>
                            <textarea
                              rows={2}
                              value={message}
                              onChange={e => setMessage(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              placeholder="Insira as suas credenciais de acesso"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bloco: ADS (CAMPANHAS & VÍDEO ADS) */}
                    {block.type === 'ads' && ad && setAd && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] font-semibold text-slate-500">Ativar Anúncio Patrocinado</label>
                          <input
                            type="checkbox"
                            checked={ad.enabled !== false}
                            onChange={e => setAd((prev: any) => ({ ...prev, enabled: e.target.checked }))}
                            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">URL do Vídeo / Banner</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={ad.mediaUrl || ''}
                              onChange={e => setAd((prev: any) => ({ ...prev, mediaUrl: e.target.value }))}
                              placeholder="https://... ou escolha da galeria"
                              className="flex-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                            {onOpenMediaPicker && (
                              <button
                                type="button"
                                onClick={() => onOpenMediaPicker({ type: 'ad_single', title: 'Selecionar Vídeo ou Imagem do Anúncio' })}
                                className="p-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold shrink-0 cursor-pointer flex items-center gap-1"
                              >
                                <FolderOpen className="w-3.5 h-3.5" />
                                <span>Galeria</span>
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500">Timer (Segundos)</label>
                            <input
                              type="number"
                              min="3"
                              max="60"
                              value={ad.durationSeconds || 10}
                              onChange={e => setAd((prev: any) => ({ ...prev, durationSeconds: Number(e.target.value) }))}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500">Título / Selo</label>
                            <input
                              type="text"
                              value={ad.providerTitle || 'Patrocinado'}
                              onChange={e => setAd((prev: any) => ({ ...prev, providerTitle: e.target.value }))}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Bloco: AUTH */}
                    {block.type === 'auth' && (
                      <div className="space-y-2">
                        {loginButtonLabel !== undefined && setLoginButtonLabel && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500">Rótulo do Botão Conectar</label>
                            <input
                              type="text"
                              value={loginButtonLabel}
                              onChange={e => setLoginButtonLabel(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              placeholder="Conectar à Rede"
                            />
                          </div>
                        )}

                        {registerButtonText !== undefined && setRegisterButtonText && (
                          <div className="space-y-1">
                            <div className="flex items-center justify-between">
                              <label className="text-[10px] font-semibold text-slate-500">Rótulo do Botão Cadastre-se</label>
                              {setEnabled && (
                                <label className="flex items-center gap-1.5 cursor-pointer text-[10px] text-blue-600 font-semibold select-none">
                                  <input
                                    type="checkbox"
                                    checked={enabled !== false}
                                    onChange={e => setEnabled(e.target.checked)}
                                    className="w-3.5 h-3.5 accent-blue-600 rounded cursor-pointer"
                                  />
                                  <span>Exibir Botão</span>
                                </label>
                              )}
                            </div>
                            <input
                              type="text"
                              value={registerButtonText}
                              onChange={e => setRegisterButtonText(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              placeholder="Cadastre-se aqui"
                            />
                            {enabled === false && (
                              <p className="text-[9.5px] text-amber-500 font-medium">
                                ℹ️ Botão oculto no portal. Marque &quot;Exibir Botão&quot; para ativá-lo.
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bloco: TRIAL */}
                    {block.type === 'trial' && (
                      <div className="space-y-2">
                        {trialText !== undefined && setTrialText && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500">Etiqueta de Acesso Teste</label>
                            <input
                              type="text"
                              value={trialText}
                              onChange={e => setTrialText(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              placeholder="Acesso de teste disponível, "
                            />
                          </div>
                        )}

                        {trialLinkText !== undefined && setTrialLinkText && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500">Texto do Link de Acesso</label>
                            <input
                              type="text"
                              value={trialLinkText}
                              onChange={e => setTrialLinkText(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              placeholder="clique aqui"
                            />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Bloco: BADGES */}
                    {block.type === 'badges' && badges && setBadges && (
                      <div className="space-y-2">
                        <label className="text-[10px] font-semibold text-slate-500">Indicadores Visíveis</label>
                        <div className="space-y-1.5">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={badges.showWifiSpeed !== false}
                              onChange={e => setBadges((prev: any) => ({ ...prev, showWifiSpeed: e.target.checked }))}
                              className="w-3.5 h-3.5 accent-blue-600 rounded"
                            />
                            <span className="text-xs">⚡ Indicador 5G Ultra Rápido</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={badges.showSecurityBadge !== false}
                              onChange={e => setBadges((prev: any) => ({ ...prev, showSecurityBadge: e.target.checked }))}
                              className="w-3.5 h-3.5 accent-blue-600 rounded"
                            />
                            <span className="text-xs">🔒 Indicador WPA3 Criptografado</span>
                          </label>

                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={badges.showConnectedCount !== false}
                              onChange={e => setBadges((prev: any) => ({ ...prev, showConnectedCount: e.target.checked }))}
                              className="w-3.5 h-3.5 accent-blue-600 rounded"
                            />
                            <span className="text-xs">🟢 Contador de Usuários Online (Tempo Real)</span>
                          </label>
                        </div>
                      </div>
                    )}

                    {/* Bloco: PROPS & ANTI-TETHERING */}
                    {block.type === 'props' && (
                      <div className="space-y-2">
                        <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] text-blue-800 dark:text-blue-300">
                          🛡️ <strong>Regra Anti-Tethering Ativa</strong>: Força TTL=1 no tráfego Hotspot, bloqueando o compartilhamento não autorizado por Wi-Fi ou cabo.
                        </div>
                      </div>
                    )}

                    {/* Bloco: WHATSAPP */}
                    {block.type === 'whatsapp' && social && setSocial && (
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">WhatsApp de Suporte (com DDD)</label>
                          <input
                            type="text"
                            value={social.whatsappNumber || ''}
                            onChange={e => setSocial((prev: any) => ({ ...prev, whatsappNumber: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            placeholder="Ex: 41999998888"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-slate-500">Mensagem Padrão de Abertura</label>
                          <input
                            type="text"
                            value={social.whatsappMessage || ''}
                            onChange={e => setSocial((prev: any) => ({ ...prev, whatsappMessage: e.target.value }))}
                            className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                            placeholder="Olá, preciso de suporte com o Wi-Fi."
                          />
                        </div>
                      </div>
                    )}

                    {/* Bloco: FOOTER */}
                    {block.type === 'footer' && (
                      <div className="space-y-2">
                        {termsText !== undefined && setTermsText && (
                          <div className="space-y-1">
                            <label className="text-[10px] font-semibold text-slate-500">Texto do Rodapé / Copyright</label>
                            <textarea
                              rows={2}
                              value={termsText}
                              onChange={e => setTermsText(e.target.value)}
                              className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                              placeholder="© Faculdade Adventista do Paraná | Tecnologia da Informação"
                            />
                          </div>
                        )}
                      </div>
                    )}

                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ── BOTÃO ADICIONAR BLOCO (CATÁLOGO MODULAR) ── */}
      <div className="pt-1">
        {!showAddMenu ? (
          <button
            type="button"
            onClick={() => setShowAddMenu(true)}
            className="w-full p-2.5 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 text-slate-600 dark:text-slate-300 hover:text-blue-600 flex items-center justify-center gap-1.5 text-xs font-bold transition-all cursor-pointer bg-slate-50/50 dark:bg-slate-800/30"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Bloco ao Portal</span>
          </button>
        ) : (
          <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/90 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Catálogo de Blocos Disponíveis
              </span>
              <button
                type="button"
                onClick={() => setShowAddMenu(false)}
                className="text-xs font-semibold text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Cancelar
              </button>
            </div>

            <div className="space-y-1.5">
              {AVAILABLE_CATALOG_BLOCKS.map(cat => {
                const CatIcon = getBlockIcon(cat.type);
                const isAlreadyPresent = blocks.some(b => b.type === cat.type && b.enabled);
                return (
                  <button
                    key={cat.type}
                    type="button"
                    onClick={() => handleAddBlock(cat)}
                    className="w-full p-2 rounded-lg border border-slate-200 dark:border-slate-700/80 bg-white dark:bg-slate-900 text-left hover:border-blue-500 transition-all cursor-pointer flex items-center justify-between"
                  >
                    <div className="flex items-center gap-2">
                      <div className="p-1 rounded bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                        <CatIcon className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                            {cat.label}
                          </span>
                          <span className="text-[8.5px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-500">
                            {cat.taxonomyLabel}
                          </span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          {cat.description}
                        </div>
                      </div>
                    </div>
                    {isAlreadyPresent ? (
                      <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">Ativo</span>
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-blue-600" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
