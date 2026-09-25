"use client";

import React from 'react';
import {
  Palette,
  KeyRound,
  FileSpreadsheet,
  Megaphone,
  Globe,
  Code2,
  Cpu,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export type StudioTab = 
  | 'branding' 
  | 'auth_methods' 
  | 'leads_form' 
  | 'ads' 
  | 'walled_garden' 
  | 'css_pro' 
  | 'provisioning';

interface StudioNavRailProps {
  activeTab: StudioTab;
  setActiveTab: (tab: StudioTab) => void;
  walledGardenAlertCount?: number;
  hasRegistrationEnabled?: boolean;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export default function StudioNavRail({
  activeTab,
  setActiveTab,
  walledGardenAlertCount = 0,
  hasRegistrationEnabled = true,
  isCollapsed = false,
  onToggleCollapse,
}: StudioNavRailProps) {
  const tabs = [
    {
      id: 'branding' as StudioTab,
      label: 'Identidade & Estilo',
      description: 'Logo, paleta de cores, tipografia e fundos',
      icon: Palette,
      badge: null
    },
    {
      id: 'auth_methods' as StudioTab,
      label: 'Métodos de Login',
      description: 'Voucher, usuário/senha, 1-clique e PIX',
      icon: KeyRound,
      badge: null
    },
    {
      id: 'leads_form' as StudioTab,
      label: 'Captura de Leads',
      description: 'Campos do formulário e termos LGPD',
      icon: FileSpreadsheet,
      badge: hasRegistrationEnabled ? 'Ativo' : 'Desativado'
    },
    {
      id: 'ads' as StudioTab,
      label: 'Banners & Mídia',
      description: 'Anúncios patrocinados e carrossel',
      icon: Megaphone,
      badge: null
    },
    {
      id: 'walled_garden' as StudioTab,
      label: 'Walled Garden',
      description: 'Auditor de domínios e liberação MikroTik',
      icon: Globe,
      badge: walledGardenAlertCount > 0 ? `${walledGardenAlertCount} pendente` : null,
      badgeColor: walledGardenAlertCount > 0 ? 'amber' : 'gray'
    },
    {
      id: 'css_pro' as StudioTab,
      label: 'CSS & Código Pro',
      description: 'Injeção avançada de CSS e scripts',
      icon: Code2,
      badge: null
    },
    {
      id: 'provisioning' as StudioTab,
      label: 'Provisionamento',
      description: 'Wizard de 4 etapas do roteador',
      icon: Cpu,
      badge: null
    }
  ];

  return (
    <nav className={`${isCollapsed ? 'w-16 p-2' : 'w-60 xl:w-64 p-3'} bg-slate-50 dark:bg-slate-900/70 border-r border-slate-200 dark:border-slate-800 flex flex-col gap-1 shrink-0 select-none overflow-y-auto transition-all duration-200`}>
      {/* Top Header & Toggle Button */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center mb-2' : 'justify-between px-2 py-1.5 mb-1'}`}>
        {!isCollapsed && (
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate">
            CONFIGURAÇÃO
          </span>
        )}
        {onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            title={isCollapsed ? 'Expandir barra lateral' : 'Recolher barra lateral'}
            className="p-1 rounded-lg text-slate-500 hover:text-slate-900 dark:hover:text-slate-100 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            title={isCollapsed ? `${tab.label} — ${tab.description}` : undefined}
            className={`flex items-center ${isCollapsed ? 'justify-center p-2.5' : 'items-start gap-3 p-2.5'} rounded-xl text-left transition-all cursor-pointer group ${
              isActive
                ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20 font-medium'
                : 'text-slate-800 dark:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/80'
            }`}
          >
            <div className={`p-2 rounded-lg shrink-0 transition-colors ${
              isActive 
                ? 'bg-blue-700/80 text-white' 
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 group-hover:text-blue-600 dark:group-hover:text-blue-400 border border-slate-200/60 dark:border-slate-700/60'
            }`}>
              <Icon className="w-4 h-4" />
            </div>

            {!isCollapsed && (
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1">
                  <span className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-slate-900 dark:text-slate-100'}`}>
                    {tab.label}
                  </span>
                  {tab.badge && (
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : tab.badgeColor === 'amber'
                          ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}>
                      {tab.badge}
                    </span>
                  )}
                </div>
                <p className={`text-[11px] truncate mt-0.5 ${isActive ? 'text-blue-100' : 'text-slate-600 dark:text-slate-300'}`}>
                  {tab.description}
                </p>
              </div>
            )}
          </button>
        );
      })}

      {!isCollapsed && (
        <div className="mt-auto pt-4 px-2">
          <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/40 text-[11px] text-blue-900 dark:text-blue-200 leading-relaxed">
            <p className="font-bold flex items-center gap-1.5 mb-0.5">
              <span>💡 Dica MikroStudio</span>
            </p>
            <p className="text-slate-600 dark:text-slate-300">
              Qualquer alteração feita é sincronizada imediatamente no preview ao lado em tempo real.
            </p>
          </div>
        </div>
      )}
    </nav>
  );
}
