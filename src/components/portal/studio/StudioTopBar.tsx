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
}: StudioTopBarProps) {
  return (
    <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-4 py-2 flex flex-col md:flex-row md:items-center md:justify-between gap-2 md:gap-3 shadow-xs select-none min-w-0 w-full overflow-hidden">
      {/* ── 1. Top Row no Mobile / Left no Desktop: Marca, Status & Ações Rápidas no Mobile ── */}
      <div className="flex items-center justify-between w-full md:w-auto shrink-0 gap-2">
        {/* Marca e Status */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-cyan-500 flex items-center justify-center text-white font-black text-sm shadow-xs shrink-0">
            <Wifi className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate max-w-[100px] sm:max-w-[150px] xl:max-w-[200px]">
                {businessName || 'Hotspot Portal'}
              </span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${
                isRouterConnected 
                  ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                  : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${isRouterConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
                <span className="hidden xl:inline">{isRouterConnected ? 'MikroTik Conectado' : 'Offline / Local'}</span>
                <span className="xl:hidden">{isRouterConnected ? 'Online' : 'Local'}</span>
              </span>
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate hidden 2xl:block">
              MikroStudio 2.0 • Editor de Hotspot RouterOS
            </p>
          </div>
        </div>

        {/* Botões de Histórico (Visíveis em Desktop lg:) */}
        <div className="hidden lg:flex items-center border-l border-slate-200 dark:border-slate-800 pl-2 gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onUndo}
            disabled={!canUndo}
            title="Desfazer alteração de cor/estilo (Ctrl+Z)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Undo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onRedo}
            disabled={!canRedo}
            title="Refazer alteração (Ctrl+Y)"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-all cursor-pointer disabled:cursor-not-allowed"
          >
            <Redo2 className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onReplayAnimation}
            title="Repetir Animações de Entrada"
            className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer ml-0.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Ações no Mobile (Visíveis no topo em telas < md) */}
        <div className="flex md:hidden items-center gap-1.5 shrink-0">
          {onOpenMediaLibrary && (
            <button
              type="button"
              onClick={onOpenMediaLibrary}
              title="Gerenciador de Mídias e Limpeza da VPS"
              className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shadow-xs"
            >
              <FolderOpen className="w-3.5 h-3.5 text-blue-500" />
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            title="Salvar alterações"
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
            <span>Salvar</span>
          </button>
          <button
            type="button"
            onClick={onDeployOpen}
            disabled={deploying}
            title="Deploy no MikroTik"
            className="flex items-center gap-1 text-xs font-bold px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-cyan-600 text-white cursor-pointer shadow-xs disabled:opacity-50"
          >
            <Send className={`w-3.5 h-3.5 ${deploying ? 'animate-spin' : ''}`} />
            <span>Deploy</span>
          </button>
        </div>
      </div>

      {/* ── 2. Row 2 no Mobile / Center no Desktop: Seletor de Preset & Alternador de Telas ── */}
      <div className="flex items-center justify-between md:justify-center gap-2 w-full md:w-auto shrink min-w-0 overflow-hidden">
        {/* Preset / Template Selector */}
        {setTemplate && availableTemplates && availableTemplates.length > 0 && (
          <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/60 px-2 py-1 rounded-xl border border-slate-200 dark:border-slate-700/80 shadow-xs shrink-0 max-w-[48%] sm:max-w-none">
            <LayoutTemplate className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />
            <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300 hidden sm:inline">
              Preset:
            </span>
            <select
              value={template}
              onChange={(e) => setTemplate(e.target.value)}
              className="bg-white dark:bg-slate-900 text-xs font-bold text-slate-900 dark:text-slate-100 rounded-lg px-1.5 py-1 border border-slate-200 dark:border-slate-700 outline-none cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 transition-all shadow-xs max-w-[110px] sm:max-w-[160px]"
            >
              {availableTemplates.map(t => (
                <option key={t} value={t} className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-bold">
                  {t === 'default' ? '⚡ Padrão' : t === 'FAP' ? '🎓 FAP' : t}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Screen Switcher (Login vs Cadastro / Leads) */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
          <button
            type="button"
            onClick={() => setPreviewScreen('login')}
            className={`flex items-center gap-1 text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
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
            className={`flex items-center gap-1 text-xs font-semibold px-2 sm:px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
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

        {/* Viewport switch (Desktop 2xl:flex) */}
        <div className="hidden 2xl:flex items-center bg-slate-100 dark:bg-slate-800/80 p-0.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80 shrink-0">
          <button
            type="button"
            onClick={() => setViewportMode('mobile')}
            title="Visualização Mobile (375px)"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewportMode === 'mobile'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Smartphone className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('tablet')}
            title="Visualização Tablet (520px)"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewportMode === 'tablet'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Tablet className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => setViewportMode('desktop')}
            title="Visualização Desktop (800px)"
            className={`p-1.5 rounded-lg transition-all cursor-pointer ${
              viewportMode === 'desktop'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <Monitor className="w-4 h-4" />
          </button>
        </div>

        {/* Zoom Controls (Desktop 2xl:flex) */}
        <div className="hidden 2xl:flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 px-2 py-1 rounded-xl border border-slate-200/80 dark:border-slate-700/80 text-xs shrink-0">
          <button
            type="button"
            onClick={() => setPreviewZoom(prev => Math.max(60, prev - 10))}
            className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
            title="Reduzir Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 w-9 text-center">
            {previewZoom}%
          </span>
          <button
            type="button"
            onClick={() => setPreviewZoom(prev => Math.min(130, prev + 10))}
            className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white cursor-pointer"
            title="Aumentar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 3. Desktop Actions (Visíveis em telas md:) ── */}
      <div className="hidden md:flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onOpenMediaLibrary && (
          <button
            type="button"
            onClick={onOpenMediaLibrary}
            title="Gerenciador de Mídias, Barra de Limite e Limpeza da VPS"
            className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs shrink-0"
          >
            <FolderOpen className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="hidden xl:inline">Mídias</span>
          </button>
        )}

        <button
          type="button"
          onClick={onDownloadZip}
          title="Baixar pacote ZIP completo com arquivos do Hotspot"
          className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all cursor-pointer shadow-xs shrink-0"
        >
          <Download className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="hidden 2xl:inline">Baixar ZIP</span>
        </button>

        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          title="Salvar alterações no banco de dados local"
          className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border border-blue-200 dark:border-blue-900/60 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-all cursor-pointer shadow-xs disabled:opacity-50 shrink-0"
        >
          <Save className={`w-3.5 h-3.5 ${saving ? 'animate-spin' : ''}`} />
          <span>{saving ? 'Salvando...' : 'Salvar'}</span>
        </button>

        <button
          type="button"
          onClick={onDeployOpen}
          disabled={deploying}
          title="Enviar e publicar portal diretamente no MikroTik via FTP"
          className="flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-md shadow-blue-500/20 hover:shadow-blue-500/30 transition-all cursor-pointer disabled:opacity-50 shrink-0"
        >
          <Send className={`w-3.5 h-3.5 ${deploying ? 'animate-spin' : ''}`} />
          <span>{deploying ? 'Enviando...' : 'Deploy no Roteador'}</span>
        </button>
      </div>
    </header>
  );
}
