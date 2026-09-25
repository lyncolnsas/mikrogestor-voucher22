"use client";
/* eslint-disable @next/next/no-img-element */

import React from 'react';
import { 
  Upload, 
  Eye, 
  Sun, 
  Moon, 
  Image as ImageIcon,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight
} from 'lucide-react';

export interface BrandConfig {
  headerStyle: 'hidden' | 'transparent' | 'floating' | 'solid';
  displayMode: 'image' | 'text' | 'both' | 'badge' | 'none';
  logoBg: 'none' | 'glass' | 'white' | 'dark' | 'brand' | 'glow' | 'custom';
  logoBgCustomColor: string;
  logoShape: 'circle' | 'rounded' | 'square' | 'pill';
  logoPadding: number;
  logoSize: number;
  logoBorder: boolean;
  logoShadow: boolean;
  titleText: string;
  subtitleText: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  letterSpacing: number;
  lineHeight: number;
  textColor: string;
  textAlign: 'center' | 'left' | 'right';
  textTransform: 'none' | 'uppercase' | 'capitalize' | 'lowercase';
  textEffect: 'none' | 'handwriting' | 'typewriter' | 'gradient-metal' | 'neon-glow' | 'glitch-cyber' | 'gold-shimmer' | 'floating-3d' | 'fire-ember' | 'rainbow-holo' | 'emerald-aurora' | 'deep-sapphire' | 'retro-vintage' | 'pure-3d-extrude';
  textStrokeWidth?: number;
  textStrokeColor?: string;
  textTiltX?: number;
  textTiltY?: number;
  badgeStyle?: 'none' | 'glass-pill' | 'glow-frame' | 'scifi-bracket' | 'minimal-solid' | 'gold-border';
  taglineFontFamily?: string;
  taglineFontSize?: number;
  taglineColor?: string;
  taglineLetterSpacing?: number;
  entranceAnimation: 'none' | 'fade-zoom' | 'slide-up-3d' | 'slide-down-bounce' | 'typewriter' | 'glitch-cyber' | 'neon-flicker' | 'wave-reveal' | 'flip-3d-x' | 'flip-3d-y' | 'gold-shimmer-sweep' | 'kinetic-stamp' | 'blur-focus' | 'stagger-letter' | 'matrix-decrypt' | 'curtain-reveal' | 'spiral-in';
  animationDuration: number;
  animationDelay: number;
  animationEasing: 'smooth' | 'elastic' | 'expo' | 'linear';
  continuousEffect: 'none' | 'floating' | 'neon-breathe' | 'shimmer-loop' | 'rainbow-cycle' | 'jitter-glitch' | 'wobble-3d';
}

interface DynamicLogoEditorProps {
  brand: BrandConfig;
  setBrand: React.Dispatch<React.SetStateAction<BrandConfig>>;
  colors: {
    brand: string;
    brandDark: string;
    muted?: string;
    [key: string]: any;
  };
  businessName: string;
  setBusinessName: (val: string) => void;
  logoPreviewUrl: string;
  logoUploadLoading: boolean;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  onTriggerReplay?: () => void;
}

export default function DynamicLogoEditor({
  brand,
  setBrand,
  colors,
  logoPreviewUrl,
  logoUploadLoading,
  handleLogoUpload,
  fileInputRef
}: DynamicLogoEditorProps) {
  const [sandboxBg, setSandboxBg] = React.useState<'dark' | 'light'>('dark');

  const isLogoEnabled = brand.displayMode === 'image';

  const handleToggleLogo = () => {
    if (isLogoEnabled) {
      setBrand(prev => ({ 
        ...prev, 
        displayMode: 'none' 
      }));
    } else {
      setBrand(prev => ({ 
        ...prev, 
        displayMode: 'image',
        // Limpar textos e efeitos de animação legados para evitar conflito
        titleText: '',
        subtitleText: '',
        entranceAnimation: 'none',
        continuousEffect: 'none',
        textEffect: 'none',
        logoBg: 'none',
        logoShape: 'rounded',
        logoShadow: false,
        logoBorder: false
      }));
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* 1. PALCO DE VISUALIZAÇÃO (SANDBOX) */}
      <div className="bg-gradient-to-b from-[#141724] to-[#0c0e17] border border-[#23273c] rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        {/* Glow de fundo decorativo */}
        <div 
          className="absolute -top-24 -left-24 w-72 h-72 rounded-full blur-3xl pointer-events-none opacity-10"
          style={{ background: colors.brand || '#2563eb' }}
        />

        <div className="flex items-center justify-between gap-3 mb-4 relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Eye className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100 uppercase tracking-wider">
                Visualização do Logotipo
              </h3>
              <p className="text-[11px] text-slate-400">
                Veja em tempo real a exibição da logo na tela de login.
              </p>
            </div>
          </div>

          {/* Alternador de Contraste */}
          <div className="flex items-center bg-[#181c2b] border border-[#2a3047] rounded-xl p-0.5">
            <button
              type="button"
              onClick={() => setSandboxBg('dark')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                sandboxBg === 'dark' ? 'bg-[#23283c] text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Moon className="w-3 h-3 text-indigo-400" />
              Escuro
            </button>
            <button
              type="button"
              onClick={() => setSandboxBg('light')}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all ${
                sandboxBg === 'light' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="w-3 h-3 text-amber-500" />
              Claro
            </button>
          </div>
        </div>

        {/* Área do Palco */}
        <div 
          className={`min-h-[160px] rounded-xl border flex items-center justify-center p-6 relative transition-all duration-300 ${
            sandboxBg === 'dark' 
              ? 'bg-[#08090e] border-[#1f2438]' 
              : 'bg-slate-100 border-slate-300'
          }`}
        >
          {isLogoEnabled ? (
            <div 
              style={{
                width: '100%',
                display: 'flex',
                justifyContent: brand.textAlign === 'left' ? 'flex-start' 
                  : brand.textAlign === 'right' ? 'flex-end' : 'center',
                padding: '10px'
              }}
            >
              <div 
                className="flex items-center justify-center transition-all"
                style={{
                  width: `${brand.logoSize || 120}px`,
                  height: `${brand.logoSize || 120}px`,
                  padding: `${brand.logoPadding || 0}px`
                }}
              >
                <img 
                  src={logoPreviewUrl || '/logo.png'} 
                  alt="Logo do Hotspot" 
                  className="max-w-full max-h-full object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/logo.png';
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="text-center space-y-1">
              <ImageIcon className="w-8 h-8 text-slate-600 mx-auto opacity-40" />
              <p className="text-xs font-semibold text-slate-500">Logotipo Desativado</p>
              <p className="text-[10px] text-slate-500">Ative nas configurações abaixo para exibir.</p>
            </div>
          )}
        </div>
      </div>

      {/* 2. CONTROLES DE CONFIGURAÇÃO */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-5">
        
        {/* Habilitar / Desabilitar Switch */}
        <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 border border-slate-200/80">
          <div className="space-y-0.5">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider block">Exibir Logotipo no Hotspot</label>
            <p className="text-xs text-slate-500">Ative ou remova completamente a logo da tela de login do seu hotspot.</p>
          </div>
          <button
            type="button"
            onClick={handleToggleLogo}
            className={`w-12 h-6 rounded-full p-1 transition-colors duration-200 focus:outline-none cursor-pointer ${
              isLogoEnabled ? 'bg-blue-600' : 'bg-slate-300'
            }`}
          >
            <div
              className={`bg-white w-4 h-4 rounded-full shadow-md transform duration-200 ease-in-out ${
                isLogoEnabled ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {isLogoEnabled && (
          <div className="space-y-5 animate-fade-in">
            {/* Upload do Logo */}
            <div className="flex flex-col sm:flex-row items-center gap-5 p-5 rounded-xl bg-slate-50 border border-slate-200/80">
              <div 
                className="w-20 h-20 rounded-xl bg-white border border-slate-200 shadow-xs flex items-center justify-center relative shrink-0 overflow-hidden"
                style={{ padding: `${brand.logoPadding || 0}px` }}
              >
                {logoUploadLoading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
                ) : (
                  <img src={logoPreviewUrl || '/logo.png'} alt="Logo" className="max-w-full max-h-full object-contain" />
                )}
              </div>

              <div className="flex-1 text-center sm:text-left space-y-2">
                <span className="block font-bold text-slate-900 text-xs uppercase tracking-wider">Enviar Logotipo (PNG)</span>
                <p className="text-xs text-slate-500">Envie um arquivo PNG com fundo transparente para melhor adaptação visual.</p>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={logoUploadLoading}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {logoUploadLoading ? 'Enviando...' : 'Selecionar Arquivo PNG'}
                  </button>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleLogoUpload} 
                    accept="image/png" 
                    className="hidden" 
                  />
                </div>
              </div>
            </div>

            {/* Ajustes de Tamanho, Espaçamento e Posição */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-5 space-y-5">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 border-b border-slate-200/80 pb-3">
                <Sliders className="w-4 h-4 text-blue-600" />
                Ajustes de Layout
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Tamanho */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-700">Tamanho da Logo</span>
                    <span className="text-blue-600 font-mono font-bold">{brand.logoSize || 120}px</span>
                  </div>
                  <input
                    type="range"
                    min="40"
                    max="320"
                    value={brand.logoSize || 120}
                    onChange={(e) => setBrand(prev => ({ ...prev, logoSize: Number(e.target.value) }))}
                    className="w-full accent-blue-600 bg-slate-200 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Espaçamento / Padding */}
                <div>
                  <div className="flex justify-between text-xs mb-1.5">
                    <span className="font-bold text-slate-700">Espaçamento Interno</span>
                    <span className="text-blue-600 font-mono font-bold">{brand.logoPadding || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={brand.logoPadding || 0}
                    onChange={(e) => setBrand(prev => ({ ...prev, logoPadding: Number(e.target.value) }))}
                    className="w-full accent-blue-600 bg-slate-200 h-1.5 rounded-lg appearance-none cursor-pointer"
                  />
                </div>

                {/* Posicionamento / Alinhamento */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1.5">Posição Horizontal</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-200/80 p-1 rounded-xl border border-slate-300">
                    {[
                      { id: 'left', label: 'Esquerda', icon: AlignLeft },
                      { id: 'center', label: 'Centro', icon: AlignCenter },
                      { id: 'right', label: 'Direita', icon: AlignRight }
                    ].map((align) => {
                      const Icon = align.icon;
                      const isSelected = (brand.textAlign || 'center') === align.id;
                      return (
                        <button
                          key={align.id}
                          type="button"
                          onClick={() => setBrand(prev => ({ ...prev, textAlign: align.id as any }))}
                          className={`py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-white text-blue-600 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          <span>{align.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
