"use client";

import React from 'react';
import { 
  Send, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Download
} from 'lucide-react';

interface DeployStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  ftpPort: string;
  setFtpPort: (p: string) => void;
  onDeploy: (e: React.FormEvent) => void;
  deploying: boolean;
  deployModalResult: { type: 'success' | 'error'; message: string } | null;
  onDownloadZip: () => void;
}

export default function DeployStudioModal({
  isOpen,
  onClose,
  ftpPort,
  setFtpPort,
  onDeploy,
  deploying,
  deployModalResult,
  onDownloadZip,
}: DeployStudioModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-300">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Deploy no Roteador MikroTik
              </h3>
              <p className="text-xs text-slate-500">
                Transfere os arquivos HTML/CSS compilados via FTP/API.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Deploy Form */}
        <form onSubmit={onDeploy} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs">
            <div className="flex items-center justify-between font-semibold">
              <span className="text-slate-600 dark:text-slate-400">Porta do Serviço FTP:</span>
              <input
                type="number"
                value={ftpPort}
                onChange={(e) => setFtpPort(e.target.value)}
                className="w-20 text-xs font-mono px-2 py-1 rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-center text-slate-900 dark:text-slate-100"
              />
            </div>
            <p className="text-[11px] text-slate-500">
              Certifique-se de que o serviço FTP está ativado em <code className="font-mono text-blue-600">IP &gt; Services</code> no seu MikroTik.
            </p>
          </div>

          {/* Feedback message */}
          {deployModalResult && (
            <div className={`p-3 rounded-xl border text-xs font-semibold flex items-start gap-2 ${
              deployModalResult.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
                : 'bg-red-50 dark:bg-red-950/40 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
            }`}>
              {deployModalResult.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              )}
              <span>{deployModalResult.message}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              type="button"
              onClick={onDownloadZip}
              className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer flex items-center justify-center gap-1.5 shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar ZIP Manual</span>
            </button>

            <button
              type="submit"
              disabled={deploying}
              className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-xs font-bold cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5 shadow-md shadow-blue-500/20"
            >
              <Send className={`w-3.5 h-3.5 ${deploying ? 'animate-spin' : ''}`} />
              <span>{deploying ? 'Enviando ao Roteador...' : 'Confirmar e Enviar'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
