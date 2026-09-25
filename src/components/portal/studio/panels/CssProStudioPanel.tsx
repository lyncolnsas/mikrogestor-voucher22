"use client";

import React from 'react';
import { Code2, Terminal } from 'lucide-react';

interface CssProStudioPanelProps {
  customCode: { customCss: string };
  setCustomCode: React.Dispatch<React.SetStateAction<{ customCss: string }>>;
}

export default function CssProStudioPanel({
  customCode,
  setCustomCode,
}: CssProStudioPanelProps) {
  const handleCopySnippet = (snippet: string) => {
    navigator.clipboard.writeText(snippet);
  };

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-5 select-none">
      <div>
        <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
          <Code2 className="w-4 h-4 text-purple-600" />
          <span>Editor de CSS Pro & Regras Customizadas</span>
        </h3>
        <p className="text-xs text-slate-500 mt-0.5">
          Injete código CSS diretamente no template captive do MikroTik RouterOS.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
          <span>Código CSS Inline</span>
          <span className="text-[10px] text-slate-400 font-mono">Injetado em &lt;style&gt;</span>
        </label>
        <textarea
          rows={12}
          value={customCode?.customCss || ''}
          onChange={(e) => setCustomCode({ customCss: e.target.value })}
          placeholder={`/* Exemplo de CSS personalizado: */\n.card {\n  box-shadow: 0 20px 40px rgba(0,0,0,0.4) !important;\n}\n#btnLogin {\n  text-transform: uppercase !important;\n}`}
          className="w-full font-mono text-xs p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-950 text-emerald-400 leading-relaxed focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
          spellCheck={false}
        />
      </div>

      {/* CSS Cheat Sheet */}
      <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
        <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
          <Terminal className="w-3.5 h-3.5 text-slate-500" />
          <span>Seletores Principais do Portal</span>
        </h4>

        <div className="space-y-1.5 text-[11px] font-mono">
          {[
            { selector: '#card-main', desc: 'Card central do formulário de login' },
            { selector: '#btnLogin', desc: 'Botão principal de conexão' },
            { selector: '#btnSignup', desc: 'Botão secundário de cadastro de leads' },
            { selector: '.form-control', desc: 'Inputs de texto e senha' },
            { selector: '#trial-container', desc: 'Bloco de acesso de teste (Trial)' },
          ].map((item) => (
            <div
              key={item.selector}
              onClick={() => handleCopySnippet(item.selector)}
              className="flex items-center justify-between p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 cursor-pointer hover:border-purple-500 transition-colors"
            >
              <span className="text-purple-600 dark:text-purple-400 font-bold">{item.selector}</span>
              <span className="text-slate-500 text-[10px] font-sans">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
