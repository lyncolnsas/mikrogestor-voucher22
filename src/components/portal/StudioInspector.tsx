"use client";

import React, { useState, useEffect, useRef } from 'react';
import {
  Palette,
  Type,
  LayoutGrid,
  Sparkles,
  Layers,
  Square,
  Zap,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Upload,
  Trash2,
  Film,
  Image as ImageIcon,
  Check,
  Undo2,
  Redo2,
  Download,
  Upload as UploadIcon,
  RotateCcw,
  ShieldCheck,
  Blend,
  Wand2,
  MousePointer2,
  Settings2,
  Sun,
  Moon,
  FileText,
  SlidersHorizontal,
} from 'lucide-react';

export interface StudioState {
  activeComponent: 'submit_button' | 'login_card' | 'input_fields' | 'brand_typography' | 'background_layer' | 'status_badges' | 'social_bar' | 'ad_banner';
  fontFamily: string;
  titleFontSize: number;
  titleFontWeight: string;
  titleLineHeight: number;
  titleLetterSpacing: number;
  titleAlign: 'left' | 'center' | 'right';
  titleItalic: boolean;
  titleUnderline: boolean;
  btnFontSize: number;
  btnFontWeight: string;
  btnLetterSpacing: number;
  btnHeight: number;
  btnPaddingTop: number;
  btnPaddingRight: number;
  btnPaddingBottom: number;
  btnPaddingLeft: number;
  btnRadiusTL: number;
  btnRadiusTR: number;
  btnRadiusBR: number;
  btnRadiusBL: number;
  btnBorderWidth: number;
  cardRadiusTL: number;
  cardRadiusTR: number;
  cardRadiusBR: number;
  cardRadiusBL: number;
  cardPaddingTop: number;
  cardPaddingRight: number;
  cardPaddingBottom: number;
  cardPaddingLeft: number;
  cardBorderWidth: number;
  cardBorderStyle: 'solid' | 'dashed' | 'none';
  cardGap: number;
  inputHeight: number;
  inputRadius: number;
  inputBorderWidth: number;
}

interface Colors {
  brand: string;
  brandDark: string;
  bg: string;
  ink: string;
  muted: string;
  blue: string;
  green: string;
  trialButtonBg?: string;
  trialButtonText?: string;
  cardBg?: string;
  cardBorder?: string;
  inputBg?: string;
  inputText?: string;
  inputBorder?: string;
  inputPlaceholder?: string;
  loginButtonText?: string;
  registerButtonText?: string;
  glassOpacity: number;
  glassBlur: number;
}

interface EffectsConfig {
  bgEffect: string;
  bgEffectSpeed: 'slow' | 'normal' | 'fast';
  bgEffectSpeedMultiplier?: number;
  cardShape: 'rounded' | 'square' | 'pill' | 'scifi-cut';
  cardNoiseTexture: boolean;
  cardGlowBorder: boolean;
  cardTilt3d: boolean;
  btnShimmer: boolean;
  btnPulse: boolean;
  titleGradient: boolean;
  headerIcon?: 'wifi' | 'shield' | 'zap' | 'rocket' | 'coffee' | 'none';
}

interface SocialConfig {
  whatsappEnabled: boolean;
  whatsappNumber: string;
  whatsappMessage: string;
  instagramUrl: string;
  facebookUrl: string;
  googleMapsUrl: string;
}

interface BadgesConfig {
  showWifiSpeed: boolean;
  wifiSpeedText: string;
  showSecurityBadge: boolean;
  securityText: string;
  showConnectedCount: boolean;
  connectedCountNumber: string;
}

interface BgConfig {
  type: 'default' | 'image' | 'video';
  url: string;
}

interface StudioInspectorProps {
  template: string;
  setTemplate: (t: string) => void;
  businessName: string;
  setBusinessName: (b: string) => void;
  message: string;
  setMessage: (m: string) => void;
  colors: Colors;
  setColors: React.Dispatch<React.SetStateAction<Colors>>;
  effects: EffectsConfig;
  setEffects: React.Dispatch<React.SetStateAction<EffectsConfig>>;
  studio: StudioState;
  setStudio: React.Dispatch<React.SetStateAction<StudioState>>;
  social: SocialConfig;
  setSocial: React.Dispatch<React.SetStateAction<SocialConfig>>;
  badges: BadgesConfig;
  setBadges: React.Dispatch<React.SetStateAction<BadgesConfig>>;
  bg: BgConfig;
  setBg: React.Dispatch<React.SetStateAction<BgConfig>>;
  handleBgUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleBgRemove?: () => void;
  bgUploadLoading: boolean;
  COLOR_PRESETS: any[];
  NICHE_EFFECTS: any[];
  hoveredTarget?: string | null;
  onCardHover?: (target: string | null) => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  loginButtonLabel?: string;
  setLoginButtonLabel?: (l: string) => void;
  trialText?: string;
  setTrialText?: (t: string) => void;
  trialLinkText?: string;
  setTrialLinkText?: (t: string) => void;
  termsText?: string;
  setTermsText?: (t: string) => void;
  registerButtonText?: string;
  setRegisterButtonText?: (r: string) => void;
}

type StudioNavSection = 'presets' | 'identity' | 'content' | 'form' | 'effects';

// ─── Utility: hex → relative luminance ──────────────────────────────────────
function hexToRgb(hex: string): [number, number, number] | null {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : null;
}
function luminance([r, g, b]: [number, number, number]): number {
  const sRGB = [r, g, b].map(c => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * sRGB[0] + 0.7152 * sRGB[1] + 0.0722 * sRGB[2];
}
function contrastRatio(hex1: string, hex2: string): number | null {
  const rgb1 = hexToRgb(hex1), rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return null;
  const L1 = luminance(rgb1), L2 = luminance(rgb2);
  const bright = Math.max(L1, L2), dark = Math.min(L1, L2);
  return (bright + 0.05) / (dark + 0.05);
}



// ─── Sub-component: ColorToken ───────────────────────────────────────────────
interface ColorTokenProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onHover?: () => void;
  contrastWith?: string;
  size?: 'sm' | 'md';
}
function ColorToken({ label, value, onChange, onHover, contrastWith }: ColorTokenProps) {
  const [hexInput, setHexInput] = useState(value);
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    setHexInput(value);
  }
  const ratio = contrastWith ? contrastRatio(value, contrastWith) : null;
  const wcagOk = ratio !== null && ratio >= 4.5;
  const wcagAa = ratio !== null && ratio >= 3;

  const commitHex = () => {
    const clean = hexInput.startsWith('#') ? hexInput : '#' + hexInput;
    if (/^#[0-9A-Fa-f]{6}$/.test(clean)) onChange(clean);
    else setHexInput(value);
  };

  return (
    <div
      className="group flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-xl hover:bg-slate-100/90 border border-transparent hover:border-slate-200 transition-all cursor-default min-h-[38px]"
      onMouseEnter={onHover}
    >
      {/* Left: Swatch + Label */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <div
          className="relative shrink-0 w-6 h-6 rounded-lg ring-1 ring-black/25 shadow-xs overflow-hidden cursor-pointer group-hover:scale-105 transition-transform"
          style={{ background: value }}
          title="Clique para abrir o seletor de cor"
        >
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        </div>
        <span className="text-[12px] font-bold text-slate-900 group-hover:text-blue-900 truncate" title={label}>
          {label}
        </span>
      </div>

      {/* Right: WCAG Ratio Badge + Compact HEX Input */}
      <div className="flex items-center gap-1.5 shrink-0">
        {ratio !== null && (
          <span
            className={`text-[9.5px] font-mono font-bold px-1.5 py-0.5 rounded ring-1 ${
              wcagOk
                ? 'bg-emerald-100 text-emerald-950 ring-emerald-600/30'
                : wcagAa
                ? 'bg-amber-100 text-amber-950 ring-amber-600/30'
                : 'bg-rose-100 text-rose-950 ring-rose-600/30'
            }`}
            title={`Contraste WCAG: ${ratio.toFixed(1)}:1 (${wcagOk ? '✓ Aprovado' : wcagAa ? '△ Aceitável' : '✗ Baixo'})`}
          >
            {ratio.toFixed(1)}
          </span>
        )}

        <input
          type="text"
          value={hexInput}
          onChange={e => setHexInput(e.target.value)}
          onBlur={commitHex}
          onKeyDown={e => e.key === 'Enter' && commitHex()}
          maxLength={7}
          className="w-[72px] bg-white hover:bg-slate-50 focus:bg-white text-slate-950 font-mono font-bold text-[11px] px-1.5 py-1 rounded-md border border-slate-300 focus:border-blue-600 focus:ring-1 focus:ring-blue-500 outline-none text-center uppercase tracking-wider transition-all shadow-2xs"
          placeholder="#000000"
        />
      </div>
    </div>
  );
}

// ─── Sub-component: SliderField ───────────────────────────────────────────────
interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
  onHover?: () => void;
  color?: string;
}
function SliderField({ label, value, min, max, step = 1, unit = 'px', onChange, onHover }: SliderFieldProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-1.5 py-1.5 px-2.5 rounded-xl hover:bg-slate-100/70 border border-transparent hover:border-slate-200 transition-colors" onMouseEnter={onHover}>
      <div className="flex items-center justify-between text-[11.5px]">
        <span className="font-bold text-slate-900">{label}</span>
        <span
          className="font-mono font-bold px-2 py-0.5 rounded-md text-[10.5px] bg-slate-200 text-slate-950 border border-slate-300/80 shadow-2xs"
        >
          {value}{unit}
        </span>
      </div>
      <div className="relative h-2 rounded-full bg-slate-200/90 overflow-hidden">
        <div
          className="absolute left-0 top-0 h-full rounded-full transition-all"
          style={{ width: `${pct}%`, background: `linear-gradient(90deg, #0284c7, #2563eb)` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
      </div>
    </div>
  );
}

// ─── Sub-component: SectionHeader ────────────────────────────────────────────
function SectionHeader({ 
  icon, 
  label, 
  accent = '#2563eb', 
  onReset,
  resetLabel = 'Resetar'
}: { 
  icon: React.ReactNode; 
  label: string; 
  accent?: string;
  onReset?: () => void;
  resetLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between pt-1 pb-1.5 border-b border-slate-200/80 mb-2">
      <div className="flex items-center gap-2">
        <span style={{ color: accent }} className="shrink-0">{icon}</span>
        <span className="text-[11px] font-sans font-bold uppercase tracking-wider text-slate-900">{label}</span>
      </div>
      {onReset && (
        <button
          type="button"
          onClick={onReset}
          className="text-[10.5px] font-sans font-bold text-blue-700 hover:text-blue-950 flex items-center gap-1 cursor-pointer transition-all px-2 py-0.5 rounded-md hover:bg-blue-50 border border-blue-200/80 shadow-2xs"
          title={`Restaurar valores padrão de ${label}`}
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>{resetLabel}</span>
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function StudioInspector({
  template,
  setTemplate,
  businessName,
  setBusinessName,
  message,
  setMessage,
  colors,
  setColors,
  effects,
  setEffects,
  studio,
  setStudio,
  bg,
  setBg,
  handleBgUpload,
  handleBgRemove,
  bgUploadLoading,
  COLOR_PRESETS,
  NICHE_EFFECTS,
  onCardHover,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  loginButtonLabel = 'Conectar',
  setLoginButtonLabel,
  trialText = 'Acesso de teste disponível, ',
  setTrialText,
  trialLinkText = 'clique aqui',
  setTrialLinkText,
  termsText = 'Ao se cadastrar, você concorda com nossos Termos de Uso e Política de Privacidade.',
  setTermsText,
  registerButtonText = 'Cadastre-se aqui',
  setRegisterButtonText,
}: StudioInspectorProps) {
  const [activeSection, setActiveSection] = useState<StudioNavSection>('identity');
  const [bgCategory, setBgCategory] = useState<string>('all');
  const presetFileRef = useRef<HTMLInputElement>(null);

  const [harmonicBase, setHarmonicBase] = useState('#2563eb');
  const generateHarmonicPalette = (baseHex: string): { name: string; color: string }[] => {
    return [
      { name: 'Primary', color: baseHex },
      { name: 'Light', color: '#60a5fa' },
      { name: 'Dark', color: '#1e3a8a' },
      { name: 'Complement', color: '#f59e0b' },
      { name: 'Analogous', color: '#10b981' },
    ];
  };

  const fontOptions = [
    { id: 'Inter', name: 'Inter', sample: 'Aa Modern Clean' },
    { id: 'Outfit', name: 'Outfit', sample: 'Aa Tech Rounded' },
    { id: 'Plus Jakarta Sans', name: 'Plus Jakarta Sans', sample: 'Aa Pro Luxury' },
    { id: 'Cabinet Grotesk', name: 'Cabinet Grotesk', sample: 'Aa Bold Display' },
    { id: 'Roboto Mono', name: 'Roboto Mono', sample: '01 Mono Code' },
    { id: 'Geist', name: 'Geist Sans', sample: 'Aa Minimalist' },
  ];

  const shapeOptions = [
    { id: 'rounded', label: 'Moderno', sub: '20px', icon: <Square className="w-4 h-4" style={{ borderRadius: 4 }} /> },
    { id: 'square',  label: 'Quadrado', sub: '2px', icon: <Square className="w-4 h-4" /> },
    { id: 'pill',    label: 'Pílula', sub: '36px', icon: <Sun className="w-4 h-4" /> },
    { id: 'scifi-cut', label: 'Sci-Fi', sub: 'Chanfrado', icon: <Settings2 className="w-4 h-4" /> },
  ] as const;

  const quickThemes = [
    { id: 'fap',      name: 'FAP • Educação', brand: '#002B49', blue: '#F39200', cardBg: '#002B49', bg: '#001726', bgEffect: 'fap-adventista', accent: '#F39200' },
    { id: 'cyber',    name: 'Cyber Blue',    brand: '#06b6d4', blue: '#0284c7', cardBg: '#0f172a', bg: '#030712', bgEffect: 'matrix',       accent: '#06b6d4' },
    { id: 'emerald',  name: 'Emerald Pro',   brand: '#10b981', blue: '#059669', cardBg: '#064e3b', bg: '#022c22', bgEffect: 'digital-ocean', accent: '#10b981' },
    { id: 'sunset',   name: 'Sunset Orange', brand: '#f59e0b', blue: '#ea580c', cardBg: '#27272a', bg: '#18181b', bgEffect: 'aurora',        accent: '#f59e0b' },
    { id: 'obsidian', name: 'Cobalt Dark',   brand: '#2563eb', blue: '#1d4ed8', cardBg: '#18181b', bg: '#09090b', bgEffect: 'cyber-grid',    accent: '#2563eb' },
    { id: 'rose',     name: 'Rose Gold',     brand: '#f43f5e', blue: '#e11d48', cardBg: '#1c1217', bg: '#0f0a0c', bgEffect: 'aurora',        accent: '#f43f5e' },
    { id: 'forest',   name: 'Forest Night',  brand: '#22c55e', blue: '#16a34a', cardBg: '#052e16', bg: '#020d07', bgEffect: 'fireflies',     accent: '#22c55e' },
  ];

  const applyShapePreset = (shape: typeof shapeOptions[number]['id']) => {
    setEffects(prev => ({ ...prev, cardShape: shape }));
    const presets: Record<string, Partial<StudioState>> = {
      square:    { cardRadiusTL: 2,  cardRadiusTR: 2,  cardRadiusBR: 2,  cardRadiusBL: 2,  btnRadiusTL: 2,  btnRadiusTR: 2,  btnRadiusBR: 2,  btnRadiusBL: 2,  inputRadius: 2  },
      pill:      { cardRadiusTL: 36, cardRadiusTR: 36, cardRadiusBR: 36, cardRadiusBL: 36, btnRadiusTL: 28, btnRadiusTR: 28, btnRadiusBR: 28, btnRadiusBL: 28, inputRadius: 24 },
      'scifi-cut': { cardRadiusTL: 0, cardRadiusTR: 0, cardRadiusBR: 0, cardRadiusBL: 0, btnRadiusTL: 0, btnRadiusTR: 0, btnRadiusBR: 0, btnRadiusBL: 0, inputRadius: 0 },
      rounded:   { cardRadiusTL: 20, cardRadiusTR: 20, cardRadiusBR: 20, cardRadiusBL: 20, btnRadiusTL: 12, btnRadiusTR: 12, btnRadiusBR: 12, btnRadiusBL: 12, inputRadius: 10 },
    };
    if (presets[shape]) setStudio(prev => ({ ...prev, ...presets[shape] }));
  };

  const applyQuickTheme = (theme: typeof quickThemes[0]) => {
    setColors(prev => ({ ...prev, brand: theme.brand, blue: theme.blue, cardBg: theme.cardBg, bg: theme.bg }));
    setEffects(prev => ({ ...prev, bgEffect: theme.bgEffect }));
    setBg(prev => ({ ...prev, type: 'default' }));
  };

  const exportPreset = () => {
    const preset = { colors, effects, studio };
    const blob = new Blob([JSON.stringify(preset, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `portal-preset-${Date.now()}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const importPreset = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const p = JSON.parse(ev.target?.result as string);
        if (p.colors) setColors(prev => ({ ...prev, ...p.colors }));
        if (p.effects) setEffects(prev => ({ ...prev, ...p.effects }));
        if (p.studio)  setStudio(prev => ({ ...prev, ...p.studio }));
      } catch { /* invalid JSON */ }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const resetSectionColors = () => {
    setColors(prev => ({
      ...prev,
      brand: '#2563eb',
      brandDark: '#1d4ed8',
      bg: '#ffffff',
      ink: '#0f172a',
      muted: '#64748b',
      blue: '#2563eb',
      green: '#10b981',
      trialButtonBg: '#1e90ff',
      trialButtonText: '#ffffff',
      cardBg: '#ffffff',
      cardBorder: '#e2e8f0',
      inputBg: '#ffffff',
      inputText: '#0f172a',
      inputBorder: '#e2e8f0',
      inputPlaceholder: '#94a3b8',
      loginButtonText: '#ffffff',
      registerButtonText: '#ffffff',
    }));
  };

  const resetSectionGlass = () => {
    setColors(prev => ({ ...prev, glassOpacity: 85, glassBlur: 16 }));
    setEffects(prev => ({
      ...prev,
      btnShimmer: true,
      btnPulse: false,
      cardGlowBorder: false,
      cardTilt3d: false,
      cardNoiseTexture: false,
      titleGradient: false,
    }));
  };

  const resetSectionTypography = () => {
    setStudio(prev => ({
      ...prev,
      fontFamily: 'Inter',
      titleFontSize: 22,
      titleAlign: 'center',
    }));
    setEffects(prev => ({ ...prev, headerIcon: 'wifi' }));
  };

  const resetSectionLayout = () => {
    applyShapePreset('rounded');
  };

  const applyDarkMode = () => {
    setColors(prev => ({
      ...prev,
      cardBg: '#12131f',
      ink: '#f8fafc',
      muted: '#94a3b8',
      inputBg: '#18192b',
      inputText: '#f8fafc',
      inputBorder: '#334155',
      cardBorder: 'rgba(255,255,255,0.12)',
    }));
  };

  const applyLightMode = () => {
    setColors(prev => ({
      ...prev,
      cardBg: '#ffffff',
      ink: '#0f172a',
      muted: '#64748b',
      inputBg: '#f8fafc',
      inputText: '#0f172a',
      inputBorder: '#e2e8f0',
      cardBorder: 'rgba(0,0,0,0.08)',
    }));
  };

  const resetSectionButtons = () => {
    setStudio(p => ({
      ...p,
      btnHeight: 48,
      btnRadiusTL: 12,
      btnRadiusTR: 12,
      btnRadiusBR: 12,
      btnRadiusBL: 12,
      btnFontSize: 14,
      btnFontWeight: '600',
      btnLetterSpacing: 0.5,
      btnBorderWidth: 0,
    }));
    setEffects(p => ({
      ...p,
      btnShimmer: true,
      btnPulse: false,
    }));
  };

  const resetSectionContent = () => {
    setBusinessName('Super Wi-Fi');
    setMessage('Bem-vindo à nossa rede gratuita. Insira o seu voucher para navegar.');
    if (setLoginButtonLabel) setLoginButtonLabel('Conectar');
    if (setTrialText) setTrialText('Acesso de teste disponível, ');
    if (setTrialLinkText) setTrialLinkText('clique aqui');
    if (setRegisterButtonText) setRegisterButtonText('Cadastre-se aqui');
    if (setTermsText) setTermsText('Ao se cadastrar, você concorda com nossos Termos de Uso e Política de Privacidade.');
  };

  const resetSectionBackground = () => {
    setEffects(prev => ({
      ...prev,
      bgEffect: 'matrix',
      bgEffectSpeed: 'normal',
      bgEffectSpeedMultiplier: 1.0,
    }));
    setBg({ type: 'default', url: '' });
  };

  // Sync preview clicks → section switch
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== 'PREVIEW_ELEMENT_CLICK') return;
      const t = e.data.target;
      if (t === 'typography') setActiveSection('identity');
      else if (t === 'button') setActiveSection('form');
      else if (['input', 'card'].includes(t)) setActiveSection('form');
      else if (t === 'background') setActiveSection('identity');
      else setActiveSection('identity');
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // ─── Nav items ─────────────────────────────────────────────────────────────
  const navItems: { id: StudioNavSection; icon: React.ReactNode; label: string }[] = [
    { id: 'presets',    icon: <Zap className="w-4 h-4" />,                label: 'Presets' },
    { id: 'identity',   icon: <Palette className="w-4 h-4" />,            label: 'Identidade Visual' },
    { id: 'content',    icon: <FileText className="w-4 h-4" />,           label: 'Textos & Mensagens' },
    { id: 'form',       icon: <LayoutGrid className="w-4 h-4" />,         label: 'Formulário & Botões' },
    { id: 'effects',    icon: <Sparkles className="w-4 h-4" />,           label: 'Efeitos Adicionais' },
  ];

  return (
    <div className="flex flex-col gap-0 h-full" style={{ minHeight: 520 }}>

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50/60 border-b border-slate-100 shrink-0">
        {/* Studio label */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-6 h-6 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
            <MousePointer2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] font-sans font-bold text-slate-800 truncate">Studio Pro</div>
            <div className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[9px] font-mono font-bold text-emerald-600">LIVE SYNC</span>
            </div>
          </div>
        </div>

        {/* Template selector */}
        <select
          value={template}
          onChange={(e) => setTemplate && setTemplate(e.target.value)}
          className="bg-slate-100/80 hover:bg-slate-200 text-slate-800 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg border-0 outline-none focus:ring-2 focus:ring-blue-500/30 transition-all cursor-pointer max-w-[160px]"
        >
          <option value="default">Padrão Pro</option>
          <option value="FAP">🎓 FAP Oficial</option>
        </select>

        {/* Undo/Redo */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Desfazer (Ctrl+Z)"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Refazer (Ctrl+Y)"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-slate-900 disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-pointer"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Export/Import */}
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={exportPreset}
            title="Exportar preset como JSON"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-blue-600 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => presetFileRef.current?.click()}
            title="Importar preset JSON"
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-slate-100/80 hover:bg-slate-200/80 text-slate-600 hover:text-blue-600 transition-all cursor-pointer"
          >
            <UploadIcon className="w-3.5 h-3.5" />
          </button>
          <input ref={presetFileRef} type="file" accept=".json" className="hidden" onChange={importPreset} />
        </div>
      </div>

      {/* ── BODY: Sidebar Nav + Content ─────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT NAV */}
        <nav className="flex flex-col gap-1 p-1.5 bg-slate-100/90 border-r border-slate-200 shrink-0 w-[68px]">
          {navItems.map(item => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveSection(item.id)}
              title={item.label}
              className={`flex flex-col items-center gap-1 px-1 py-2 rounded-xl transition-all cursor-pointer ${
                activeSection === item.id
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-700'
                  : 'text-slate-700 hover:text-slate-950 hover:bg-slate-200/90 font-semibold'
              }`}
            >
              <span className={activeSection === item.id ? 'text-white' : 'text-slate-700'}>
                {item.icon}
              </span>
              <span className="text-[9.5px] font-sans font-bold leading-none tracking-tight">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* CONTENT AREA */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-white scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">

          {/* ══════════════ PRESETS ══════════════ */}
          {activeSection === 'presets' && (
            <div className="space-y-3.5">
              <SectionHeader icon={<Zap className="w-4 h-4" />} label="Temas Rápidos" accent="#f59e0b" />

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {quickThemes.map(th => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => applyQuickTheme(th)}
                    className="relative flex items-center gap-2 p-2 rounded-xl bg-slate-50/70 hover:bg-slate-100/90 ring-1 ring-slate-200/60 hover:ring-blue-400/60 transition-all cursor-pointer group text-left min-h-[44px]"
                  >
                    <div
                      className="w-6 h-6 rounded-md shrink-0 shadow-xs"
                      style={{ background: `linear-gradient(135deg, ${th.accent}, ${th.accent}88)` }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-bold text-slate-800 leading-tight truncate">{th.name}</div>
                      <div className="text-[9px] font-mono text-slate-500 truncate">{th.blue}</div>
                    </div>
                  </button>
                ))}
              </div>

              <div className="border-t border-slate-100 pt-3 space-y-2">
                <SectionHeader icon={<Wand2 className="w-4 h-4" />} label="Paleta Harmônica" accent="#0284c7" />
                <div className="space-y-2.5 p-3 rounded-xl bg-slate-50/50 ring-1 ring-slate-200/50">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Cor Base:</span>
                    <div className="flex items-center gap-1.5">
                      <div
                        className="w-6 h-6 rounded-md ring-1 ring-black/10 relative overflow-hidden cursor-pointer shrink-0"
                        style={{ background: harmonicBase }}
                        title="Clique para escolher a cor base"
                      >
                        <input type="color" value={harmonicBase} onChange={e => setHarmonicBase(e.target.value)} className="absolute inset-0 opacity-0 w-full h-full cursor-pointer" />
                      </div>
                      <input
                        type="text"
                        value={harmonicBase}
                        onChange={e => setHarmonicBase(e.target.value)}
                        className="w-[70px] bg-white text-slate-800 font-mono font-bold text-[10.5px] px-1.5 py-1 rounded-md ring-1 ring-slate-200/80 outline-none focus:ring-2 focus:ring-blue-500 uppercase text-center"
                      />
                    </div>
                  </div>

                  {/* Connected Harmonic Swatches Bar */}
                  <div className="grid grid-cols-5 gap-1.5 pt-2 border-t border-slate-200/60">
                    {generateHarmonicPalette(harmonicBase).map(p => (
                      <button
                        key={p.name}
                        type="button"
                        title={`${p.name}: ${p.color} (Clique para aplicar)`}
                        onClick={() => {
                          const base = p.color;
                          const hex = base.replace('#', '');
                          if (hex.length !== 6) return;
                          const r = parseInt(hex.substring(0, 2), 16);
                          const g = parseInt(hex.substring(2, 4), 16);
                          const b = parseInt(hex.substring(4, 6), 16);
                          const toHex = (r1: number, g1: number, b1: number) => '#' + [r1, g1, b1].map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
                          
                          setColors(prev => ({ 
                            ...prev, 
                            brand: base,
                            brandDark: toHex(r - 40, g - 40, b - 40),
                            blue: base, 
                            green: toHex(255 - r, 255 - g, 255 - b), // Complementary
                            trialButtonBg: toHex(g, b, r) // Analogous +30
                          }));
                        }}
                        className="group flex flex-col items-center gap-1 cursor-pointer p-1 rounded-lg hover:bg-white transition-all"
                      >
                        <div className="w-full h-6 rounded-md ring-1 ring-black/10 group-hover:scale-105 group-hover:ring-2 group-hover:ring-blue-500/60 transition-all" style={{ background: p.color }} />
                        <span className="text-[8px] text-slate-600 font-mono truncate w-full text-center group-hover:text-slate-900 leading-none">{p.name.split(' ')[0]}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* COLOR_PRESETS */}
              {COLOR_PRESETS && COLOR_PRESETS.length > 0 && (
                <div className="border-t border-slate-100 pt-3 space-y-2">
                  <SectionHeader icon={<Blend className="w-4 h-4" />} label="Paletas Salvas" accent="#0284c7" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                    {COLOR_PRESETS.map((preset: any, i: number) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setColors(prev => ({ ...prev, ...preset.colors }))}
                        className="flex items-center gap-2 p-2 rounded-xl bg-slate-50/70 hover:bg-slate-100/90 ring-1 ring-slate-200/60 hover:ring-blue-400/60 transition-all cursor-pointer text-left group min-h-[38px]"
                      >
                        <div className="flex gap-0.5 shrink-0">
                          {[preset.colors?.brand || '#2563eb', preset.colors?.green || '#10b981', preset.colors?.bg || '#fff'].map((c: string, ci: number) => (
                            <div key={ci} className="w-3.5 h-3.5 rounded-sm ring-1 ring-black/10" style={{ background: c }} />
                          ))}
                        </div>
                        <span className="text-[10.5px] font-bold text-slate-700 group-hover:text-slate-900 truncate">{preset.name || `Preset ${i + 1}`}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══════════════ CORES ══════════════ */}
          {activeSection === 'identity' && (
            <div className="space-y-3.5">
              <SectionHeader icon={<Palette className="w-4 h-4" />} label="Tokens de Cor" accent="#2563eb" onReset={resetSectionColors} />

              {/* Quick Contrast / Theme Modes */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-800">Modo de Contraste do Card</span>
                  <span className="text-[9.5px] font-mono text-slate-500 font-bold">1-Clique</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={applyLightMode}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    <span>Card Claro</span>
                  </button>
                  <button
                    type="button"
                    onClick={applyDarkMode}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white border border-slate-950 font-bold text-[11px] transition-all cursor-pointer shadow-2xs"
                  >
                    <Moon className="w-3.5 h-3.5 text-blue-400" />
                    <span>Card Escuro</span>
                  </button>
                </div>
              </div>

              {/* Group: Botões */}
              <div className="space-y-1.5">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>🎯 Botões & Ações</span>
                  <span className="text-[9px] text-slate-400 font-mono">6 tokens</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <ColorToken label="Botão Conectar" value={colors.blue || '#2563eb'} onChange={v => setColors(p => ({ ...p, blue: v }))} onHover={() => onCardHover?.('button')} contrastWith={colors.loginButtonText || '#ffffff'} />
                  <ColorToken label="Texto Conectar" value={colors.loginButtonText || '#ffffff'} onChange={v => setColors(p => ({ ...p, loginButtonText: v }))} onHover={() => onCardHover?.('button')} contrastWith={colors.blue || '#2563eb'} />
                  <ColorToken label="Botão Cadastro" value={colors.green || '#10b981'} onChange={v => setColors(p => ({ ...p, green: v }))} onHover={() => onCardHover?.('button')} contrastWith={colors.registerButtonText || '#ffffff'} />
                  <ColorToken label="Texto Cadastro" value={colors.registerButtonText || '#ffffff'} onChange={v => setColors(p => ({ ...p, registerButtonText: v }))} onHover={() => onCardHover?.('button')} contrastWith={colors.green || '#10b981'} />
                  <ColorToken label="Botão Trial" value={colors.trialButtonBg || '#1e90ff'} onChange={v => setColors(p => ({ ...p, trialButtonBg: v }))} onHover={() => onCardHover?.('button')} contrastWith={colors.trialButtonText || '#ffffff'} />
                  <ColorToken label="Texto Trial" value={colors.trialButtonText || '#ffffff'} onChange={v => setColors(p => ({ ...p, trialButtonText: v }))} onHover={() => onCardHover?.('button')} contrastWith={colors.trialButtonBg || '#1e90ff'} />
                </div>
              </div>

              {/* Group: Superfície */}
              <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>🎴 Superfície & Fundo</span>
                  <span className="text-[9px] text-slate-400 font-mono">3 tokens</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <ColorToken label="Fundo Geral" value={colors.bg || '#fafafa'} onChange={v => setColors(p => ({ ...p, bg: v }))} onHover={() => onCardHover?.('background')} />
                  <ColorToken label="Fundo do Card" value={colors.cardBg || '#ffffff'} onChange={v => setColors(p => ({ ...p, cardBg: v }))} onHover={() => onCardHover?.('card')} />
                  <ColorToken label="Borda do Card" value={colors.cardBorder || '#e2e8f0'} onChange={v => setColors(p => ({ ...p, cardBorder: v }))} onHover={() => onCardHover?.('card')} />
                </div>
              </div>

              {/* Group: Tipografia */}
              <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>📝 Texto & Tipografia</span>
                  <span className="text-[9px] text-slate-400 font-mono">2 tokens</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <ColorToken label="Texto Principal" value={colors.ink || '#0f172a'} onChange={v => setColors(p => ({ ...p, ink: v }))} onHover={() => onCardHover?.('card')} contrastWith={colors.cardBg || '#ffffff'} />
                  <ColorToken label="Texto Secundário" value={colors.muted || '#64748b'} onChange={v => setColors(p => ({ ...p, muted: v }))} onHover={() => onCardHover?.('card')} contrastWith={colors.cardBg || '#ffffff'} />
                </div>
              </div>

              {/* Group: Inputs */}
              <div className="space-y-1.5 border-t border-slate-100 pt-2.5">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between">
                  <span>⌨️ Campos de Entrada</span>
                  <span className="text-[9px] text-slate-400 font-mono">4 tokens</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <ColorToken label="Fundo dos Campos" value={colors.inputBg || '#ffffff'} onChange={v => setColors(p => ({ ...p, inputBg: v }))} onHover={() => onCardHover?.('input')} />
                  <ColorToken label="Texto dos Campos" value={colors.inputText || '#0f172a'} onChange={v => setColors(p => ({ ...p, inputText: v }))} onHover={() => onCardHover?.('input')} contrastWith={colors.inputBg || '#ffffff'} />
                  <ColorToken label="Borda dos Campos" value={colors.inputBorder || '#e2e8f0'} onChange={v => setColors(p => ({ ...p, inputBorder: v }))} onHover={() => onCardHover?.('input')} />
                  <ColorToken label="Placeholder" value={colors.inputPlaceholder || '#94a3b8'} onChange={v => setColors(p => ({ ...p, inputPlaceholder: v }))} onHover={() => onCardHover?.('input')} contrastWith={colors.inputBg || '#ffffff'} />
                </div>
              </div>

              {/* WCAG Legend */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50/50 ring-1 ring-slate-200/50 text-[10px] font-sans">
                <div className="flex items-center gap-1.5 text-slate-600 font-medium">
                  <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                  <span>Guia WCAG:</span>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60 text-[9px] font-bold">≥4.5 AA ✓</span>
                  <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 ring-1 ring-amber-200/60 text-[9px] font-bold">≥3 AA Large</span>
                  <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 ring-1 ring-rose-200/60 text-[9px] font-bold">&lt;3 Falha</span>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ VIDRO & EFEITOS ══════════════ */}
          {activeSection === 'effects' && (
            <div className="space-y-4">
              <SectionHeader icon={<Layers className="w-4 h-4" />} label="Vidro & Efeitos" accent="#0284c7" onReset={resetSectionGlass} />

              {/* Presets de Profundidade */}
              <div className="space-y-2">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Presets de Profundidade</span>
                  <span className="text-[9px] text-slate-500 font-mono font-bold">4 Estilos</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                  {[
                    { id: 'flat', label: 'Flat Clean', desc: 'Opaco 100%', blur: 0, opacity: 100, glow: false },
                    { id: 'soft', label: 'Glass Suave', desc: 'Blur 12px', blur: 12, opacity: 88, glow: false },
                    { id: 'frost', label: 'Frost Alto', desc: 'Blur 22px', blur: 22, opacity: 75, glow: false },
                    { id: 'neon', label: 'Cyber Glow', desc: 'Com Borda', blur: 18, opacity: 85, glow: true },
                  ].map(dp => (
                    <button
                      key={dp.id}
                      type="button"
                      onClick={() => {
                        setColors(p => ({ ...p, glassBlur: dp.blur, glassOpacity: dp.opacity }));
                        setEffects(p => ({ ...p, cardGlowBorder: dp.glow }));
                      }}
                      onMouseEnter={() => onCardHover?.('card')}
                      className="p-2 rounded-xl text-left bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer group shadow-2xs"
                    >
                      <div className="text-[11px] font-bold text-slate-900 group-hover:text-blue-900">{dp.label}</div>
                      <div className="text-[9px] text-slate-500 group-hover:text-blue-700 font-medium">{dp.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <SliderField label="Desfoque do Vidro (Blur)" value={colors.glassBlur ?? 16} min={0} max={32} unit="px" onChange={v => setColors(p => ({ ...p, glassBlur: v }))} onHover={() => onCardHover?.('card')} color="#0284c7" />

              <SliderField
                label="Opacidade do Card"
                value={(() => { const v = colors.glassOpacity ?? 85; return v > 0 && v <= 1 ? Math.round(v * 100) : v; })()}
                min={0} max={100} unit="%"
                onChange={v => setColors(p => ({ ...p, glassOpacity: v }))}
                onHover={() => onCardHover?.('card')}
                color="#0284c7"
              />

              {/* Micro-Toggles */}
              <div className="space-y-2">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Efeitos do Botão</div>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'btnPulse' as const, label: 'Pulso Glow', sub: 'Guia o clique', hover: 'button' },
                    { key: 'cardGlowBorder' as const, label: 'Borda Luminosa', sub: 'Contorno perimetral', hover: 'card' },
                    { key: 'btnShimmer' as const, label: 'Shimmer', sub: 'Brilho deslizante', hover: 'button' },
                    { key: 'titleGradient' as const, label: 'Título Gradiente', sub: 'Texto colorido', hover: 'typography' },
                    { key: 'cardTilt3d' as const, label: 'Tilt 3D', sub: 'Perspectiva ao hover', hover: 'card' },
                    { key: 'cardNoiseTexture' as const, label: 'Textura Noise', sub: 'Granulado sutil', hover: 'card' },
                  ].map(fx => (
                    <label
                      key={fx.key}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/70 hover:bg-slate-100/90 ring-1 ring-slate-200/50 hover:ring-blue-400/50 cursor-pointer transition-all"
                      onMouseEnter={() => onCardHover?.(fx.hover)}
                    >
                      <div className="relative shrink-0">
                        <input
                          type="checkbox"
                          checked={effects[fx.key] ?? false}
                          onChange={e => setEffects(prev => ({ ...prev, [fx.key]: e.target.checked }))}
                          className="sr-only peer"
                        />
                        <div className="w-8 h-4 rounded-full bg-slate-200 peer-checked:bg-blue-600 transition-all" />
                        <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-all peer-checked:translate-x-4 shadow-sm" />
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-slate-800 leading-tight">{fx.label}</div>
                        <div className="text-[9px] text-slate-500 leading-tight">{fx.sub}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ TIPOGRAFIA ══════════════ */}
          {activeSection === 'identity' && (
            <div className="space-y-4">
              <SectionHeader icon={<Type className="w-4 h-4" />} label="Tipografia & Identidade" accent="#0284c7" onReset={resetSectionTypography} />

              {/* Textos do Portal */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Nome do Portal / Provedor</label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    onFocus={() => onCardHover?.('typography')}
                    placeholder="Ex: Hotspot Fibra 5G"
                    className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-800 font-bold text-[12px] px-3 py-2 rounded-xl ring-1 ring-slate-200/70 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Mensagem de Boas-Vindas</label>
                  <input
                    type="text"
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onFocus={() => onCardHover?.('typography')}
                    placeholder="Ex: Conecte-se e aproveite alta velocidade"
                    className="w-full bg-slate-50/70 hover:bg-slate-50 focus:bg-white text-slate-800 text-[11px] px-3 py-2 rounded-xl ring-1 ring-slate-200/70 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
              </div>

              {/* Ícone de Destaque */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Ícone de Destaque do Card</div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {[
                    { id: 'wifi', label: 'Wi-Fi', emoji: '📶' },
                    { id: 'shield', label: 'Seguro', emoji: '🛡️' },
                    { id: 'zap', label: 'Turbo', emoji: '⚡' },
                    { id: 'rocket', label: 'Veloz', emoji: '🚀' },
                    { id: 'coffee', label: 'Lounge', emoji: '☕' },
                    { id: 'none', label: 'Ocultar', emoji: '✕' },
                  ].map(ico => {
                    const selected = (effects.headerIcon || 'wifi') === ico.id;
                    return (
                      <button
                        key={ico.id}
                        type="button"
                        onClick={() => setEffects(prev => ({ ...prev, headerIcon: ico.id as any }))}
                        className={`p-2 rounded-xl text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          selected
                            ? 'bg-blue-50 text-blue-900 ring-2 ring-blue-500 font-bold shadow-2xs'
                            : 'bg-slate-50/60 ring-1 ring-slate-200/50 text-slate-600 hover:bg-slate-100/80 hover:text-slate-900'
                        }`}
                      >
                        <span className="text-xs">{ico.emoji}</span>
                        <span className="text-[9px] font-sans truncate">{ico.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font Family */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Família Tipográfica</div>
                <div className="grid grid-cols-2 gap-2">
                  {fontOptions.map(f => {
                    const selected = studio.fontFamily === f.id;
                    return (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStudio(p => ({ ...p, fontFamily: f.id }))}
                        onFocus={() => onCardHover?.('typography')}
                        className={`p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                          selected
                            ? 'bg-blue-50 text-blue-900 ring-2 ring-blue-500 shadow-xs'
                            : 'bg-slate-50/60 ring-1 ring-slate-200/50 text-slate-700 hover:bg-slate-100/80 hover:ring-blue-300/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-bold text-[11px] leading-tight text-slate-800">{f.name}</div>
                            <div className="text-[9px] text-slate-500 mt-0.5">{f.sample}</div>
                          </div>
                          {selected && <Check className="w-3.5 h-3.5 shrink-0 text-blue-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Text Alignment */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Alinhamento</div>
                <div className="flex bg-slate-100/80 rounded-xl p-1 gap-1">
                  {(['left', 'center', 'right'] as const).map(align => (
                    <button
                      key={align}
                      type="button"
                      onClick={() => setStudio(p => ({ ...p, titleAlign: align }))}
                      className={`flex-1 py-1.5 text-[11px] font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                        studio.titleAlign === align
                          ? 'bg-blue-600 text-white shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {align === 'left' && <AlignLeft className="w-3.5 h-3.5" />}
                      {align === 'center' && <AlignCenter className="w-3.5 h-3.5" />}
                      {align === 'right' && <AlignRight className="w-3.5 h-3.5" />}
                      {align === 'left' ? 'Esq.' : align === 'center' ? 'Centro' : 'Dir.'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Font Size */}
              <SliderField label="Tamanho do Título" value={studio.titleFontSize} min={14} max={36} unit="px" onChange={v => setStudio(p => ({ ...p, titleFontSize: v }))} onHover={() => onCardHover?.('typography')} color="#0284c7" />
            </div>
          )}

          {/* ══════════════ BOTÕES & AÇÕES ══════════════ */}
          {activeSection === 'form' && (
            <div className="space-y-4">
              <SectionHeader
                icon={<SlidersHorizontal className="w-4 h-4" />}
                label="Botões & Interações"
                accent="#2563eb"
                onReset={resetSectionButtons}
                resetLabel="Restaurar Padrão"
              />

              {/* Estilos Rápidos de Botão */}
              <div className="space-y-2">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-700 flex items-center justify-between">
                  <span>Estilos Rápidos</span>
                  <span className="text-[9px] text-slate-500 font-mono font-bold">6 Presets</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                  {[
                    {
                      id: 'solid',
                      label: 'Sólido Forte',
                      desc: 'Alto Contraste',
                      apply: () => {
                        setStudio(p => ({ ...p, btnHeight: 48, btnRadiusTL: 10, btnRadiusTR: 10, btnRadiusBR: 10, btnRadiusBL: 10, btnFontWeight: '700', btnLetterSpacing: 0.5, btnBorderWidth: 0 }));
                        setEffects(p => ({ ...p, btnShimmer: false, btnPulse: false }));
                      }
                    },
                    {
                      id: 'pill-shimmer',
                      label: 'Pílula Shimmer',
                      desc: 'Glow Dinâmico',
                      apply: () => {
                        setStudio(p => ({ ...p, btnHeight: 50, btnRadiusTL: 26, btnRadiusTR: 26, btnRadiusBR: 26, btnRadiusBL: 26, btnFontWeight: '700', btnLetterSpacing: 0.8, btnBorderWidth: 0 }));
                        setEffects(p => ({ ...p, btnShimmer: true, btnPulse: false }));
                      }
                    },
                    {
                      id: 'pulse-focus',
                      label: 'Pulso de Atenção',
                      desc: 'Guia o Olhar',
                      apply: () => {
                        setStudio(p => ({ ...p, btnHeight: 48, btnRadiusTL: 12, btnRadiusTR: 12, btnRadiusBR: 12, btnRadiusBL: 12, btnFontWeight: '700', btnLetterSpacing: 0.5, btnBorderWidth: 0 }));
                        setEffects(p => ({ ...p, btnShimmer: false, btnPulse: true }));
                      }
                    },
                    {
                      id: 'tech-cut',
                      label: 'Cyber Squad',
                      desc: 'Geométrico Reto',
                      apply: () => {
                        setStudio(p => ({ ...p, btnHeight: 46, btnRadiusTL: 2, btnRadiusTR: 2, btnRadiusBR: 2, btnRadiusBL: 2, btnFontWeight: '800', btnLetterSpacing: 1.2, btnBorderWidth: 0 }));
                        setEffects(p => ({ ...p, btnShimmer: true, btnPulse: false }));
                      }
                    },
                    {
                      id: 'compact',
                      label: 'Compact Pro',
                      desc: 'Econômico 40px',
                      apply: () => {
                        setStudio(p => ({ ...p, btnHeight: 40, btnRadiusTL: 8, btnRadiusTR: 8, btnRadiusBR: 8, btnRadiusBL: 8, btnFontWeight: '600', btnLetterSpacing: 0.3, btnBorderWidth: 0 }));
                        setEffects(p => ({ ...p, btnShimmer: false, btnPulse: false }));
                      }
                    },
                    {
                      id: 'chunky',
                      label: 'Bold Impact',
                      desc: 'Maximizador 54px',
                      apply: () => {
                        setStudio(p => ({ ...p, btnHeight: 54, btnRadiusTL: 14, btnRadiusTR: 14, btnRadiusBR: 14, btnRadiusBL: 14, btnFontWeight: '800', btnLetterSpacing: 0.8, btnBorderWidth: 0 }));
                        setEffects(p => ({ ...p, btnShimmer: true, btnPulse: true }));
                      }
                    },
                  ].map(bPreset => (
                    <button
                      key={bPreset.id}
                      type="button"
                      onClick={bPreset.apply}
                      onMouseEnter={() => onCardHover?.('button')}
                      className="p-2.5 rounded-xl text-left bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 transition-all cursor-pointer group shadow-2xs"
                    >
                      <div className="text-[11px] font-bold text-slate-900 group-hover:text-blue-900">{bPreset.label}</div>
                      <div className="text-[9px] text-slate-500 group-hover:text-blue-700 font-medium">{bPreset.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Dimensões & Geometria */}
              <div className="space-y-2 border-t border-slate-200/80 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-700">Dimensões & Geometria</div>
                <SliderField
                  label="Altura do Botão de Conexão"
                  value={studio.btnHeight}
                  min={36}
                  max={64}
                  unit="px"
                  onChange={v => setStudio(p => ({ ...p, btnHeight: v }))}
                  onHover={() => onCardHover?.('button')}
                  color="#2563eb"
                />
                <SliderField
                  label="Arredondamento das Bordas (Radius)"
                  value={studio.btnRadiusTL}
                  min={0}
                  max={32}
                  unit="px"
                  onChange={v => setStudio(p => ({ ...p, btnRadiusTL: v, btnRadiusTR: v, btnRadiusBR: v, btnRadiusBL: v }))}
                  onHover={() => onCardHover?.('button')}
                  color="#2563eb"
                />
              </div>

              {/* Tipografia do Botão */}
              <div className="space-y-2.5 border-t border-slate-200/80 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-700">Tipografia do Botão</div>

                {/* Peso da Fonte */}
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-800">Peso da Fonte:</span>
                  <div className="flex bg-slate-100 rounded-lg p-0.5 gap-0.5 border border-slate-200">
                    {[
                      { id: '500', label: 'Médio' },
                      { id: '600', label: 'Semi' },
                      { id: '700', label: 'Bold' },
                      { id: '800', label: 'Black' },
                    ].map(w => (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => setStudio(p => ({ ...p, btnFontWeight: w.id }))}
                        className={`px-2 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                          studio.btnFontWeight === w.id
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-slate-600 hover:text-slate-950'
                        }`}
                      >
                        {w.label}
                      </button>
                    ))}
                  </div>
                </div>

                <SliderField
                  label="Tamanho do Texto do Botão"
                  value={studio.btnFontSize}
                  min={11}
                  max={18}
                  unit="px"
                  onChange={v => setStudio(p => ({ ...p, btnFontSize: v }))}
                  onHover={() => onCardHover?.('button')}
                  color="#2563eb"
                />

                <SliderField
                  label="Espaçamento Entre Letras"
                  value={Math.round((studio.btnLetterSpacing || 0.5) * 10)}
                  min={0}
                  max={25}
                  unit=""
                  onChange={v => setStudio(p => ({ ...p, btnLetterSpacing: v / 10 }))}
                  onHover={() => onCardHover?.('button')}
                  color="#2563eb"
                />
              </div>

              {/* Efeitos Ativos do Botão */}
              <div className="space-y-2 border-t border-slate-200/80 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-700">Micro-Animações & Efeitos</div>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-all"
                    onMouseEnter={() => onCardHover?.('button')}
                  >
                    <div className="relative shrink-0">
                      <input
                        type="checkbox"
                        checked={effects.btnShimmer ?? false}
                        onChange={e => setEffects(p => ({ ...p, btnShimmer: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 rounded-full bg-slate-300 peer-checked:bg-blue-600 transition-all" />
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-all peer-checked:translate-x-4 shadow-sm" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900 leading-tight">Shimmer Efeito</div>
                      <div className="text-[9px] text-slate-600 leading-tight">Brilho fluido luminoso</div>
                    </div>
                  </label>

                  <label
                    className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 cursor-pointer transition-all"
                    onMouseEnter={() => onCardHover?.('button')}
                  >
                    <div className="relative shrink-0">
                      <input
                        type="checkbox"
                        checked={effects.btnPulse ?? false}
                        onChange={e => setEffects(p => ({ ...p, btnPulse: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 rounded-full bg-slate-300 peer-checked:bg-blue-600 transition-all" />
                      <div className="absolute top-0.5 left-0.5 w-3 h-3 rounded-full bg-white transition-all peer-checked:translate-x-4 shadow-sm" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-slate-900 leading-tight">Pulso Glow</div>
                      <div className="text-[9px] text-slate-600 leading-tight">Onda de atenção contínua</div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Cores Diretas dos Botões */}
              <div className="space-y-2 border-t border-slate-200/80 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-700">Cores Diretas dos Botões</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  <ColorToken
                    label="Fundo Botão Conectar"
                    value={colors.blue || '#2563eb'}
                    onChange={v => setColors(p => ({ ...p, blue: v }))}
                    onHover={() => onCardHover?.('button')}
                    contrastWith={colors.loginButtonText || '#ffffff'}
                  />
                  <ColorToken
                    label="Texto Botão Conectar"
                    value={colors.loginButtonText || '#ffffff'}
                    onChange={v => setColors(p => ({ ...p, loginButtonText: v }))}
                    onHover={() => onCardHover?.('button')}
                    contrastWith={colors.blue || '#2563eb'}
                  />
                </div>
              </div>
            </div>
          )}

          {/* ══════════════ LAYOUT ══════════════ */}
          {activeSection === 'form' && (
            <div className="space-y-4">
              <SectionHeader icon={<LayoutGrid className="w-4 h-4" />} label="Layout & Formas" accent="#10b981" onReset={resetSectionLayout} />

              {/* Shape Presets */}
              <div className="space-y-2">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Estilo dos Cantos</div>
                <div className="grid grid-cols-2 gap-2">
                  {shapeOptions.map(sh => {
                    const selected = effects.cardShape === sh.id;
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        onClick={() => applyShapePreset(sh.id)}
                        onFocus={() => onCardHover?.('card')}
                        className={`p-3 rounded-xl text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                          selected
                            ? 'bg-emerald-50 text-emerald-900 ring-2 ring-emerald-500 shadow-xs'
                            : 'bg-slate-50/60 ring-1 ring-slate-200/50 text-slate-700 hover:bg-slate-100/80 hover:ring-emerald-300/50'
                        }`}
                      >
                        <span className={selected ? 'text-emerald-600' : 'text-slate-500'}>{sh.icon}</span>
                        <div>
                          <div className="font-bold text-[11px] leading-tight text-slate-800">{sh.label}</div>
                          <div className="text-[9px] text-slate-500">{sh.sub}</div>
                        </div>
                        {selected && <Check className="w-3.5 h-3.5 ml-auto shrink-0 text-emerald-600" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Radius sliders */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Raios Customizados</div>
                <SliderField label="Raio do Card" value={studio.cardRadiusTL} min={0} max={36} unit="px" onChange={v => setStudio(p => ({ ...p, cardRadiusTL: v, cardRadiusTR: v, cardRadiusBR: v, cardRadiusBL: v }))} onHover={() => onCardHover?.('card')} color="#10b981" />
                <SliderField label="Raio do Botão" value={studio.btnRadiusTL} min={0} max={28} unit="px" onChange={v => setStudio(p => ({ ...p, btnRadiusTL: v, btnRadiusTR: v, btnRadiusBR: v, btnRadiusBL: v }))} onHover={() => onCardHover?.('button')} color="#10b981" />
                <SliderField label="Raio dos Campos" value={studio.inputRadius} min={0} max={24} unit="px" onChange={v => setStudio(p => ({ ...p, inputRadius: v }))} onHover={() => onCardHover?.('input')} color="#10b981" />
              </div>

              {/* Spacing */}
              <div className="space-y-2 border-t border-slate-100 pt-3">
                <div className="text-[10px] font-sans font-bold uppercase tracking-wider text-slate-500">Espaçamentos</div>
                <SliderField label="Altura do Botão" value={studio.btnHeight} min={36} max={68} unit="px" onChange={v => setStudio(p => ({ ...p, btnHeight: v }))} onHover={() => onCardHover?.('button')} color="#0284c7" />
                <SliderField label="Padding Interno do Card" value={studio.cardPaddingTop} min={12} max={44} unit="px" onChange={v => setStudio(p => ({ ...p, cardPaddingTop: v, cardPaddingRight: v, cardPaddingBottom: v, cardPaddingLeft: v }))} onHover={() => onCardHover?.('card')} color="#0284c7" />
                <SliderField label="Espaço entre Itens (Gap)" value={studio.cardGap} min={8} max={32} unit="px" onChange={v => setStudio(p => ({ ...p, cardGap: v }))} onHover={() => onCardHover?.('card')} color="#0284c7" />
                <SliderField label="Altura dos Campos" value={studio.inputHeight} min={36} max={64} unit="px" onChange={v => setStudio(p => ({ ...p, inputHeight: v }))} onHover={() => onCardHover?.('input')} color="#0284c7" />
              </div>
            </div>
          )}

          {/* ══════════════ TEXTOS & CONTEÚDO ══════════════ */}
          {activeSection === 'content' && (
            <div className="space-y-4">
              <SectionHeader
                icon={<FileText className="w-4 h-4" />}
                label="Textos & Conteúdo do Portal"
                accent="#2563eb"
                onReset={resetSectionContent}
                resetLabel="Restaurar Textos"
              />

              {/* Informações Principais */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <label className="text-[10.5px] font-sans font-bold uppercase tracking-wider text-slate-800">
                    Nome do Provedor / Negócio
                  </label>
                  <input
                    type="text"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    onFocus={() => onCardHover?.('typography')}
                    placeholder="Ex: Hotspot Fibra 5G"
                    className="w-full bg-white text-slate-950 font-bold text-[12px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-2xs"
                  />
                  <p className="text-[9.5px] text-slate-500">Exibido no topo do card e na aba do navegador.</p>
                </div>

                <div className="space-y-1">
                  <label className="text-[10.5px] font-sans font-bold uppercase tracking-wider text-slate-800">
                    Mensagem de Boas-Vindas
                  </label>
                  <textarea
                    rows={2}
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    onFocus={() => onCardHover?.('typography')}
                    placeholder="Ex: Conecte-se e aproveite alta velocidade."
                    className="w-full bg-white text-slate-950 font-medium text-[11.5px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all shadow-2xs resize-none"
                  />
                  <p className="text-[9.5px] text-slate-500">Texto explicativo abaixo do título.</p>
                </div>
              </div>

              {/* Rótulos dos Botões */}
              <div className="space-y-3 border-t border-slate-200/80 pt-3">
                <div className="text-[10.5px] font-sans font-bold uppercase tracking-wider text-slate-800">
                  Rótulos dos Botões de Ação
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-700">Botão de Login (Principal)</label>
                    <input
                      type="text"
                      value={loginButtonLabel}
                      onChange={e => setLoginButtonLabel && setLoginButtonLabel(e.target.value)}
                      onFocus={() => onCardHover?.('button')}
                      placeholder="Conectar"
                      className="w-full bg-white text-slate-950 font-bold text-[11.5px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none transition-all shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-700">Botão de Cadastro</label>
                    <input
                      type="text"
                      value={registerButtonText}
                      onChange={e => setRegisterButtonText && setRegisterButtonText(e.target.value)}
                      onFocus={() => onCardHover?.('button')}
                      placeholder="Cadastre-se aqui"
                      className="w-full bg-white text-slate-950 font-bold text-[11.5px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Seção de Teste Grátis / Degustação */}
              <div className="space-y-3 border-t border-slate-200/80 pt-3">
                <div className="text-[10.5px] font-sans font-bold uppercase tracking-wider text-slate-800 flex items-center justify-between">
                  <span>Acesso de Teste / Degustação</span>
                  <span className="text-[9px] font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-bold">Voucher Grátis</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-700">Frase de Chamada</label>
                    <input
                      type="text"
                      value={trialText}
                      onChange={e => setTrialText && setTrialText(e.target.value)}
                      placeholder="Acesso de teste disponível, "
                      className="w-full bg-white text-slate-950 font-medium text-[11.5px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none transition-all shadow-2xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-slate-700">Texto do Link de Ação</label>
                    <input
                      type="text"
                      value={trialLinkText}
                      onChange={e => setTrialLinkText && setTrialLinkText(e.target.value)}
                      placeholder="clique aqui"
                      className="w-full bg-white text-blue-700 font-bold text-[11.5px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none transition-all shadow-2xs"
                    />
                  </div>
                </div>
              </div>

              {/* Termos Legais e Rodapé */}
              <div className="space-y-2 border-t border-slate-200/80 pt-3">
                <div className="text-[10.5px] font-sans font-bold uppercase tracking-wider text-slate-800">
                  Termos Legais & Privacidade
                </div>
                <textarea
                  rows={2}
                  value={termsText}
                  onChange={e => setTermsText && setTermsText(e.target.value)}
                  placeholder="Ao se cadastrar, você concorda com nossos Termos de Uso e Política de Privacidade."
                  className="w-full bg-white text-slate-950 font-normal text-[11px] px-3 py-2 rounded-xl border border-slate-300 focus:border-blue-600 outline-none transition-all shadow-2xs resize-none"
                />
                <p className="text-[9.5px] text-slate-500">Exibido no rodapé do portal em conformidade com LGPD/Marco Civil.</p>
              </div>
            </div>
          )}

          {/* ══════════════ FUNDO & NICHOS ══════════════ */}
          {activeSection === 'identity' && (
            <div className="space-y-4">
              <SectionHeader icon={<Sparkles className="w-4 h-4" />} label="Fundo & 25 Nichos" accent="#0284c7" onReset={resetSectionBackground} />

              {/* Category filter */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { id: 'all', label: 'Todos' },
                  { id: 'Tech', label: 'Tech' },
                  { id: 'Alimentação', label: 'Food' },
                  { id: 'Saúde', label: 'Saúde' },
                  { id: 'Hotelaria', label: 'Hotel' },
                  { id: 'Comércio', label: 'Comércio' },
                ].map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setBgCategory(cat.id)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-sans font-bold transition-all cursor-pointer ${
                      bgCategory === cat.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100/70 text-slate-600 hover:text-slate-900 hover:bg-slate-200/70'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>

              {/* Effects grid */}
              <div className="grid grid-cols-2 gap-1.5 max-h-64 overflow-y-auto pr-0.5 scrollbar-thin scrollbar-thumb-slate-200">
                {NICHE_EFFECTS
                  .filter((fx: any) => bgCategory === 'all' || fx.niche?.includes(bgCategory) || fx.name?.includes(bgCategory))
                  .map((fx: any) => {
                    const selected = effects.bgEffect === fx.id;
                    return (
                      <button
                        key={fx.id}
                        type="button"
                        onClick={() => { setEffects(p => ({ ...p, bgEffect: fx.id })); setBg(p => ({ ...p, type: 'default', url: '' })); }}
                        onFocus={() => onCardHover?.('background')}
                        className={`flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer text-[11px] ${
                          selected
                            ? 'bg-blue-50 ring-2 ring-blue-500 text-blue-900 font-bold shadow-xs'
                            : 'bg-slate-50/60 ring-1 ring-slate-200/50 text-slate-700 hover:bg-slate-100/80 hover:ring-blue-300/50'
                        }`}
                      >
                        <div className="truncate pr-1">
                          <div className="font-bold truncate text-[11px] leading-tight text-slate-800">{fx.name}</div>
                          <div className={`text-[9px] truncate mt-0.5 ${selected ? 'text-blue-700 font-semibold' : 'text-slate-500'}`}>{fx.niche}</div>
                        </div>
                        {selected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                      </button>
                    );
                  })}
              </div>

              {/* Speed & Upload */}
              <div className="space-y-3 border-t border-slate-100 pt-3">
                {/* Speed Slider & Presets */}
                <div className="p-3 rounded-xl bg-slate-50/50 ring-1 ring-slate-200/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">Velocidade da Animação:</span>
                    <div className="flex bg-slate-100/80 rounded-lg p-0.5 gap-0.5">
                      {(['slow', 'normal', 'fast'] as const).map(spd => (
                        <button
                          key={spd}
                          type="button"
                          onClick={() => {
                            const factor = spd === 'slow' ? 0.5 : spd === 'fast' ? 2.0 : 1.0;
                            setEffects(p => ({ ...p, bgEffectSpeed: spd, bgEffectSpeedMultiplier: factor }));
                          }}
                          className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                            effects.bgEffectSpeed === spd ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {spd === 'slow' ? '0.5x Lento' : spd === 'normal' ? '1.0x Normal' : '2.0x Rápido'}
                        </button>
                      ))}
                    </div>
                  </div>

                  <SliderField
                    label="Controle Fino de Velocidade"
                    value={Math.round((effects.bgEffectSpeedMultiplier ?? (effects.bgEffectSpeed === 'slow' ? 0.5 : effects.bgEffectSpeed === 'fast' ? 2.0 : 1.0)) * 100)}
                    min={20}
                    max={300}
                    step={5}
                    unit="%"
                    onChange={v => {
                      const factor = v / 100;
                      const speedMode = factor < 0.75 ? 'slow' : factor > 1.4 ? 'fast' : 'normal';
                      setEffects(p => ({ ...p, bgEffectSpeed: speedMode, bgEffectSpeedMultiplier: factor }));
                    }}
                    onHover={() => onCardHover?.('background')}
                    color="#0284c7"
                  />
                </div>

                {/* Media type */}
                <div className="p-2.5 rounded-xl bg-slate-50/50 ring-1 ring-slate-200/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium text-slate-600">Tipo de Fundo:</span>
                    <select
                      value={bg.type}
                      onChange={e => {
                        const newType = e.target.value as any;
                        setBg(p => ({
                          ...p,
                          type: newType,
                          url: newType === 'default' ? '' : p.url
                        }));
                      }}
                      onFocus={() => onCardHover?.('background')}
                      className="bg-white text-slate-800 font-bold text-[11px] px-2.5 py-1.5 rounded-lg ring-1 ring-slate-200 outline-none cursor-pointer"
                    >
                      <option value="default">Canvas Animado (Sem Vídeo/Foto)</option>
                      <option value="image">Foto Personalizada</option>
                      <option value="video">Vídeo MP4</option>
                    </select>
                  </div>

                  {/* Active media banner with instant remove button */}
                  {bg.url && (
                    <div className="p-2.5 rounded-xl bg-amber-50/80 ring-1 ring-amber-200/80 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {bg.type === 'video' ? <Film className="w-4 h-4 text-amber-600 shrink-0" /> : <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />}
                        <div className="min-w-0">
                          <div className="text-[11px] font-bold text-amber-900 truncate">
                            {bg.type === 'video' ? 'Vídeo Ativo' : 'Foto Ativa'}
                          </div>
                          <div className="text-[9px] text-amber-700 font-mono truncate max-w-[150px]">
                            {bg.url.split('/').pop()?.split('?')[0]}
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (handleBgRemove) {
                            handleBgRemove();
                          } else {
                            setBg({ type: 'default', url: '' });
                          }
                        }}
                        disabled={bgUploadLoading}
                        className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-xs shrink-0"
                        title="Remover vídeo/imagem e restaurar efeito canvas"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remover</span>
                      </button>
                    </div>
                  )}

                  {(bg.type === 'image' || bg.type === 'video') && (
                    <div className="p-2.5 rounded-xl bg-white ring-1 ring-slate-200 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {bg.type === 'video' ? <Film className="w-4 h-4 text-blue-600" /> : <ImageIcon className="w-4 h-4 text-blue-600" />}
                        <div>
                          <div className="text-[11px] font-bold text-slate-800">{bg.url ? (bg.type === 'video' ? 'Substituir Vídeo' : 'Substituir Foto') : (bg.type === 'video' ? 'Carregar Vídeo' : 'Carregar Foto')}</div>
                          <div className="text-[9px] text-slate-500">{bg.type === 'video' ? 'Formatos: MP4, WebM (máx. 35MB)' : 'Formatos: JPG, PNG, WebP (máx. 10MB)'}</div>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <label className="cursor-pointer text-[10px] font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-all flex items-center gap-1.5 shadow-xs">
                          <Upload className="w-3.5 h-3.5" />
                          {bgUploadLoading ? 'Enviando...' : bg.url ? 'Trocar' : 'Enviar'}
                          <input type="file" className="hidden" accept={bg.type === 'image' ? 'image/*' : 'video/mp4,video/webm'} onChange={handleBgUpload} disabled={bgUploadLoading} />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
