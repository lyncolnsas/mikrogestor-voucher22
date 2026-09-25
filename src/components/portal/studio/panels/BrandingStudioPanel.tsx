"use client";

import React, { useState } from 'react';
import { 
  Upload, 
  Sparkles, 
  Sliders, 
  Type,
  ShieldCheck,
  FolderOpen,
  Box
} from 'lucide-react';
import { BrandConfig } from '@/components/portal/DynamicLogoEditor';

// Quick WCAG contrast ratio calculator
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

interface BrandingStudioPanelProps {
  colors: any;
  setColors: React.Dispatch<React.SetStateAction<any>>;
  brand: BrandConfig;
  setBrand: React.Dispatch<React.SetStateAction<BrandConfig>>;
  bg: any;
  setBg: React.Dispatch<React.SetStateAction<any>>;
  effects: any;
  setEffects: React.Dispatch<React.SetStateAction<any>>;
  studio?: any;
  setStudio?: React.Dispatch<React.SetStateAction<any>>;
  colorPresets: any[];
  nicheEffects: any[];
  logoPreviewUrl: string;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  logoUploadLoading: boolean;
  onBgUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  bgUploadLoading: boolean;
  onBgRemove: () => void;
  template?: string;
  setTemplate?: (t: string) => void;
  availableTemplates?: string[];
  onOpenMediaPicker?: (target: { type: 'bg' | 'logo'; title: string }) => void;
}

export default function BrandingStudioPanel({
  colors,
  setColors,
  brand,
  setBrand,
  bg,
  effects,
  setEffects,
  studio,
  setStudio,
  colorPresets,
  nicheEffects,
  logoPreviewUrl,
  onLogoUpload,
  logoUploadLoading,
  onBgUpload,
  bgUploadLoading,
  onBgRemove,
  template = 'default',
  setTemplate,
  availableTemplates = ['default', 'FAP'],
  onOpenMediaPicker,
}: BrandingStudioPanelProps) {
  const [activeSubTab, setActiveSubTab] = useState<'presets' | 'layout' | 'palette' | 'logo' | 'background'>('presets');

  // Contrast check
  const buttonContrast = getContrastRatio(colors.blue || '#2563eb', colors.loginButtonText || '#ffffff');
  const cardTextContrast = getContrastRatio(colors.cardBg || '#ffffff', colors.ink || '#0f172a');

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-5 select-none">
      {/* Subtabs for Branding */}
      <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/90 p-1 rounded-xl border border-slate-200 dark:border-slate-700/70 overflow-x-auto scrollbar-none">
        {[
          { id: 'presets', label: 'Temas' },
          { id: 'layout', label: 'Estruturas & Caixas' },
          { id: 'palette', label: 'Cores' },
          { id: 'logo', label: 'Logotipo' },
          { id: 'background', label: 'Fundo' },
        ].map(sub => (
          <button
            key={sub.id}
            type="button"
            onClick={() => setActiveSubTab(sub.id as any)}
            className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-lg transition-all cursor-pointer text-center whitespace-nowrap ${
              activeSubTab === sub.id
                ? 'bg-white dark:bg-blue-600 text-blue-600 dark:text-white shadow-xs font-bold'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            {sub.label}
          </button>
        ))}
      </div>

      {/* 1. PRESETS TAB */}
      {activeSubTab === 'presets' && (
        <div className="space-y-4">
          {/* Hotspot Layout Templates / Presets */}
          {setTemplate && availableTemplates && availableTemplates.length > 0 && (
            <div className="space-y-2 pb-3 border-b border-slate-200 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
                  Modelos de Hotspot (Presets)
                </h3>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">Selecione o modelo</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {availableTemplates.map((t) => {
                  const isCur = (template || 'default') === t;
                  const isFap = t.toLowerCase() === 'fap';
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTemplate(t)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        isCur
                          ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 ring-2 ring-blue-500/20 shadow-xs'
                          : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
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
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                        {isFap ? 'FAP Oficial' : 'Padrão Pro'}
                      </div>
                      <div className="text-[10px] text-slate-500 dark:text-slate-300 line-clamp-1">
                        {isFap ? 'Faculdade Adventista' : 'Modelo Moderno'}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Paletas de Cores de Alta Performance
            </h3>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">Clique para aplicar</span>
          </div>

          <div className="grid grid-cols-1 gap-2.5">
            {colorPresets.map((preset) => {
              const isSelected = colors.bg === preset.colors.bg && 
                colors.brand === preset.colors.brand && 
                (preset.colors.cardBg ? colors.cardBg === preset.colors.cardBg : true) &&
                (preset.colors.blue ? colors.blue === preset.colors.blue : true);
              return (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => setColors((prev: any) => ({ ...prev, ...preset.colors }))}
                  className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/50 ring-2 ring-blue-500/30 shadow-xs'
                      : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{preset.icon}</span>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                          {preset.name}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-extrabold bg-blue-600 text-white px-1.5 py-0.5 rounded-md">
                            ATIVO
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 dark:text-slate-300 line-clamp-1">
                        {preset.desc}
                      </p>
                    </div>
                  </div>

                  {/* Color Swatch Dots */}
                  <div className="flex items-center gap-1 shrink-0 ml-2">
                    <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: preset.colors.bg }} />
                    <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: preset.colors.brand }} />
                    <span className="w-3.5 h-3.5 rounded-full border border-black/10 shadow-xs" style={{ backgroundColor: preset.colors.blue }} />
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 2. ESTRUTURA & CAIXAS (LAYOUT) TAB */}
      {activeSubTab === 'layout' && (
        <div className="space-y-4">
          {/* Formato e Geometria do Card Principal */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Box className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Caixa de Login (Card)</span>
              </h4>
            </div>

            {/* Presets Rápidos de Formato */}
            <div className="space-y-1">
              <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Formato do Card
              </label>
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {[
                  { id: 'rounded', label: 'Arredondado', r: 20 },
                  { id: 'pill', label: 'Pílula', r: 36 },
                  { id: 'square', label: 'Reto', r: 4 },
                  { id: 'scifi-cut', label: 'Sci-Fi', r: 0 }
                ].map(s => {
                  const isCur = effects.cardShape === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        setEffects((prev: any) => ({ ...prev, cardShape: s.id }));
                        if (setStudio) {
                          setStudio((prev: any) => ({
                            ...prev,
                            cardRadiusTL: s.r,
                            cardRadiusTR: s.r,
                            cardRadiusBR: s.r,
                            cardRadiusBL: s.r
                          }));
                        }
                      }}
                      className={`py-1.5 px-1 rounded-lg border text-[10px] font-bold transition-all cursor-pointer ${
                        isCur
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 ring-2 ring-blue-500/20'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 hover:border-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sliders de Raio dos Cantos e Padding */}
            {studio && setStudio && (
              <>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">Raio dos Cantos do Card</span>
                    <span className="font-mono text-blue-600">{studio.cardRadiusTL || 20}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    value={studio.cardRadiusTL || 20}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setStudio((prev: any) => ({
                        ...prev,
                        cardRadiusTL: v,
                        cardRadiusTR: v,
                        cardRadiusBR: v,
                        cardRadiusBL: v
                      }));
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">Padding Interno do Card</span>
                    <span className="font-mono text-blue-600">{studio.cardPaddingTop || 24}px</span>
                  </div>
                  <input
                    type="range"
                    min="12"
                    max="44"
                    value={studio.cardPaddingTop || 24}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setStudio((prev: any) => ({
                        ...prev,
                        cardPaddingTop: v,
                        cardPaddingRight: v,
                        cardPaddingBottom: v,
                        cardPaddingLeft: v
                      }));
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-700 dark:text-slate-300">Espaço entre Linhas (Gap)</span>
                    <span className="font-mono text-blue-600">{studio.cardGap || 14}px</span>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="32"
                    value={studio.cardGap || 14}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setStudio((prev: any) => ({ ...prev, cardGap: v }));
                    }}
                    className="w-full accent-blue-600"
                  />
                </div>
              </>
            )}

            {/* Efeitos de Vidro e Textura */}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700/60 space-y-2">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Opacidade do Vidro</span>
                  <span className="font-mono text-blue-600">{colors.glassOpacity !== undefined ? colors.glassOpacity : 90}%</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="100"
                  value={colors.glassOpacity !== undefined ? colors.glassOpacity : 90}
                  onChange={(e) => setColors((prev: any) => ({ ...prev, glassOpacity: parseInt(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Desfoque do Fundo (Blur)</span>
                  <span className="font-mono text-blue-600">{colors.glassBlur !== undefined ? colors.glassBlur : 12}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={colors.glassBlur !== undefined ? colors.glassBlur : 12}
                  onChange={(e) => setColors((prev: any) => ({ ...prev, glassBlur: parseInt(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!effects.cardGlowBorder}
                    onChange={(e) => setEffects((prev: any) => ({ ...prev, cardGlowBorder: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span>Borda com Brilho</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!effects.cardNoiseTexture}
                    onChange={(e) => setEffects((prev: any) => ({ ...prev, cardNoiseTexture: e.target.checked }))}
                    className="w-4 h-4 accent-blue-600 rounded"
                  />
                  <span>Textura de Vidro</span>
                </label>
              </div>
            </div>
          </div>

          {/* Linhas e Campos de Entrada (Inputs) */}
          {studio && setStudio && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                <span>Campos de Entrada (Linhas/Inputs)</span>
              </h4>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Altura dos Campos</span>
                  <span className="font-mono text-indigo-600">{studio.inputHeight || 44}px</span>
                </div>
                <input
                  type="range"
                  min="38"
                  max="56"
                  value={studio.inputHeight || 44}
                  onChange={(e) => setStudio((prev: any) => ({ ...prev, inputHeight: parseInt(e.target.value) }))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Arredondamento dos Campos</span>
                  <span className="font-mono text-indigo-600">{studio.inputRadius !== undefined ? studio.inputRadius : 10}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="24"
                  value={studio.inputRadius !== undefined ? studio.inputRadius : 10}
                  onChange={(e) => setStudio((prev: any) => ({ ...prev, inputRadius: parseInt(e.target.value) }))}
                  className="w-full accent-indigo-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Borda dos Campos</span>
                  <span className="font-mono text-indigo-600">{studio.inputBorderWidth || 1}px</span>
                </div>
                <input
                  type="range"
                  min="1"
                  max="3"
                  value={studio.inputBorderWidth || 1}
                  onChange={(e) => setStudio((prev: any) => ({ ...prev, inputBorderWidth: parseInt(e.target.value) }))}
                  className="w-full accent-indigo-600"
                />
              </div>
            </div>
          )}

          {/* Botões de Ação */}
          {studio && setStudio && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                <span>Botões de Ação</span>
              </h4>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Altura dos Botões</span>
                  <span className="font-mono text-amber-600">{studio.btnHeight || 46}px</span>
                </div>
                <input
                  type="range"
                  min="38"
                  max="58"
                  value={studio.btnHeight || 46}
                  onChange={(e) => setStudio((prev: any) => ({ ...prev, btnHeight: parseInt(e.target.value) }))}
                  className="w-full accent-amber-600"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Arredondamento dos Botões</span>
                  <span className="font-mono text-amber-600">{studio.btnRadiusTL !== undefined ? studio.btnRadiusTL : 12}px</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="30"
                  value={studio.btnRadiusTL !== undefined ? studio.btnRadiusTL : 12}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    setStudio((prev: any) => ({
                      ...prev,
                      btnRadiusTL: v,
                      btnRadiusTR: v,
                      btnRadiusBR: v,
                      btnRadiusBL: v
                    }));
                  }}
                  className="w-full accent-amber-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Peso da Fonte dos Botões
                </label>
                <div className="grid grid-cols-4 gap-1 text-center">
                  {[
                    { id: '500', label: 'Médio' },
                    { id: '600', label: 'Semibold' },
                    { id: '700', label: 'Bold' },
                    { id: '800', label: 'Extrabold' }
                  ].map(w => (
                    <button
                      key={w.id}
                      type="button"
                      onClick={() => setStudio((prev: any) => ({ ...prev, btnFontWeight: w.id }))}
                      className={`py-1 rounded border text-[10px] font-bold transition-all cursor-pointer ${
                        (studio.btnFontWeight || '600') === w.id
                          ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {w.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 dark:border-slate-700/60">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!effects.btnShimmer}
                    onChange={(e) => setEffects((prev: any) => ({ ...prev, btnShimmer: e.target.checked }))}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span>Efeito Shimmer (Luz)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-medium text-slate-700 dark:text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!effects.btnPulse}
                    onChange={(e) => setEffects((prev: any) => ({ ...prev, btnPulse: e.target.checked }))}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span>Pulso Suave</span>
                </label>
              </div>
            </div>
          )}

          {/* Tipografia e Título */}
          {studio && setStudio && (
            <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                <Type className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span>Tipografia & Título</span>
              </h4>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Família de Fonte Principal
                </label>
                <div className="grid grid-cols-3 gap-1 text-center">
                  {['Inter', 'Outfit', 'Poppins', 'Montserrat', 'Roboto Mono'].map(f => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setStudio((prev: any) => ({ ...prev, fontFamily: f }))}
                      className={`py-1 px-1 rounded border text-[10px] font-bold transition-all cursor-pointer ${
                        (studio.fontFamily || 'Inter') === f
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-semibold">
                  <span className="text-slate-700 dark:text-slate-300">Tamanho da Fonte do Título</span>
                  <span className="font-mono text-blue-600">{studio.titleFontSize || 22}px</span>
                </div>
                <input
                  type="range"
                  min="16"
                  max="36"
                  value={studio.titleFontSize || 22}
                  onChange={(e) => setStudio((prev: any) => ({ ...prev, titleFontSize: parseInt(e.target.value) }))}
                  className="w-full accent-blue-600"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                  Alinhamento do Título
                </label>
                <div className="grid grid-cols-3 gap-1 text-center">
                  {[
                    { id: 'left', label: 'Esquerda' },
                    { id: 'center', label: 'Centro' },
                    { id: 'right', label: 'Direita' }
                  ].map(al => (
                    <button
                      key={al.id}
                      type="button"
                      onClick={() => setStudio((prev: any) => ({ ...prev, titleAlign: al.id }))}
                      className={`py-1 rounded border text-[10px] font-bold transition-all cursor-pointer ${
                        (studio.titleAlign || 'center') === al.id
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {al.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 3. PALETTE & CONTRAST TAB */}
      {activeSubTab === 'palette' && (
        <div className="space-y-4">
          {/* WCAG Contrast Shield Card */}
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 space-y-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Auditoria de Acessibilidade & Contraste WCAG
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Botão de Login</span>
                <span className="font-bold">{buttonContrast}:1</span>
                <span className={`text-[9px] font-extrabold ml-1.5 px-1 py-0.5 rounded ${
                  buttonContrast >= 4.5 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {buttonContrast >= 4.5 ? 'WCAG AA OK' : 'Atenção'}
                </span>
              </div>

              <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <span className="text-[10px] text-slate-500 block">Texto no Card</span>
                <span className="font-bold">{cardTextContrast}:1</span>
                <span className={`text-[9px] font-extrabold ml-1.5 px-1 py-0.5 rounded ${
                  cardTextContrast >= 4.5 ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {cardTextContrast >= 4.5 ? 'WCAG AA OK' : 'Atenção'}
                </span>
              </div>
            </div>
          </div>

          {/* Color pickers */}
          <div className="space-y-3">
            {[
              { key: 'brand', label: 'Cor Principal da Marca' },
              { key: 'bg', label: 'Fundo da Tela' },
              { key: 'cardBg', label: 'Fundo do Card de Login' },
              { key: 'ink', label: 'Cor dos Textos Principais' },
              { key: 'blue', label: 'Botão Conectar (Login)' },
              { key: 'loginButtonText', label: 'Texto do Botão Conectar' },
              { key: 'green', label: 'Botão de Cadastro (Leads)' },
              { key: 'registerButtonText', label: 'Texto do Botão de Cadastro' },
            ].map(item => (
              <div key={item.key} className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  {item.label}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={colors[item.key] || '#ffffff'}
                    onChange={(e) => setColors((prev: any) => ({ ...prev, [item.key]: e.target.value }))}
                    className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-700 cursor-pointer p-0.5 bg-transparent"
                  />
                  <input
                    type="text"
                    value={colors[item.key] || ''}
                    onChange={(e) => setColors((prev: any) => ({ ...prev, [item.key]: e.target.value }))}
                    className="w-20 text-[11px] font-mono px-2 py-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 3. LOGO TAB */}
      {activeSubTab === 'logo' && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center overflow-hidden border border-slate-300 dark:border-slate-700 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoPreviewUrl} alt="Logo" className="w-full h-full object-contain p-1" />
            </div>
            <div className="flex-1">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Logotipo Atual</h4>
              <p className="text-[11px] text-slate-500 mb-2">Suporte a PNG, JPG ou SVG com fundo transparente</p>
              {onOpenMediaPicker ? (
                <button
                  type="button"
                  onClick={() => onOpenMediaPicker({ type: 'logo', title: 'Selecionar Logotipo da Galeria' })}
                  className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Escolher da Galeria / Enviar</span>
                </button>
              ) : (
                <label className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white cursor-pointer shadow-xs">
                  <Upload className="w-3.5 h-3.5" />
                  <span>{logoUploadLoading ? 'Enviando...' : 'Substituir Logo'}</span>
                  <input type="file" accept="image/*" onChange={onLogoUpload} className="hidden" disabled={logoUploadLoading} />
                </label>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-semibold">
                <span>Tamanho da Logo</span>
                <span>{brand.logoSize || 100}px</span>
              </div>
              <input
                type="range"
                min="40"
                max="220"
                value={brand.logoSize || 100}
                onChange={(e) => setBrand(prev => ({ ...prev, logoSize: parseInt(e.target.value) }))}
                className="w-full accent-blue-600"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">Formato do Container</label>
              <div className="grid grid-cols-3 gap-2">
                {['rounded', 'circle', 'square'].map((shape) => (
                  <button
                    key={shape}
                    type="button"
                    onClick={() => setBrand(prev => ({ ...prev, logoShape: shape as any }))}
                    className={`text-xs py-1.5 px-2 rounded-lg border font-medium capitalize cursor-pointer ${
                      brand.logoShape === shape
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 font-bold'
                        : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {shape}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. BACKGROUND TAB */}
      {activeSubTab === 'background' && (
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">Mídia de Fundo Personalizada</h4>
              {bg.type !== 'default' && bg.url && (
                <div className="flex items-center gap-2">
                  {onOpenMediaPicker && (
                    <button
                      type="button"
                      onClick={() => onOpenMediaPicker({ type: 'bg', title: 'Trocar Plano de Fundo da Galeria' })}
                      className="text-[10px] text-blue-600 hover:text-blue-700 font-bold cursor-pointer"
                    >
                      Trocar Fundo
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onBgRemove}
                    className="text-[10px] text-red-600 hover:text-red-700 font-bold cursor-pointer"
                  >
                    Remover Mídia
                  </button>
                </div>
              )}
            </div>

            {onOpenMediaPicker ? (
              <div 
                onClick={() => onOpenMediaPicker({ type: 'bg', title: 'Selecionar Plano de Fundo da Galeria' })}
                className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl cursor-pointer bg-white dark:bg-slate-900 transition-all text-center group"
              >
                <FolderOpen className="w-6 h-6 text-blue-600 mb-1 group-hover:scale-110 transition-transform" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Escolher da Galeria ou Enviar Novo Fundo
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Fotos até 10MB ou vídeos MP4 até 35MB
                </span>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 rounded-xl cursor-pointer bg-white dark:bg-slate-900 transition-all text-center">
                <Upload className="w-5 h-5 text-blue-600 mb-1" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  {bgUploadLoading ? 'Processando envio...' : 'Enviar Imagem ou Vídeo'}
                </span>
                <span className="text-[10px] text-slate-500 mt-0.5">
                  Fotos até 10MB ou vídeos MP4 até 35MB
                </span>
                <input
                  type="file"
                  accept="image/*,video/mp4,video/webm"
                  onChange={onBgUpload}
                  disabled={bgUploadLoading}
                  className="hidden"
                />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300">
              Efeitos de Fundo Dinâmicos (Nicho)
            </h4>
            <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
              {nicheEffects.map(ef => {
                const isSelected = effects.bgEffect === ef.id;
                return (
                  <button
                    key={ef.id}
                    type="button"
                    onClick={() => setEffects((prev: any) => ({ ...prev, bgEffect: ef.id }))}
                    className={`p-2 rounded-xl border text-left cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-950/60 text-blue-800 dark:text-blue-200 ring-2 ring-blue-500/20'
                        : 'border-slate-200 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-800/60 text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-sm">{ef.icon}</span>
                      <span className="text-[11px] font-bold truncate">{ef.name}</span>
                    </div>
                    <span className="text-[9px] text-slate-500 dark:text-slate-400 block truncate">{ef.niche}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
