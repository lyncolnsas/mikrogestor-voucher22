"use client";
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Eye, 
  RotateCcw, 
  X
} from 'lucide-react';

interface StudioCanvasProps {
  template: string;
  viewportMode: 'mobile' | 'tablet' | 'desktop';
  previewZoom: number;
  previewScreen: 'login' | 'register';
  ad: any;
  showSimulatedAd: boolean;
  setShowSimulatedAd: (show: boolean) => void;
  onRefreshIframe: () => void;
  onIframeLoad?: () => void;
}

export default function StudioCanvas({
  template,
  viewportMode,
  previewZoom,
  previewScreen,
  ad,
  showSimulatedAd,
  setShowSimulatedAd,
  onRefreshIframe,
  onIframeLoad,
}: StudioCanvasProps) {
  const [simulatedTimer, setSimulatedTimer] = useState(0);
  const [simulatedActiveIndex, setSimulatedActiveIndex] = useState(0);
  const [simulatorMuted, setSimulatorMuted] = useState(true);
  const activeVideoRef = useRef<HTMLVideoElement | null>(null);

  // Iniciar vídeo imediatamente sem telas de espera ou pausas acidentais
  useEffect(() => {
    if (!showSimulatedAd) {
      if (activeVideoRef.current) {
        try {
          activeVideoRef.current.pause();
          activeVideoRef.current.currentTime = 0;
        } catch {}
      }
      return;
    }

    // Ao abrir o anúncio ou montar slide de vídeo: forçar reprodução imediata
    if (activeVideoRef.current) {
      const vid = activeVideoRef.current;
      vid.muted = simulatorMuted;
      vid.defaultMuted = true;
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Se falhou por política de som, garante muted para iniciar instantaneamente
          vid.muted = true;
          vid.play().catch(() => {});
        });
      }
    }
  }, [showSimulatedAd, simulatedActiveIndex, simulatorMuted]);

  // Função para desbloquear áudio e garantir que o vídeo continue rodando sem pausar
  const handleUnlockAudioAndKeepPlaying = (e?: React.MouseEvent | React.TouchEvent) => {
    if (e) {
      e.stopPropagation();
    }
    setSimulatorMuted(false);
    if (activeVideoRef.current) {
      const vid = activeVideoRef.current;
      vid.muted = false;
      vid.defaultMuted = false;
      vid.removeAttribute('muted');
      const playPromise = vid.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Se falhou com áudio, tenta novamente mantendo muted
          vid.play().catch(() => {});
        });
      }
    }
  };

  // Disparar no primeiro clique/toque na tela: apenas registra desmutar sem forçar play caso o slide seja imagem
  useEffect(() => {
    const handleFirstGesture = () => {
      setSimulatorMuted(false);
      if (activeVideoRef.current) {
        const vid = activeVideoRef.current;
        vid.muted = false;
        vid.defaultMuted = false;
        vid.removeAttribute('muted');
        vid.play().catch(() => {});
      }
    };

    window.addEventListener('click', handleFirstGesture, true);
    window.addEventListener('touchstart', handleFirstGesture, true);
    window.addEventListener('keydown', handleFirstGesture, true);

    return () => {
      window.removeEventListener('click', handleFirstGesture, true);
      window.removeEventListener('touchstart', handleFirstGesture, true);
      window.removeEventListener('keydown', handleFirstGesture, true);
    };
  }, []);

  // Determine viewport dimensions - calibrado para não cortar verticalmente
  const getViewportDimensions = () => {
    switch (viewportMode) {
      case 'tablet':
        return { width: '520px', height: '680px', label: 'Tablet (520 × 680)' };
      case 'desktop':
        return { width: '800px', height: '560px', label: 'Desktop (800 × 560)' };
      case 'mobile':
      default:
        return { width: '375px', height: '690px', label: 'Mobile (375 × 690)' };
    }
  };

  const dimensions = getViewportDimensions();

  // Handle ad countdown
  useEffect(() => {
    if (!showSimulatedAd || !ad?.timerEnabled) {
      const frame = requestAnimationFrame(() => setSimulatedTimer(0));
      return () => cancelAnimationFrame(frame);
    }
    let interval: ReturnType<typeof setInterval>;
    const frame = requestAnimationFrame(() => {
      setSimulatedTimer(ad.timerDuration || 5);
      interval = setInterval(() => {
        setSimulatedTimer(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (interval) clearInterval(interval);
    };
  }, [showSimulatedAd, ad?.timerEnabled, ad?.timerDuration]);

  // Handle carousel auto-play com salvaguarda para vídeos (nunca fica estático)
  useEffect(() => {
    if (!showSimulatedAd || ad?.type !== 'carousel') return;
    const items = Array.isArray(ad?.items) ? ad.items.filter((i: any) => i?.url) : [];
    if (items.length <= 1) return;

    const currentItem = items[simulatedActiveIndex];
    const isVideo = currentItem?.type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(currentItem?.url || '');

    // Imagem: 4 segundos. Vídeo: timeout de segurança de 10s caso onEnded não seja disparado
    const timeoutDuration = isVideo ? 10000 : 4000;

    const timer = setTimeout(() => {
      setSimulatedActiveIndex(prev => (prev + 1) % items.length);
    }, timeoutDuration);

    return () => clearTimeout(timer);
  }, [showSimulatedAd, ad?.type, ad?.items, simulatedActiveIndex]);

  const carouselItems = Array.isArray(ad?.items) ? ad.items.filter((i: any) => i?.url) : [];

  return (
    <section className="flex-1 bg-slate-100/70 dark:bg-slate-950 flex flex-col items-center justify-center p-4 relative overflow-auto custom-scrollbar select-none">
      {/* Suprimir botões de play e controles nativos de vídeo */}
      <style>{`
        video::-webkit-media-controls,
        video::-webkit-media-controls-start-playback-button,
        video::-webkit-media-controls-overlay-play-button,
        video::-webkit-media-controls-play-button {
          display: none !important;
          -webkit-appearance: none !important;
          opacity: 0 !important;
          visibility: hidden !important;
        }
      `}</style>

      {/* Background canvas grid pattern */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(#64748b 1px, transparent 1px)',
          backgroundSize: '20px 20px'
        }}
      />

      {/* Scaled Device Frame Container */}
      <div 
        className="transition-transform duration-200 ease-out origin-center flex items-center justify-center relative"
        style={{ transform: `scale(${previewZoom / 100})` }}
      >
        <div 
          className={`relative bg-black rounded-[42px] p-2.5 sm:p-3 shadow-2xl border-4 border-slate-800/80 dark:border-slate-700/80 transition-all duration-300 max-w-[calc(100vw-32px)] ${
            viewportMode === 'mobile' ? 'ring-1 ring-slate-900/40 ring-offset-4 ring-offset-slate-100 dark:ring-offset-slate-900' : 'rounded-2xl p-2'
          }`}
          style={{ width: dimensions.width, height: dimensions.height }}
        >
          {/* Dynamic Island / Camera bezel (Only in mobile) */}
          {viewportMode === 'mobile' && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-28 h-4 bg-black rounded-full z-40 flex items-center justify-center pointer-events-none">
              <span className="w-2.5 h-2.5 rounded-full bg-slate-900/90 border border-slate-800" />
            </div>
          )}

          {/* Device Screen Viewport */}
          <div className="w-full h-full rounded-[32px] overflow-hidden relative bg-white dark:bg-slate-900">
            <iframe
              id="preview-iframe"
              src={
                previewScreen === 'register'
                  ? `/portal/register?template=${encodeURIComponent(template)}&preview=1`
                  : `/api/portal/preview?template=${encodeURIComponent(template)}&screen=login`
              }
              className="w-full h-full border-0 bg-transparent select-none"
              title="MikroTik Hotspot Live Preview"
              onLoad={onIframeLoad}
            />

            {/* Ad Simulation Overlay if Triggered */}
            {showSimulatedAd && ad && ad.type !== 'none' && (
              <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md flex flex-col items-center justify-center p-4 z-50 animate-fade-in">
                {/* Botão fechar (X) sempre disponível no Studio para permitir ao usuário fechar e continuar editando */}
                <button
                  type="button"
                  onClick={() => setShowSimulatedAd(false)}
                  className="absolute top-4 right-4 w-8 h-8 rounded-full bg-pink-600 hover:bg-pink-500 text-white flex items-center justify-center text-xs font-bold transition-all cursor-pointer border border-white/20 shadow-lg z-50"
                  title="Fechar Anúncio e Continuar Editando"
                >
                  <X className="w-4 h-4" />
                </button>

                <div className="flex flex-col items-center gap-3 max-w-[280px] w-full">
                  <div className="relative rounded-2xl overflow-hidden w-[240px] h-[380px] bg-black shadow-2xl border border-white/10 flex items-center justify-center">
                    <span className="absolute top-3 left-3 bg-black/70 text-white text-[8px] px-2 py-0.5 rounded font-bold uppercase z-30">
                      Patrocinado
                    </span>

                    {ad.type === 'carousel' && carouselItems.length > 1 && (
                      <div className="absolute top-2 left-2 right-2 flex gap-1 z-30">
                        {carouselItems.map((_: any, idx: number) => (
                          <div key={idx} className="h-0.5 flex-1 bg-white/30 rounded-full overflow-hidden">
                            <div className={`h-full bg-white transition-all duration-300 ${
                              idx <= simulatedActiveIndex ? 'w-full' : 'w-0'
                            }`} />
                          </div>
                        ))}
                      </div>
                    )}

                    {(() => {
                      const activeItem = ad.type === 'carousel' 
                        ? carouselItems[simulatedActiveIndex] 
                        : (ad.mediaUrl ? { url: ad.mediaUrl, type: ad.type, targetUrl: ad.targetUrl } : null);

                      if (!activeItem || !activeItem.url) {
                        return <span className="text-xs text-slate-500">Sem mídia cadastrada</span>;
                      }

                      const isVideo = activeItem.type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(activeItem.url);

                      return (
                        <div className="relative w-full h-full flex items-center justify-center">
                          {isVideo ? (
                            <video
                              ref={activeVideoRef}
                              key={activeItem.url}
                              src={activeItem.url}
                              autoPlay
                              preload="auto"
                              muted={simulatorMuted}
                              loop={ad.type !== 'carousel' || carouselItems.length <= 1}
                              playsInline
                              onLoadedMetadata={(e) => {
                                e.currentTarget.play().catch(() => {});
                              }}
                              onLoadedData={(e) => {
                                e.currentTarget.play().catch(() => {});
                              }}
                              onCanPlay={(e) => {
                                e.currentTarget.play().catch(() => {});
                              }}
                              onPause={(e) => {
                                // No banner único (sem carrossel), garante que o vídeo continue reproduzindo sem travar ao tocar
                                const target = e.currentTarget;
                                if (target && showSimulatedAd && (ad.type !== 'carousel' || carouselItems.length <= 1)) {
                                  target.play().catch(() => {});
                                }
                              }}
                              onEnded={(e) => {
                                try {
                                  e.currentTarget.pause();
                                  e.currentTarget.currentTime = 0;
                                } catch {}
                                if (ad.type === 'carousel' && carouselItems.length > 1) {
                                  setSimulatedActiveIndex(prev => (prev + 1) % carouselItems.length);
                                }
                              }}
                              onError={() => {
                                if (ad.type === 'carousel' && carouselItems.length > 1) {
                                  setTimeout(() => {
                                    setSimulatedActiveIndex(prev => (prev + 1) % carouselItems.length);
                                  }, 1500);
                                }
                              }}
                              className="w-full h-full object-cover pointer-events-none select-none"
                            />
                          ) : (
                            <img
                              key={activeItem.url}
                              src={activeItem.url}
                              alt="Anúncio"
                              loading="eager"
                              decoding="async"
                              className="w-full h-full object-contain relative z-10 block"
                              onError={() => {
                                console.warn('Erro ao carregar imagem do anúncio:', activeItem.url);
                              }}
                            />
                          )}

                          {/* Botão invisível em tela cheia para liberar áudio sem passar de slide nem pausar o vídeo */}
                          <div
                            onClick={handleUnlockAudioAndKeepPlaying}
                            onTouchStart={handleUnlockAudioAndKeepPlaying}
                            className="absolute inset-0 z-20 cursor-pointer"
                            title="Tocar para liberar áudio"
                          />
                        </div>
                      );
                    })()}
                  </div>

                  {ad.timerEnabled && simulatedTimer > 0 && (
                    <div className="bg-black/90 border border-white/20 text-white text-[11px] font-bold px-3 py-1 rounded-full shadow-lg">
                      Aguarde {simulatedTimer}s para navegar
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating Canvas Footer HUD */}
      <div className="absolute bottom-16 md:bottom-4 z-30 flex items-center gap-2 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-lg text-xs">
        <span className="text-slate-500 dark:text-slate-400 font-medium">
          {dimensions.label}
        </span>
        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
        <button
          type="button"
          onClick={onRefreshIframe}
          className="text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 font-semibold flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Recarregar</span>
        </button>

        {ad && ad.type !== 'none' && !showSimulatedAd && (
          <>
            <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-700" />
            <button
              type="button"
              onClick={() => setShowSimulatedAd(true)}
              className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1 cursor-pointer hover:underline"
            >
              <Eye className="w-3 h-3" />
              <span>Testar Anúncio</span>
            </button>
          </>
        )}
      </div>
    </section>
  );
}
