"use client";

import React from 'react';
import { 
  FileSpreadsheet, 
  ShieldCheck, 
  Type, 
  User, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard, 
  Lock 
} from 'lucide-react';
import { FieldsConfig } from '@/components/portal/RegistrationInspector';

interface LeadsFieldsStudioPanelProps {
  fields: FieldsConfig;
  setFields?: React.Dispatch<React.SetStateAction<FieldsConfig>>;
  handleFieldToggle: (key: keyof FieldsConfig) => void;
  handleFieldLabelChange: (val: string) => void;
  enabled: boolean;
  setEnabled: (val: boolean) => void;
  registerTitle: string;
  setRegisterTitle: (val: string) => void;
  registerSubtitle: string;
  setRegisterSubtitle: (val: string) => void;
  registerSubmitText: string;
  setRegisterSubmitText: (val: string) => void;
  termsText: string;
  setTermsText: (val: string) => void;
}

export default function LeadsFieldsStudioPanel({
  fields,
  handleFieldToggle,
  handleFieldLabelChange,
  enabled,
  setEnabled,
  registerTitle,
  setRegisterTitle,
  registerSubtitle,
  setRegisterSubtitle,
  registerSubmitText,
  setRegisterSubmitText,
  termsText,
  setTermsText,
}: LeadsFieldsStudioPanelProps) {

  const leadFieldsList = [
    { key: 'name', label: 'Nome Completo', icon: User },
    { key: 'phone', label: 'WhatsApp / Telefone', icon: Phone },
    { key: 'email', label: 'E-mail', icon: Mail },
    { key: 'cpf', label: 'CPF', icon: CreditCard },
    { key: 'birthDate', label: 'Data de Nascimento', icon: Calendar },
    { key: 'gender', label: 'Gênero', icon: User },
    { key: 'password', label: 'Senha do Usuário', icon: Lock },
    { key: 'customField', label: 'Pergunta Customizada', icon: Type },
    { key: 'optInCourses', label: 'Consentimento LGPD / Cursos', icon: ShieldCheck },
  ];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
            <span>Formulário de Captação de Leads</span>
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Defina quais dados os clientes devem preencher para liberar o Wi-Fi.
          </p>
        </div>

        <label className="flex items-center gap-2 text-xs font-bold cursor-pointer text-slate-800 dark:text-slate-200">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="w-4 h-4 accent-emerald-600"
          />
          <span>Ativar Cadastro</span>
        </label>
      </div>

      {!enabled && (
        <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-200">
          ⚠️ O formulário de auto-cadastro está desativado no momento. Os clientes farão login apenas por voucher ou usuário/senha.
        </div>
      )}

      {/* Field Toggles List */}
      <div className="space-y-2.5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Campos Disponíveis
        </h4>

        {leadFieldsList.map((item) => {
          const enabledKey = `${item.key}Enabled` as keyof FieldsConfig;
          const requiredKey = `${item.key}Required` as keyof FieldsConfig;
          const isEnabled = Boolean(fields[enabledKey]);
          const isRequired = Boolean(fields[requiredKey]);
          const Icon = item.icon;

          return (
            <div
              key={item.key}
              className={`p-3 rounded-xl border transition-all ${
                isEnabled
                  ? 'border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900'
                  : 'border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 opacity-70'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`p-1.5 rounded-lg ${isEnabled ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                    {item.label}
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isEnabled}
                      onChange={() => handleFieldToggle(enabledKey)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span>Ativo</span>
                  </label>

                  {isEnabled && item.key !== 'optInCourses' && (
                    <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isRequired}
                        onChange={() => handleFieldToggle(requiredKey)}
                        className="w-4 h-4 accent-amber-600"
                      />
                      <span>Obrigatório</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Custom field label input */}
              {item.key === 'customField' && isEnabled && (
                <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-slate-800">
                  <label className="text-[11px] font-semibold text-slate-600 dark:text-slate-400 block mb-1">
                    Pergunta / Rótulo Customizado:
                  </label>
                  <input
                    type="text"
                    value={fields.customFieldLabel || ''}
                    onChange={(e) => handleFieldLabelChange(e.target.value)}
                    placeholder="ex: Como você conheceu nossa loja?"
                    className="w-full text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Screen Title & Subtitle */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
          Textos da Tela de Cadastro
        </h4>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Título do Cadastro
          </label>
          <input
            type="text"
            value={registerTitle}
            onChange={(e) => setRegisterTitle(e.target.value)}
            placeholder="Wi-Fi Grátis"
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Subtítulo Explicativo
          </label>
          <input
            type="text"
            value={registerSubtitle}
            onChange={(e) => setRegisterSubtitle(e.target.value)}
            placeholder="Cadastre-se abaixo para liberar o acesso à internet"
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Botão de Envio do Cadastro
          </label>
          <input
            type="text"
            value={registerSubmitText}
            onChange={(e) => setRegisterSubmitText(e.target.value)}
            placeholder="Cadastrar e Conectar"
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Texto de Termos e Privacidade (LGPD)
          </label>
          <textarea
            rows={3}
            value={termsText}
            onChange={(e) => setTermsText(e.target.value)}
            placeholder="Ao se cadastrar, você concorda com nossos Termos de Uso..."
            className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
          />
        </div>
      </div>
    </div>
  );
}
