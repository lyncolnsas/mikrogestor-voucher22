"use client";

import React from 'react';
import { 
  Smartphone, 
  Tablet, 
  Monitor, 
  RotateCcw, 
  Undo2, 
  Redo2, 
  Save, 
  Download, 
  Send, 
  ZoomIn, 
  ZoomOut, 
  Wifi, 
  Lock,
  UserCheck,
  LayoutTemplate,
  FolderOpen
} from 'lucide-react';

interface StudioTopBarProps {
  businessName: string;
  previewScreen: 'login' | 'register';
  setPreviewScreen: (s: 'login' | 'register') => void;
  viewportMode: 'mobile' | 'tablet' | 'desktop';
  setViewportMode: (v: 'mobile' | 'tablet' | 'desktop') => void;
  previewZoom: number;
  setPreviewZoom: React.Dispatch<React.SetStateAction<number>>;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onSave: () => void;
  saving: boolean;
  onDeployOpen: () => void;
  deploying: boolean;
  onDownloadZip: () => void;
  isRouterConnected: boolean;
  onReplayAnimation: () => void;
  template?: string;
  setTemplate?: (t: string) => void;
  availableTemplates?: string[];
  onOpenMediaLibrary?: () => void;
  autoSaveStatus?: 'idle' | 'saving' | 'saved' | 'error';
  lastSavedAt?: string;
}

export default function StudioTopBar({
  businessName,
  previewScreen,
  setPreviewScreen,
  viewportMode,
  setViewportMode,
  previewZoom,
  setPreviewZoom,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onSave,
  saving,
  onDeployOpen,
  deploying,
  onDownloadZip,
  isRouterConnected,
  onReplayAnimation,
  template = 'default',
  setTemplate,
  availableTemplates = ['default', 'FAP'],
  onOpenMediaLibrary,
  autoSaveStatus = 'idle',
  lastSavedAt = '',
}: StudioTopBarProps) {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 shadow-xs select-none min-w-0 w-full overflow-hidden">
      
      {/* ── 1. Esquerda: Marca e Histórico ── */}
      <div className="flex items-center justify-between xl:justify-start gap-4 shrink-0 min-w-0 w-full xl:w-auto overflow-hidden">
        
        {/* Marca e Status */}
        <div className="flex items-center gap-2.5 min-w-0 shrink">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-sm shadow-xs shrink-0">
            <Wifi className="w-4 h-4" />
          </div>
          <div className="min-w-0 shrink flex flex-col justify-center">
            <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
              <span className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate max-w-[120px] sm:max-w-[180px] 2xl:max-w-[250px]">
                {businessName || 'Hotspot Portal'}
              </span>
              <span className={`inline-flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${
                isRouterConnected 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isRouterConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="hidden sm:inline">{isRouterConnected ? 'MikroTik Conectado' : 'Offline / Local'}</span>
                <span className="sm:hidden">{isRouterConnected ? 'Conectado' : 'Local'}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate hidden md:block">
              MikroStudio 2.0 • Editor de Hotspot RouterOS
            </p>
          </div>
        </div>

        {/* Botões de Histórico (Undo/Redo) - Ocultos no mobile estreito */}
        <div className="hidden sm:flex items-center border-l border-slate-200 dark:border-slate-800 pl-2 gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Desfazer (Ctrl+Z)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Refazer (Ctrl+Y)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onReplayAnimation}
            title="Repetir Animações"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer ml-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

      </div>

      {/* ── 2. Centro: Telas, Zoom e Presets ── */}
      <div className="flex items-center justify-start xl:justify-center flex-wrap xl:flex-nowrap gap-2 min-w-0 w-full xl:w-auto shrink">
        
        {/* Seletor de Preset */}
        {setTemplate && availableTemplates && availableTemplates.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs shrink-0">
            <LayoutTemplate className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hidden md:inline">
              Preset:
            </span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 rounded-lg px-1.5 py-1 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-xs w-[100px] sm:w-auto"
            >
              {availableTemplates.map(t => (
                <option key={t} value={t} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                  {t === 'default' ? '⚡ Padrão' : t === 'FAP' ? '🎓 FAP' : t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Screen Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewScreen('login')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              previewScreen === 'login'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Login</span>
          </button>
          <button
            type="button"
            onClick={() => setPreviewScreen('register')}
            className={`flex items-center gap-1.5 text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              previewScreen === 'register'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs font-bold'
                : 'text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Cadastro / Leads</span>
            <span className="sm:hidden">Cadastro</span>
          </button>
        </div>

        {/* Viewport switch */}
        <div className="hidden lg:flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
          <button
            type="button"
            onClick={() => setViewportMode('mobile')}
            title="Mobile (375px)"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewportMode === 'mobile' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('tablet')}
            title="Tablet (520px)"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewportMode === 'tablet' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('desktop')}
            title="Desktop (800px)"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${viewportMode === 'desktop' ? 'bg-white dark:bg-slate-900 text-blue-600 shadow-xs' : 'text-slate-600 dark:text-slate-300'}`}
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls */}
        <div className="hidden md:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0">
          <button onClick={() => setPreviewZoom(prev => Math.max(60, prev - 10))} className="text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer p-0.5">
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-9 text-center">{previewZoom}%</span>
          <button onClick={() => setPreviewZoom(prev => Math.min(130, prev + 10))} className="text-slate-600 hover:text-slate-900 dark:text-slate-300 cursor-pointer p-0.5">
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 3. Direita: Ações Principais (Salvar, Deploy, etc) ── */}
      <div className="flex items-center justify-between xl:justify-end gap-2 w-full xl:w-auto shrink-0 mt-1 xl:mt-0">
        
        <div className="flex items-center gap-2">
          {onOpenMediaLibrary && (
            <button
              type="button"
              onClick={onOpenMediaLibrary}
              title="Gerenciador de Mídias e VPS"
              className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-xs shrink-0"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
              <span className="hidden md:inline">Mídias</span>
            </button>
          )}

          <button
            type="button"
            onClick={onDownloadZip}
            title="Baixar pacote ZIP do Hotspot"
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 transition-all cursor-pointer shadow-xs shrink-0"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden lg:inline">Baixar ZIP</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          {autoSaveStatus !== 'idle' && (
            <div className={`hidden 2xl:flex items-center gap-1.5 text-[10px] font-bold px-2 py-1.5 rounded-xl border shrink-0 ${
              autoSaveStatus === 'saving' ? 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/30' : 
              autoSaveStatus === 'saved' ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/30' : 
              'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-900/30'
            }`}>
              {autoSaveStatus === 'saving' && <><Save className="w-3 h-3 animate-spin"/><span>Salvando...</span></>}
              {autoSaveStatus === 'saved' && <><div className="w-1.5 h-1.5 rounded-full bg-emerald-500"/><span>Salvo</span></>}
              {autoSaveStatus === 'error' && <><div className="w-1.5 h-1.5 rounded-full bg-rose-500"/><span>Erro</span></>}
            </div>
          )}

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-slate-800 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
          >
            <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{saving ? 'Salvando...' : 'Salvar'}</span>
            <span className="sm:hidden">Salvar</span>
          </button>

          <button
            type="button"
            onClick={onDeployOpen}
            disabled={deploying}
            className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <Send className={`w-3.5 h-3.5 ${deploying ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{deploying ? 'Enviando...' : 'Deploy no Roteador'}</span>
            <span className="sm:hidden">Deploy</span>
          </button>
        </div>

      </div>
    </header>
  );
}
