"use client";

import React from 'react';
import { 
  Megaphone, 
  Upload, 
  Trash2, 
  Eye, 
  Clock, 
  FolderOpen
} from 'lucide-react';

interface AdsStudioPanelProps {
  ad: any;
  setAd: React.Dispatch<React.SetStateAction<any>>;
  onAdUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSlotUpload: (e: React.ChangeEvent<HTMLInputElement>, slot: number) => void;
  onSlotTargetUrlChange: (slot: number, val: string) => void;
  onSlotClear: (slot: number) => void;
  adUploadLoading: boolean;
  onPreviewAd: () => void;
  onOpenMediaPicker?: (target: { type: 'ad_single' | 'ad_slot'; slot?: number; title: string }) => void;
}

export default function AdsStudioPanel({
  ad,
  setAd,
  onAdUpload,
  onSlotUpload,
  onSlotTargetUrlChange,
  onSlotClear,
  adUploadLoading,
  onPreviewAd,
  onOpenMediaPicker,
}: AdsStudioPanelProps) {
  const carouselItems = Array.isArray(ad?.items) ? ad.items : [];

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 overflow-y-auto p-4 space-y-6 select-none">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black text-slate-900 dark:text-slate-100 tracking-tight flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-amber-500" />
            <span>Publicidade & Patrocinadores</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Monetize sua rede com banners ou vídeos exibidos antes da liberação do Wi-Fi.
          </p>
        </div>

        <button
          type="button"
          onClick={onPreviewAd}
          className="text-xs font-bold px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Eye className="w-3.5 h-3.5" />
          <span>Simular Anúncio</span>
        </button>
      </div>

      {/* Ad Format Selector */}
      <div className="space-y-2">
        <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
          Formato de Exibição
        </label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { id: 'none', label: 'Desativado' },
            { id: 'single', label: 'Banner Único' },
            { id: 'carousel', label: 'Carrossel (Até 5)' },
          ].map((mode) => (
            <button
              key={mode.id}
              type="button"
              onClick={() => setAd((prev: any) => ({ ...prev, type: mode.id }))}
              className={`p-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer text-center ${
                ad.type === mode.id
                  ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200'
                  : 'border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
              }`}
            >
              {mode.label}
            </button>
          ))}
        </div>
      </div>

      {ad.type !== 'none' && (
        <>
          {/* Mandatory Timer Setting */}
          <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                  Temporizador Obrigatório
                </span>
              </div>
              <input
                type="checkbox"
                checked={Boolean(ad.timerEnabled)}
                onChange={(e) => setAd((prev: any) => ({ ...prev, timerEnabled: e.target.checked }))}
                className="w-4 h-4 accent-amber-500"
              />
            </div>

            {ad.timerEnabled && (
              <div className="space-y-1 pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between text-xs font-semibold text-slate-600 dark:text-slate-400">
                  <span>Tempo de Visualização Obrigatória</span>
                  <span className="font-bold text-amber-600">{ad.timerDuration || 5} segundos</span>
                </div>
                <input
                  type="range"
                  min="3"
                  max="30"
                  value={ad.timerDuration || 5}
                  onChange={(e) => setAd((prev: any) => ({ ...prev, timerDuration: parseInt(e.target.value) }))}
                  className="w-full accent-amber-500"
                />
              </div>
            )}
          </div>

          {/* Single Media Format */}
          {ad.type === 'single' && (
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-3">
              <h4 className="text-xs font-bold text-slate-800 dark:text-slate-200">
                Banner Único (Imagem ou Vídeo)
              </h4>

              {ad.mediaUrl ? (
                <div className="relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-black aspect-video flex items-center justify-center">
                  {(ad.type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(ad.mediaUrl)) ? (
                    <video src={ad.mediaUrl} muted playsInline autoPlay loop className="w-full h-full object-cover" />
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={ad.mediaUrl} alt="Ad Preview" className="w-full h-full object-contain" />
                  )}
                  <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
                    {onOpenMediaPicker && (
                      <button
                        type="button"
                        onClick={() => onOpenMediaPicker({ type: 'ad_single', title: 'Alterar Banner Principal' })}
                        title="Trocar Mídia da Galeria"
                        className="p-1.5 rounded-lg bg-black/70 text-white hover:bg-black/90 cursor-pointer"
                      >
                        <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setAd((prev: any) => ({ ...prev, mediaUrl: '' }))}
                      className="p-1.5 rounded-lg bg-black/70 text-white hover:bg-black/90 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
              ) : (
                onOpenMediaPicker ? (
                  <div
                    onClick={() => onOpenMediaPicker({ type: 'ad_single', title: 'Selecionar Mídia para o Banner Único' })}
                    className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-xl cursor-pointer bg-white dark:bg-slate-900 transition-all text-center group"
                  >
                    <FolderOpen className="w-6 h-6 text-amber-500 mb-1 group-hover:scale-110 transition-transform" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Escolher da Galeria ou Enviar Novo
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">
                      Imagens PNG, JPG, WEBP ou Vídeo MP4
                    </span>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center p-5 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-xl cursor-pointer bg-white dark:bg-slate-900 transition-all text-center">
                    <Upload className="w-5 h-5 text-amber-500 mb-1" />
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {adUploadLoading ? 'Enviando...' : 'Enviar Mídia do Banner'}
                    </span>
                    <input
                      type="file"
                      accept="image/*,video/mp4"
                      onChange={onAdUpload}
                      disabled={adUploadLoading}
                      className="hidden"
                    />
                  </label>
                )
              )}

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Link de Redirecionamento ao Clicar (Opcional)
                </label>
                <input
                  type="url"
                  value={ad.targetUrl || ''}
                  onChange={(e) => setAd((prev: any) => ({ ...prev, targetUrl: e.target.value }))}
                  placeholder="https://instagram.com/seupatrocinador"
                  className="w-full text-xs px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Carousel Format (Slots 1 to 5) */}
          {ad.type === 'carousel' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Slots do Carrossel de Patrocinadores
              </h4>

              {[1, 2, 3, 4, 5].map((slot) => {
                const item = carouselItems[slot - 1];
                const hasMedia = Boolean(item && item.url);

                return (
                  <div
                    key={slot}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        Slot #{slot}
                      </span>
                      {hasMedia && (
                        <div className="flex items-center gap-2">
                          {onOpenMediaPicker && (
                            <button
                              type="button"
                              onClick={() => onOpenMediaPicker({ type: 'ad_slot', slot, title: `Trocar Mídia do Slot #${slot}` })}
                              className="text-[11px] text-blue-600 hover:text-blue-700 font-semibold cursor-pointer"
                            >
                              Trocar
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onSlotClear(slot)}
                            className="text-[11px] text-red-600 hover:text-red-700 font-semibold cursor-pointer"
                          >
                            Limpar
                          </button>
                        </div>
                      )}
                    </div>

                    {hasMedia ? (
                      <div className="flex items-center gap-3">
                        <div 
                          onClick={() => onOpenMediaPicker?.({ type: 'ad_slot', slot, title: `Trocar Mídia do Slot #${slot}` })}
                          className="w-14 h-14 rounded-lg bg-black overflow-hidden shrink-0 border border-slate-300 dark:border-slate-700 flex items-center justify-center cursor-pointer hover:opacity-85 transition-opacity"
                        >
                          {(item.type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(item.url)) ? (
                            <video src={item.url} muted playsInline autoPlay loop className="w-full h-full object-cover" />
                          ) : (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img src={item.url} alt={`Slot ${slot}`} className="w-full h-full object-contain" />
                          )}
                        </div>
                        <input
                          type="url"
                          value={item.targetUrl || ''}
                          onChange={(e) => onSlotTargetUrlChange(slot, e.target.value)}
                          placeholder="Link ao clicar: https://..."
                          className="flex-1 text-xs px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                        />
                      </div>
                    ) : (
                      onOpenMediaPicker ? (
                        <div
                          onClick={() => onOpenMediaPicker({ type: 'ad_slot', slot, title: `Selecionar Mídia para Slot #${slot}` })}
                          className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-lg cursor-pointer bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-400 group transition-all"
                        >
                          <FolderOpen className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                          <span>Escolher da Galeria para Slot #{slot}</span>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-500 rounded-lg cursor-pointer bg-white dark:bg-slate-900 text-xs font-semibold text-slate-600 dark:text-slate-400">
                          <Upload className="w-3.5 h-3.5 text-amber-500" />
                          <span>Enviar imagem para Slot #{slot}</span>
                          <input
                            type="file"
                            accept="image/*,video/mp4"
                            onChange={(e) => onSlotUpload(e, slot)}
                            disabled={adUploadLoading}
                            className="hidden"
                          />
                        </label>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
