"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  X, 
  Upload, 
  Trash2, 
  Check, 
  Search, 
  HardDrive, 
  Film, 
  Image as ImageIcon, 
  RefreshCw, 
  CheckCircle2,
  FolderOpen
} from 'lucide-react';

export interface MediaFile {
  name: string;
  url: string;
  posterUrl?: string | null;
  size: number;
  sizeFormatted: string;
  type: 'image' | 'video';
  category: 'banner' | 'bg' | 'logo' | 'avatar' | 'other';
  createdAt: string;
  isUsed: boolean;
  usedInTemplates: string[];
}

export interface MediaStats {
  totalFiles: number;
  maxFiles: number;
  percentFiles: number;
  totalBytes: number;
  totalFormatted: string;
  maxBytes: number;
  maxFormatted: string;
  freeBytes: number;
  freeFormatted: string;
  percentUsed: number;
  isNearLimit: boolean;
}

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia?: (file: MediaFile) => void;
  targetTitle?: string;
  targetType?: 'ad_single' | 'ad_slot' | 'bg' | 'logo' | 'general';
  template?: string;
}

export default function MediaLibraryModal({
  isOpen,
  onClose,
  onSelectMedia,
  targetTitle = 'Gerenciador de Mídias',
  targetType = 'general',
  template = 'default'
}: MediaLibraryModalProps) {
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [stats, setStats] = useState<MediaStats>({
    totalFiles: 0,
    maxFiles: 50,
    percentFiles: 0,
    totalBytes: 0,
    totalFormatted: '0 B',
    maxBytes: 104857600,
    maxFormatted: '100 MB',
    freeBytes: 104857600,
    freeFormatted: '100 MB',
    percentUsed: 0,
    isNearLimit: false
  });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'banner' | 'bg' | 'logo' | 'video'>('all');
  const [selectedFileName, setSelectedFileName] = useState<string | null>(null);
  const [deletingFileName, setDeletingFileName] = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);
  const [isClearingAll, setIsClearingAll] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const fetchMedia = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/portal/upload');
      const data = await res.json();
      if (data.success) {
        setFiles(data.files || []);
        if (data.stats) setStats(data.stats);
      }
    } catch (err) {
      console.error('Erro ao carregar mídias:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => {
      setSelectedFileName(null);
      setConfirmClearAll(false);
      fetchMedia();
    });
    return () => cancelAnimationFrame(frame);
  }, [isOpen]);

  const handleUploadFile = async (file: File) => {
    if (!file) return;
    setUploading(true);

    try {
      const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|mov)$/i.test(file.name);
      const typeParam = targetType === 'bg' ? 'bg' : (targetType === 'logo' ? 'logo' : 'ad');
      
      const res = await fetch(`/api/portal/upload?type=${typeParam}&template=${template}&filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file
      });
      const data = await res.json();
      if (data.success) {
        showToast('Mídia enviada com sucesso para a VPS!');
        await fetchMedia();

        // Se houver fileUrl retornada e estiver selecionando para um alvo específico
        if (data.fileUrl && onSelectMedia && targetType !== 'general') {
          const newFile: MediaFile = {
            name: file.name,
            url: data.fileUrl,
            size: file.size,
            sizeFormatted: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
            type: isVideo ? 'video' : 'image',
            category: typeParam === 'bg' ? 'bg' : (typeParam === 'logo' ? 'logo' : 'banner'),
            createdAt: new Date().toISOString(),
            isUsed: true,
            usedInTemplates: [template]
          };
          onSelectMedia(newFile);
          onClose();
        }
      } else {
        alert(data.message || 'Erro ao enviar mídia.');
      }
    } catch (err: any) {
      alert('Falha no upload: ' + (err?.message || 'Erro desconhecido'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteSingle = async (fileName: string) => {
    if (!confirm(`Deseja realmente apagar o arquivo "${fileName}" do servidor? Esta ação liberará espaço na VPS imediatamente.`)) {
      return;
    }

    setDeletingFileName(fileName);
    try {
      const res = await fetch(`/api/portal/upload?file=${encodeURIComponent(fileName)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(`Arquivo "${fileName}" removido com sucesso.`);
        await fetchMedia();
      } else {
        alert(data.message || 'Erro ao remover arquivo.');
      }
    } catch (err: any) {
      alert('Falha ao excluir arquivo: ' + err.message);
    } finally {
      setDeletingFileName(null);
    }
  };

  const handleClearAllMedia = async () => {
    setIsClearingAll(true);
    try {
      const res = await fetch('/api/portal/upload?all=true', {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        showToast(data.message || 'Mídias removidas da VPS com sucesso!');
        setConfirmClearAll(false);
        await fetchMedia();
      } else {
        alert(data.message || 'Erro ao limpar mídias.');
      }
    } catch (err: any) {
      alert('Falha ao limpar mídias: ' + err.message);
    } finally {
      setIsClearingAll(false);
    }
  };

  const handleConfirmSelect = (file: MediaFile) => {
    if (onSelectMedia) {
      onSelectMedia(file);
      onClose();
    }
  };

  // Filtragem de mídias
  const filteredFiles = useMemo(() => {
    return files.filter(f => {
      // Busca
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        if (!f.name.toLowerCase().includes(q)) return false;
      }
      // Categoria
      if (categoryFilter === 'video') return f.type === 'video';
      if (categoryFilter === 'banner') return f.category === 'banner';
      if (categoryFilter === 'bg') return f.category === 'bg';
      if (categoryFilter === 'logo') return f.category === 'logo';
      return true;
    });
  }, [files, searchQuery, categoryFilter]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 md:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden"
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const droppedFile = e.dataTransfer.files?.[0];
          if (droppedFile) handleUploadFile(droppedFile);
        }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
              <FolderOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  {targetTitle}
                </h3>
                {targetType !== 'general' && (
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                    Modo Seleção
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Selecione uma mídia existente, envie novos banners ou limpe arquivos para otimizar o disco da VPS.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={fetchMedia}
              disabled={loading}
              title="Atualizar lista"
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* VPS Storage Capacity Bar & Quick Cleanup */}
        <div className="px-5 py-3.5 bg-gradient-to-r from-slate-50 to-blue-50/40 dark:from-slate-900 dark:to-slate-800/40 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-semibold">
              <div className="flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <span className="text-slate-800 dark:text-slate-200">Armazenamento VPS (Pasta Uploads)</span>
                <span className="text-[11px] font-bold px-2 py-0.2 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                  {stats.totalFiles} de {stats.maxFiles} arquivos
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="font-bold text-slate-900 dark:text-slate-100">{stats.totalFormatted}</span>
                <span className="text-slate-400">/ {stats.maxFormatted}</span>
                <span className={`font-bold ${
                  stats.percentUsed >= 85 ? 'text-red-600 dark:text-red-400' : (stats.percentUsed >= 65 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400')
                }`}>
                  ({stats.percentUsed}% ocupado)
                </span>
              </div>
            </div>

            {/* Barra de Progresso */}
            <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2.5 overflow-hidden p-0.5 flex">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${
                  stats.percentUsed >= 85 
                    ? 'bg-gradient-to-r from-amber-500 to-red-600' 
                    : (stats.percentUsed >= 65 
                        ? 'bg-gradient-to-r from-blue-500 to-amber-500' 
                        : 'bg-gradient-to-r from-emerald-500 to-blue-500')
                }`}
                style={{ width: `${Math.max(4, stats.percentUsed)}%` }}
              />
            </div>
          </div>

          {/* Botão de Limpeza em Lote */}
          <div className="shrink-0 flex items-center gap-2">
            {!confirmClearAll ? (
              <button
                type="button"
                onClick={() => setConfirmClearAll(true)}
                className="text-xs font-bold px-3.5 py-2 rounded-xl bg-red-50 hover:bg-red-100 dark:bg-red-950/40 dark:hover:bg-red-900/60 text-red-600 dark:text-red-300 border border-red-200 dark:border-red-900 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Limpar Mídias</span>
              </button>
            ) : (
              <div className="flex items-center gap-2 bg-red-100 dark:bg-red-950/80 p-1.5 rounded-xl border border-red-300 dark:border-red-800 animate-in fade-in">
                <span className="text-[11px] font-bold text-red-800 dark:text-red-200 px-1">
                  Confirmar exclusão de todas as mídias?
                </span>
                <button
                  type="button"
                  onClick={handleClearAllMedia}
                  disabled={isClearingAll}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer"
                >
                  {isClearingAll ? 'Apagando...' : 'Sim, Limpar'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmClearAll(false)}
                  className="text-[11px] font-semibold px-2 py-1 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Toast Notifier */}
        {toastMessage && (
          <div className="mx-5 mt-3 p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 text-xs font-bold text-emerald-800 dark:text-emerald-200 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Search, Filter & Quick Upload Toolbar */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Pesquisar por nome do arquivo..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full text-xs pl-9 pr-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {[
              { id: 'all', label: 'Todas' },
              { id: 'banner', label: 'Banners' },
              { id: 'bg', label: 'Fundos' },
              { id: 'logo', label: 'Logos' },
              { id: 'video', label: 'Vídeos' },
            ].map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryFilter(cat.id as any)}
                className={`text-xs px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer shrink-0 ${
                  categoryFilter === cat.id
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                }`}
              >
                {cat.label}
              </button>
            ))}

            <label className={`ml-2 text-xs font-bold px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-xs shrink-0 ${
              uploading ? 'opacity-70 pointer-events-none' : ''
            }`}>
              <Upload className="w-3.5 h-3.5" />
              <span>{uploading ? 'Enviando...' : 'Subir Mais Mídias'}</span>
              <input 
                ref={fileInputRef}
                type="file" 
                accept="image/*,video/mp4,video/webm" 
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleUploadFile(f);
                }} 
                className="hidden" 
                disabled={uploading} 
              />
            </label>
          </div>
        </div>

        {/* Drag & Drop Alert Area if Dragging */}
        {isDragging && (
          <div className="m-4 p-8 border-2 border-dashed border-blue-500 bg-blue-50/50 dark:bg-blue-950/30 rounded-2xl flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 animate-pulse">
            <Upload className="w-10 h-10 mb-2 animate-bounce" />
            <span className="text-sm font-bold">Solte o arquivo aqui para enviar à VPS</span>
          </div>
        )}

        {/* Media Grid */}
        <div className="flex-1 overflow-y-auto p-4 md:p-5">
          {loading && files.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
              <p className="text-xs font-semibold">Carregando mídias da VPS...</p>
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-900/30 p-8">
              <ImageIcon className="w-12 h-12 text-slate-300 dark:text-slate-700" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Nenhuma mídia encontrada</h4>
                <p className="text-xs text-slate-400 max-w-sm">
                  {searchQuery ? 'Nenhum arquivo corresponde à busca.' : 'Envie banners ou planos de fundo para começar a personalizar seu Hotspot.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="text-xs font-bold px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2 cursor-pointer shadow-xs"
              >
                <Upload className="w-4 h-4" />
                <span>Enviar Primeira Mídia</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3.5">
              {filteredFiles.map((file) => {
                const isSelected = selectedFileName === file.name;
                const isDeleting = deletingFileName === file.name;

                return (
                  <div
                    key={file.name}
                    className={`group relative rounded-xl border transition-all overflow-hidden flex flex-col bg-slate-50 dark:bg-slate-800/60 ${
                      isSelected
                        ? 'border-blue-500 ring-2 ring-blue-500/40 shadow-lg'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
                    }`}
                  >
                    {/* Media Preview Container */}
                    <div className="relative aspect-video bg-slate-950 flex items-center justify-center overflow-hidden">
                      {file.type === 'video' ? (
                        <>
                          <video
                            src={file.url}
                            poster={file.posterUrl || undefined}
                            muted
                            playsInline
                            loop
                            onMouseOver={(e) => (e.currentTarget as any).play().catch(() => {})}
                            onMouseOut={(e) => (e.currentTarget as any).pause()}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded-md bg-black/70 backdrop-blur-xs text-[10px] font-bold text-white flex items-center gap-1">
                            <Film className="w-3 h-3 text-amber-400" />
                            <span>VÍDEO</span>
                          </div>
                        </>
                      ) : (
                        <img
                          src={file.url}
                          alt={file.name}
                          loading="lazy"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      )}

                      {/* Status Badges Overlay */}
                      {file.isUsed && (
                        <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-emerald-600/90 text-white text-[10px] font-bold flex items-center gap-1 shadow-xs">
                          <Check className="w-2.5 h-2.5" />
                          <span>Em Uso</span>
                        </div>
                      )}

                      {/* Hover Actions Overlay */}
                      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                        {onSelectMedia && (
                          <button
                            type="button"
                            onClick={() => handleConfirmSelect(file)}
                            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-1.5 cursor-pointer shadow-md"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Escolher</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteSingle(file.name)}
                          disabled={isDeleting}
                          title="Apagar este arquivo da VPS"
                          className="p-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white cursor-pointer shadow-md"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Metadata Details */}
                    <div className="p-2.5 space-y-1">
                      <div className="flex items-center justify-between gap-1">
                        <span 
                          className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate"
                          title={file.name}
                        >
                          {file.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{file.sizeFormatted}</span>
                        <span className="capitalize text-[10px] font-semibold px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700">
                          {file.category}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between bg-slate-50 dark:bg-slate-900">
          <p className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
            💡 <strong className="text-slate-700 dark:text-slate-300">Dica VPS:</strong> Apagar vídeos e banners antigos reduz o consumo de disco e acelera os deploys para o MikroTik.
          </p>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-bold px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
