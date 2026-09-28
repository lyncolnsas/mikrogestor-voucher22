/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { prisma } from '@/lib/prisma';
import { getNicheEffectMarkup } from '@/lib/niche-effects';
import { getBrandEffectsStyles } from '@/lib/brand-effects-styles';
import { getTemplatePaths, normalizeHtmlStructure } from '@/lib/portal-template-utils';
import { getMaskedPortalDomain, getMaskedPortalUrl, isVpsMode, getPublicDomain } from '@/lib/domain';

const DEFAULT_HOTSPOT_DIR = path.join(process.cwd(), 'hotspot', 'default');

function getPaths(templateName?: string | null) {
  return getTemplatePaths(templateName);
}

function getLocalLanIp() {
  try {
    const interfaces = os.networkInterfaces();
    let localIp = '';

    for (const name of Object.keys(interfaces)) {
      const iface = interfaces[name];
      if (!iface) continue;

      for (const alias of iface) {
        if (alias.family === 'IPv4' && !alias.internal) {
          if (alias.address.startsWith('192.168.') || alias.address.startsWith('10.')) {
            localIp = alias.address;
            break;
          } else if (!localIp) {
            localIp = alias.address;
          }
        }
      }
      if (localIp && (localIp.startsWith('192.168.') || localIp.startsWith('10.'))) {
        break;
      }
    }
    return localIp || '192.168.88.254';
  } catch (e) {
    return '192.168.88.254';
  }
}

const DEFAULT_CONFIG = {
  enabled: true,
  saleMode: false,
  redirectUrl: '',
  businessName: 'Super Wi-Fi',
  registerButtonText: 'Cadastre-se aqui',
  registerTitle: 'Wi-Fi Grátis',
  registerSubtitle: 'Cadastre-se abaixo para liberar o acesso à internet',
  registerSubmitText: 'Cadastrar e Conectar',
  termsText: 'Ao se cadastrar, você concorda com nossos Termos de Uso e Política de Privacidade.',
  trialEnabled: true,
  trialText: 'Acesso de teste disponível, ',
  trialLinkText: 'clique aqui',
  trialModalTitle: 'Acesso de Teste',
  trialModalMessage: 'Tem certeza de que deseja liberar o acesso grátis por 30 minutos?',
  trialModalConfirmText: 'Sim, Conectar',
  trialModalCancelText: 'Não, Voltar',
  colors: {
    brand: '#00897b',
    brandDark: '#00796b',
    bg: '#fafafa',
    ink: '#0b1220',
    muted: '#6b7280',
    blue: '#2563eb',
    green: '#10b981',
    trialButtonBg: '#1E90FF',
    trialButtonText: '#FFFFFF',
    cardBg: '#ffffff',
    cardBorder: 'rgba(0,0,0,0.08)',
    inputBg: '#ffffff',
    inputText: '#0f172a',
    inputBorder: '#e2e8f0',
    inputPlaceholder: '#94a3b8',
    loginButtonText: '#ffffff',
    registerButtonText: '#ffffff',
    glassOpacity: 100,
    glassBlur: 0
  },
  effects: {
    bgEffect: 'none', // 'none' | 'aurora' | 'particles' | 'matrix' | 'cyber-grid' | 'floating-orbs' | 'fireflies' | 'warp-stars' | 'wave-mesh'
    bgEffectSpeed: 'normal', // 'slow' | 'normal' | 'fast'
    cardShape: 'rounded', // 'rounded' | 'square' | 'pill' | 'scifi-cut'
    cardNoiseTexture: false,
    cardGlowBorder: false,
    cardTilt3d: false,
    btnShimmer: true,
    btnPulse: false,
    titleGradient: false,
  },
  social: {
    whatsappEnabled: false,
    whatsappNumber: '',
    whatsappMessage: 'Olá! Preciso de suporte para acessar o Wi-Fi.',
    instagramUrl: '',
    facebookUrl: '',
    googleMapsUrl: '',
  },
  badges: {
    showWifiSpeed: false,
    wifiSpeedText: '⚡ Wi-Fi 5G Ultra Rápido',
    showSecurityBadge: false,
    securityText: '🔒 Conexão Criptografada',
    showConnectedCount: false,
    connectedCountNumber: '42',
  },
  brand: {
    headerStyle: 'hidden', // 'hidden' | 'transparent' | 'floating' | 'solid'
    displayMode: 'image', // 'image' | 'text' | 'both' | 'none'
    logoBg: 'none', // 'none' | 'glass' | 'white' | 'dark' | 'brand' | 'glow' | 'custom'
    logoBgCustomColor: '#ffffff',
    logoShape: 'rounded', // 'circle' | 'rounded' | 'square' | 'pill'
    logoPadding: 8,
    logoSize: 100,
    logoBorder: false,
    logoShadow: true,
    titleText: 'Super Wi-Fi',
    subtitleText: '',
    fontFamily: 'Outfit',
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: 0,
    textColor: '#ffffff',
    textAlign: 'center',
    textTransform: 'none',
    textEffect: 'gradient-metal',
    entranceAnimation: 'fade-zoom',
    animationDuration: 1.2,
    animationDelay: 0.1,
    animationEasing: 'smooth',
    continuousEffect: 'none',
    taglineFontFamily: 'Outfit',
    taglineFontSize: 12,
    taglineColor: '#94a3b8',
    taglineLetterSpacing: 0,
    badgeStyle: 'none'
  },
  studio: {
    fontFamily: 'Inter',
    titleFontSize: 24,
    titleFontWeight: '700',
    titleLineHeight: 1.2,
    titleLetterSpacing: 0,
    titleAlign: 'center',
    titleItalic: false,
    titleUnderline: false,
    btnFontSize: 14,
    btnFontWeight: '600',
    btnLetterSpacing: 0.5,
    btnHeight: 46,
    btnPaddingTop: 12,
    btnPaddingRight: 20,
    btnPaddingBottom: 12,
    btnPaddingLeft: 20,
    btnRadiusTL: 12,
    btnRadiusTR: 12,
    btnRadiusBR: 12,
    btnRadiusBL: 12,
    btnBorderWidth: 0,
    cardRadiusTL: 20,
    cardRadiusTR: 20,
    cardRadiusBR: 20,
    cardRadiusBL: 20,
    cardPaddingTop: 24,
    cardPaddingRight: 24,
    cardPaddingBottom: 24,
    cardPaddingLeft: 24,
    cardBorderWidth: 1,
    cardBorderStyle: 'solid',
    inputHeight: 44,
    inputRadius: 10,
    inputBorderWidth: 1
  },
  customCode: {
    customCss: '',
  },
  message: 'Bem-vindo à nossa rede gratuita. Insira o seu voucher para navegar.',
  systemUrl: `http://${getLocalLanIp()}`,
  bg: {
    type: 'default',
    url: ''
  },
  ad: {
    type: 'none',
    mediaUrl: '',
    targetUrl: '',
    items: [] as any[],
    timerEnabled: false,
    timerDuration: 5
  },
  fields: {
    nameEnabled: true,
    nameRequired: true,
    phoneEnabled: true,
    phoneRequired: true,
    birthDateEnabled: true,
    birthDateRequired: true,
    emailEnabled: true,
    emailRequired: false,
    cpfEnabled: true,
    cpfRequired: true,
    genderEnabled: true,
    genderRequired: true,
    passwordEnabled: true,
    passwordRequired: true,
    customFieldEnabled: false,
    customFieldLabel: 'Descreva aqui!',
    customFieldRequired: false,
    optInCoursesEnabled: true,
    optInCoursesLabel: 'Eu aceito receber informações dos cursos'
  }
};

function generateAdMarkup(ad: any, systemUrl?: string, providerName?: string) {
  if (!ad || ad.type === 'none') {
    return { css: '', html: '', js: '' };
  }

  const providerTitle = providerName || 'Wi-Fi Shield Security';

  let items = [];
  if ((ad.type === 'single' || ad.type === 'image' || ad.type === 'video') && ad.mediaUrl) {
    const isVid = ad.type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(ad.mediaUrl);
    items.push({ url: ad.mediaUrl, type: isVid ? 'video' : 'image', targetUrl: ad.targetUrl });
  } else if (ad.type === 'carousel' && Array.isArray(ad.items)) {
    items = ad.items.filter((item: any) => item && item.url);
  }

  if (items.length === 0) {
    return { css: '', html: '', js: '' };
  }

  const css = `
    /* ====== PRELOADER DISCRETO COM IDENTIDADE DA MARCA ====== */
    .ad-preloader-overlay {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      background: #020617;
      z-index: 10001 !important;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: opacity 0.4s ease-out, visibility 0.4s ease-out;
      pointer-events: none;
    }
    .ad-preloader-overlay.fade-out {
      opacity: 0;
      visibility: hidden;
    }
    .ad-preloader-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 24px;
    }
    .ad-preloader-icon-wrap {
      width: 54px;
      height: 54px;
      border-radius: 16px;
      background: rgba(6, 182, 212, 0.12);
      border: 1px solid rgba(6, 182, 212, 0.35);
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
      box-shadow: 0 0 20px rgba(6, 182, 212, 0.25);
      animation: adPulse 2s ease-in-out infinite alternate;
    }
    .ad-preloader-icon {
      width: 26px;
      height: 26px;
      color: #06b6d4;
    }
    .ad-preloader-title {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 20px;
      font-weight: 700;
      letter-spacing: 0.5px;
      background: linear-gradient(135deg, #06b6d4, #3b82f6, #06b6d4, #06b6d4) !important;
      background-size: 300% 300% !important;
      -webkit-background-clip: text !important;
      -webkit-text-fill-color: transparent !important;
      animation: mgTitleGradient 4s ease infinite alternate !important;
      margin-bottom: 12px;
    }
    .ad-preloader-dots {
      display: flex;
      gap: 6px;
      align-items: center;
      justify-content: center;
    }
    .ad-preloader-dots span {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #06b6d4;
      opacity: 0.35;
      animation: adDotPulse 1.2s infinite ease-in-out both;
    }
    .ad-preloader-dots span:nth-child(1) { animation-delay: -0.32s; }
    .ad-preloader-dots span:nth-child(2) { animation-delay: -0.16s; }
    @keyframes adPulse {
      0% { transform: scale(0.96); box-shadow: 0 0 12px rgba(6, 182, 212, 0.15); }
      100% { transform: scale(1.04); box-shadow: 0 0 25px rgba(6, 182, 212, 0.4); }
    }
    @keyframes adDotPulse {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
      40% { transform: scale(1.1); opacity: 1; }
    }
    @keyframes mgTitleGradient {
      0% { background-position: 0% 50%; }
      100% { background-position: 100% 50%; }
    }

    /* ====== POPUP DE VÍDEO / CARROSSEL TELA CHEIA ====== */
    .ad-modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: #000;
      z-index: 100000 !important; /* Bloqueia tudo abaixo */
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }

    .ad-modal-content-wrapper {
      position: relative;
      width: 100%;
      height: 100%;
      max-width: 600px;
      max-height: 1000px;
      display: flex;
      justify-content: center;
      align-items: center;
    }

    .ad-carousel-container {
      width: 100%;
      height: 100%;
      display: flex;
      overflow-x: auto;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
    }
    .ad-carousel-container::-webkit-scrollbar {
      display: none;
    }

    .ad-carousel-slide {
      flex: 0 0 100%;
      width: 100%;
      height: 100%;
      scroll-snap-align: start;
      position: relative;
      background: #000;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .ad-carousel-slide img, .ad-carousel-slide video {
      width: 100%;
      height: 100%;
      object-fit: contain; /* Mantém a proporção exata da imagem/vídeo sem cortes */
    }

    .ad-carousel-slide video {
      pointer-events: none; /* Impede que o clique/toque no vídeo acione a pausa nativa do navegador */
    }

    /* Esconder ícones nativos de play em espera do navegador */
    .ad-carousel-slide video::-webkit-media-controls,
    .ad-carousel-slide video::-webkit-media-controls-start-playback-button,
    .ad-carousel-slide video::-webkit-media-controls-overlay-play-button,
    .ad-carousel-slide video::-webkit-media-controls-play-button {
      display: none !important;
      -webkit-appearance: none !important;
      opacity: 0 !important;
      visibility: hidden !important;
    }

    .ad-click-catcher {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 50;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }

    .ad-patrocinado {
      position: absolute;
      top: max(20px, env(safe-area-inset-top)); /* Respeita o notch do iPhone */
      left: 20px;
      background: rgba(0, 0, 0, 0.5);
      color: #fff;
      padding: 6px 12px;
      font-size: 12px;
      border-radius: 6px;
      z-index: 99999 !important;
      text-transform: uppercase;
      letter-spacing: 1px;
      pointer-events: none;
    }

    .ad-modal-close {
      position: absolute;
      top: max(20px, env(safe-area-inset-top));
      right: 20px;
      background: #eb24a2;
      color: #fff;
      border: none;
      width: 44px;
      height: 44px;
      border-radius: 50%;
      font-size: 20px;
      cursor: pointer;
      z-index: 99999 !important;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      transition: background 0.2s, transform 0.2s;
      -webkit-tap-highlight-color: transparent;
    }
    .ad-modal-close:hover {
      filter: brightness(0.9);
    }
    .ad-modal-close:active {
      transform: scale(0.95);
    }

    .ad-modal-timer {
      position: absolute;
      bottom: max(30px, env(safe-area-inset-bottom));
      right: 20px;
      background: rgba(0, 0, 0, 0.75);
      color: #fff;
      padding: 8px 18px;
      font-size: 14px;
      border-radius: 30px;
      z-index: 99999 !important;
      font-weight: bold;
      border: 1px solid rgba(255,255,255,0.2);
      backdrop-filter: blur(5px);
    }

    /* Instagram Stories Style Top Progress Bar */
    .ad-stories-progress-container {
      position: absolute;
      top: max(20px, env(safe-area-inset-top));
      left: 20px;
      right: 20px;
      display: flex;
      gap: 6px;
      z-index: 99999 !important;
      pointer-events: none;
    }
    /* Adjust top of other elements if progress container exists */
    .ad-stories-progress-container ~ .ad-patrocinado {
      top: calc(max(20px, env(safe-area-inset-top)) + 12px);
    }
    .ad-stories-progress-container ~ .ad-modal-close {
      top: calc(max(20px, env(safe-area-inset-top)) + 12px);
    }

    .ad-progress-bar {
      height: 3px;
      flex: 1;
      background: rgba(255, 255, 255, 0.3);
      border-radius: 9999px;
      overflow: hidden;
    }
    .ad-progress-fill {
      height: 100%;
      background: #ffffff;
      width: 0%;
      transition: width 0.1s linear;
    }

    /* Botões de navegação sutil nas laterais para não interceptar o toque central de áudio */
    .ad-nav-btn {
      position: absolute;
      top: 50%;
      transform: translateY(-50%);
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(0, 0, 0, 0.45);
      border: 1px solid rgba(255, 255, 255, 0.2);
      color: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: bold;
      z-index: 95;
      cursor: pointer;
      backdrop-filter: blur(4px);
      user-select: none;
      -webkit-tap-highlight-color: transparent;
      opacity: 0.7;
      transition: opacity 0.2s, background 0.2s;
    }
    .ad-nav-btn:hover {
      opacity: 1;
      background: rgba(0, 0, 0, 0.75);
    }
    .ad-nav-btn-prev { left: 8px; }
    .ad-nav-btn-next { right: 8px; }

    /* Invisible Audio Trigger: a tela toda desbloqueia o áudio no toque sem botões visíveis piscando */
    .ad-audio-toggle {
      display: none !important;
    }

    .ad-video-progress-bar {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 3px;
      background: rgba(255, 255, 255, 0.2);
      z-index: 99999 !important;
      pointer-events: none;
    }
    .ad-video-progress-fill {
      height: 100%;
      width: 0%;
      background: #ffffff;
      transition: width 0.05s linear;
    }
  `;

  let slidesHTML = '';
  items.forEach((item: any, idx: number) => {
    let src = item.url;
    if (src.includes('/uploads/')) {
      const baseUrl = systemUrl ? systemUrl.replace(/\/$/, '') : '';
      const fileName = src.split('/uploads/').pop();
      src = `${baseUrl}/uploads/${fileName}`;
    } else if (src.startsWith('/api/')) {
      const baseUrl = systemUrl ? systemUrl.replace(/\/$/, '') : '';
      src = `${baseUrl}${src}`;
    } else if (!src.startsWith('http') && !src.startsWith('.')) {
      const baseUrl = systemUrl ? systemUrl.replace(/\/$/, '') : '';
      const cleanPath = src.startsWith('/') ? src : `/${src}`;
      src = `${baseUrl}${cleanPath}`;
    }
    
    const targetUrlArg = item.targetUrl ? `'${item.targetUrl.replace(/'/g, "\\'")}'` : "''";
    
    const isVideo = item.type === 'video' || /\.(mp4|webm|mov)(\?.*)?$/i.test(item.url || '');
    if (isVideo) {
      const loopAttr = items.length <= 1 ? 'loop' : '';
      slidesHTML += `<div class="ad-carousel-slide"><video id="adVideo-${idx}" class="ad-video-element" src="${src}" autoplay muted ${loopAttr} playsinline webkit-playsinline x5-playsinline preload="auto" onloadeddata="if(typeof currentAdIndex !== 'undefined' && currentAdIndex === ${idx}){ this.play().catch(function(){}); }"></video><div class="ad-click-catcher" onclick="handleAdClick(event, ${idx}, ${targetUrlArg})"></div><div class="ad-video-progress-bar"><div class="ad-video-progress-fill"></div></div></div>\n`;
    } else {
      slidesHTML += `<div class="ad-carousel-slide"><img src="${src}" loading="eager" decoding="async" /><div class="ad-click-catcher" onclick="handleAdClick(event, ${idx}, ${targetUrlArg})"></div></div>\n`;
    }
  });

  let progressHTML = '';
  let navHTML = '';
  if (items.length > 1) {
    progressHTML += '<div class="ad-stories-progress-container">\n';
    items.forEach((_: any, idx: number) => {
      progressHTML += `  <div class="ad-progress-bar"><div class="ad-progress-fill" id="adProgressFill-${idx}"></div></div>\n`;
    });
    progressHTML += '</div>\n';

    navHTML += '      <!-- Botoes de Navegacao Discretos (Nao cobrem a tela) -->\n';
    navHTML += '      <button type="button" class="ad-nav-btn ad-nav-btn-prev" onclick="navigateAdCarousel(-1); event.stopPropagation();" aria-label="Anterior">‹</button>\n';
    navHTML += '      <button type="button" class="ad-nav-btn ad-nav-btn-next" onclick="navigateAdCarousel(1); event.stopPropagation();" aria-label="Próximo">›</button>\n';
  }

  const timerBadgeDisplay = ad.timerEnabled ? 'block' : 'none';
  const closeBtnDisplay = ad.timerEnabled ? 'none' : 'flex';

  const html = `
  <!-- Publicidade Overlay Modal -->
  <div id="adModal" class="ad-modal-overlay">
    <div class="ad-modal-content-wrapper">
      <!-- Preloader Discreto com Identidade da Marca -->
      <div id="adPreloader" class="ad-preloader-overlay">
        <div class="ad-preloader-content">
          <div class="ad-preloader-icon-wrap">
            <svg class="ad-preloader-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12.55a11 11 0 0 1 14.08 0"></path>
              <path d="M1.42 9a16 16 0 0 1 21.16 0"></path>
              <path d="M8.53 16.11a6 6 0 0 1 6.95 0"></path>
              <line x1="12" y1="20" x2="12.01" y2="20"></line>
            </svg>
          </div>
          <div class="ad-preloader-title">${providerTitle}</div>
          <div class="ad-preloader-dots">
            <span></span><span></span><span></span>
          </div>
        </div>
      </div>

      <div class="ad-carousel-container" id="adCarousel">
        ${slidesHTML}
      </div>

      ${progressHTML}
      ${navHTML}

      <span class="ad-patrocinado">Patrocinado</span>
      
      <button id="adCloseBtn" type="button" class="ad-modal-close" style="display: ${closeBtnDisplay}" onclick="closeAdModal()">✕</button>

      <!-- Floating Mute/Unmute Audio Button -->
      <button id="adAudioBtn" type="button" class="ad-audio-toggle" style="display: none" onclick="toggleAdAudio()">🔇</button>
      
      <div id="adTimerBadge" class="ad-modal-timer" style="display: ${timerBadgeDisplay}">Aguarde...</div>
    </div>
  </div>
  `;

  let js = `
    window.closeAdModal = function() {
      const modal = document.getElementById('adModal');
      if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        modal.style.display = 'none';
        document.body.style.overflow = ''; // Unlock scroll
        document.body.style.removeProperty('overflow');
      }
      const videos = document.querySelectorAll('#adModal video');
      videos.forEach(v => {
        try { v.pause(); } catch(e) {}
      });
    };

    window._mgAudioPermanentlyUnlocked = false;

    window.handleAdClick = function(e, slideIdx, targetUrl) {
      if (e) e.stopPropagation();
      window._mgAudioPermanentlyUnlocked = true;
      
      // Apenas aciona o vídeo se o slide clicado for o slide visível no momento E tiver um elemento de vídeo nele
      var carouselEl = document.getElementById('adCarousel');
      var isCurrentSlide = true;
      if (carouselEl && carouselEl.children.length > 1 && typeof currentAdIndex !== 'undefined') {
        isCurrentSlide = (currentAdIndex === slideIdx);
      }
      
      if (isCurrentSlide) {
        var vid = document.getElementById('adVideo-' + slideIdx);
        if (vid) {
          vid.muted = false;
          vid.defaultMuted = false;
          vid.removeAttribute('muted');
          var p = vid.play();
          if (p && typeof p.then === 'function') {
            p.catch(function() {
              vid.muted = true;
              vid.play().catch(function() {});
            });
          }
        }
      }
      
      if (targetUrl && targetUrl.trim() !== '') {
        window.open(targetUrl, '_blank');
      }
    };

    window.toggleAdAudio = function() {
      if (window._mgAudioPermanentlyUnlocked) return;
      window._mgAudioPermanentlyUnlocked = true;
      const videos = document.querySelectorAll('#adModal video');
      videos.forEach(v => {
        try {
          v.muted = false;
          v.defaultMuted = false;
          v.removeAttribute('muted');
          var p = v.play();
          if (p && typeof p.then === 'function') p.catch(function() {});
        } catch(e) {}
      });
    };

    // Disparar no primeiro clique/toque na tela: libera o áudio do vídeo ATIVO sem mudar de slide ou disparar vídeos ocultos
    (function setupGlobalAudioUnlock() {
      function unlockAllAudio() {
        window._mgAudioPermanentlyUnlocked = true;

        // Desmuta e dá play APENAS no vídeo do slide atualmente visível
        var activeVid = null;
        var carouselEl = document.getElementById('adCarousel');
        if (carouselEl && carouselEl.children.length > 1 && typeof currentAdIndex !== 'undefined') {
          var curSlide = carouselEl.children[currentAdIndex];
          if (curSlide) activeVid = curSlide.querySelector('video');
        } else if (!carouselEl || carouselEl.children.length <= 1) {
          activeVid = document.querySelector('#adModal video');
        }

        if (activeVid) {
          try {
            activeVid.muted = false;
            activeVid.defaultMuted = false;
            activeVid.removeAttribute('muted');
            var p = activeVid.play();
            if (p && typeof p.then === 'function') p.catch(function() {});
          } catch(e) {}
        }

        // Remover os ouvintes após o primeiro gesto
        window.removeEventListener('click', unlockAllAudio, true);
        window.removeEventListener('touchstart', unlockAllAudio, true);
        window.removeEventListener('pointerdown', unlockAllAudio, true);
        window.removeEventListener('keydown', unlockAllAudio, true);
        window.removeEventListener('focusin', unlockAllAudio, true);
      }

      window.addEventListener('click', unlockAllAudio, true);
      window.addEventListener('touchstart', unlockAllAudio, true);
      window.addEventListener('pointerdown', unlockAllAudio, true);
      window.addEventListener('keydown', unlockAllAudio, true);
      window.addEventListener('focusin', unlockAllAudio, true);
    })();
    
    function initAdModalSetup() {
      const adModal = document.getElementById('adModal');
      if (adModal) {
        document.body.appendChild(adModal);
        document.body.style.overflow = 'hidden'; // Lock scroll
      }

      // Se houver vídeo no modal, exibe o botão de controle de áudio (apenas se for vídeo único, carrossel gerencia dinamicamente)
      const videos = document.querySelectorAll('#adModal video');
      const audioBtn = document.getElementById('adAudioBtn');
      if (videos.length > 0 && audioBtn) {
        const carousel = document.getElementById('adCarousel');
        if (!carousel || carousel.children.length <= 1) {
          audioBtn.style.display = 'flex';
        }
      }

      // Inicia imediatamente o vídeo ativo de forma ultrarrápida e silenciosa para autoplay 100% garantido sem tela de espera
      var activeVideo = document.querySelector('#adModal video');
      if (activeVideo) {
        activeVideo.muted = true;
        activeVideo.defaultMuted = true;
        activeVideo.playsInline = true;
        activeVideo.setAttribute('muted', '');
        activeVideo.setAttribute('playsinline', '');
        activeVideo.setAttribute('webkit-playsinline', '');
        activeVideo.setAttribute('x5-playsinline', '');
        var p = activeVideo.play();
        if (p && typeof p.then === 'function') {
          p.catch(function() {
            activeVideo.muted = true;
            activeVideo.play().catch(function() {});
          });
        }
      }

      var preloaderDismissed = false;
      function dismissAdPreloader() {
        if (preloaderDismissed) return;
        preloaderDismissed = true;
        var pre = document.getElementById('adPreloader');
        if (pre) {
          pre.classList.add('fade-out');
          setTimeout(function() { pre.style.display = 'none'; }, 300);
        }
      }

      // 1. Escuta eventos do primeiro vídeo ou imagens
      videos.forEach(function(video) {
        video.addEventListener('playing', dismissAdPreloader, { once: true });
        video.addEventListener('loadeddata', dismissAdPreloader, { once: true });
        video.addEventListener('canplay', dismissAdPreloader, { once: true });
        video.addEventListener('timeupdate', function() {
          if (video.currentTime > 0.02) dismissAdPreloader();
        });
      });

      const images = document.querySelectorAll('#adModal img');
      images.forEach(function(img) {
        if (img.complete && img.naturalHeight !== 0) {
          dismissAdPreloader();
        } else {
          img.addEventListener('load', dismissAdPreloader, { once: true });
          img.addEventListener('error', dismissAdPreloader, { once: true });
        }
      });

      // 2. Timeout de segurança ultra-rápido para nunca travar tela preta ou cinza
      setTimeout(dismissAdPreloader, 600);

      // Vincular barra de progresso estilo Facebook
      videos.forEach(function(video) {
        video.addEventListener('timeupdate', function() {
          const percent = (video.currentTime / (video.duration || 1)) * 100;
          const fill = video.parentNode.querySelector('.ad-video-progress-fill');
          if (fill) fill.style.width = percent + '%';
        });
      });

      // No banner único (vídeo único), assegura que o vídeo continue reproduzindo sem travar ao tocar na tela
      if (${items.length} <= 1) {
        var singleVid = document.querySelector('#adModal video');
        if (singleVid) {
          singleVid.onpause = function() {
            var modal = document.getElementById('adModal');
            if (modal && modal.style.display !== 'none') {
              setTimeout(function() {
                singleVid.play().catch(function() {});
              }, 50);
            }
          };
        }
      }
    }

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', initAdModalSetup);
    } else {
      initAdModalSetup();
    }
  `;

  if (items.length > 1) {
    js += `
      let currentAdIndex = 0;
      const adCount = ${items.length};
      let adAutoplayTimer = null;
      let progressInterval = null;
      let progressMs = 0;
      const slideDuration = 4000;
      
      function updateAdAudioButton() {
        const carouselEl = document.getElementById('adCarousel');
        const audioBtn = document.getElementById('adAudioBtn');
        if (carouselEl && audioBtn) {
          const currentSlide = carouselEl.children[currentAdIndex];
          if (currentSlide && currentSlide.querySelector('video')) {
            audioBtn.style.display = 'flex';
          } else {
            audioBtn.style.display = 'none';
          }
        }
      }

      function getCurrentSlideVideo() {
        const carouselEl = document.getElementById('adCarousel');
        if (!carouselEl) return null;
        const currentSlide = carouselEl.children[currentAdIndex];
        return currentSlide ? currentSlide.querySelector('video') : null;
      }

      function updateAdVideos() {
        const carouselEl = document.getElementById('adCarousel');
        if (!carouselEl) return;
        const slides = carouselEl.children;
        for (let i = 0; i < slides.length; i++) {
          const video = slides[i].querySelector('video');
          if (video) {
            if (i === currentAdIndex) {
              try {
                if (window._mgAudioPermanentlyUnlocked) {
                  video.muted = false;
                  video.defaultMuted = false;
                  video.removeAttribute('muted');
                } else {
                  video.muted = true;
                  video.defaultMuted = true;
                  video.setAttribute('muted', '');
                }
                video.playsInline = true;
                video.setAttribute('playsinline', '');
                video.setAttribute('webkit-playsinline', '');
                video.setAttribute('x5-playsinline', '');
                
                // Reinicia suavemente apenas se já tiver buffer
                if (video.readyState >= 1 && video.currentTime > 0.1) {
                  video.currentTime = 0;
                }
                
                const playPromise = video.play();
                if (playPromise && typeof playPromise.then === 'function') {
                  playPromise.catch(function() {
                    video.muted = true;
                    video.setAttribute('muted', '');
                    video.play().catch(function() {});
                  });
                }
                // Garante reprodução apenas se continuar sendo o slide ativo
                video.oncanplay = function() {
                  if (typeof currentAdIndex !== 'undefined' && currentAdIndex === i) {
                    video.play().catch(function() {});
                  }
                };
              } catch(e) {}
            } else {
              try {
                video.oncanplay = null;
                video.pause();
                video.muted = true;
                video.setAttribute('muted', '');
                if (video.readyState >= 1) {
                  video.currentTime = 0;
                }
              } catch(e) {}
            }
          }
        }
      }

      function updateAdProgress() {
        const fills = [];
        for (let i = 0; i < adCount; i++) {
          fills.push(document.getElementById('adProgressFill-' + i));
        }
        
        for (let i = 0; i < adCount; i++) {
          if (fills[i]) {
            if (i < currentAdIndex) fills[i].style.width = '100%';
            else if (i > currentAdIndex) fills[i].style.width = '0%';
          }
        }
        
        clearInterval(progressInterval);
        progressMs = 0;
        const activeFill = fills[currentAdIndex];
        const currentVideo = getCurrentSlideVideo();

        if (currentVideo) {
          // Barra de progresso do slide atual acompanha o tempo do vídeo
          currentVideo.ontimeupdate = function() {
            if (activeFill && currentVideo.duration) {
              const pct = (currentVideo.currentTime / currentVideo.duration) * 100;
              activeFill.style.width = pct + '%';
            }
          };
        } else if (activeFill) {
          // Barra de progresso de imagem avança suavemente durante 4s
          progressInterval = setInterval(() => {
            progressMs += 100;
            const pct = Math.min(100, (progressMs / slideDuration) * 100);
            activeFill.style.width = pct + '%';
            if (progressMs >= slideDuration) {
              clearInterval(progressInterval);
            }
          }, 100);
        }
      }
      
      function showAdSlide(idx) {
        currentAdIndex = (idx + adCount) % adCount;
        const carousel = document.getElementById('adCarousel');
        if (carousel) {
          const width = carousel.offsetWidth;
          carousel.scrollTo({ left: currentAdIndex * width, behavior: 'smooth' });
        }
        updateAdVideos();
        updateAdAudioButton();
        updateAdProgress();
        setupAdAutoplay();
      }
      
      function navigateAdCarousel(direction) {
        showAdSlide(currentAdIndex + direction);
      }
      
      function setupAdAutoplay() {
        if (adAutoplayTimer) {
          clearTimeout(adAutoplayTimer);
          adAutoplayTimer = null;
        }

        const video = getCurrentSlideVideo();
        if (video) {
          // Regra principal: avança assim que o vídeo terminar
          video.onended = function() {
            showAdSlide(currentAdIndex + 1);
          };
          // Se o vídeo falhar ao carregar, avança para o próximo slide
          video.onerror = function() {
            setTimeout(function() {
              showAdSlide(currentAdIndex + 1);
            }, 1000);
          };

          // Salvaguarda dinâmica: nunca deixar o carrossel estático caso onended não dispare
          var videoDur = (video.duration && !isNaN(video.duration) && video.duration > 0) ? video.duration : 10;
          var safeTimeoutMs = Math.min(30000, Math.max(6000, Math.ceil(videoDur * 1000) + 800));
          adAutoplayTimer = setTimeout(function() {
            showAdSlide(currentAdIndex + 1);
          }, safeTimeoutMs);
        } else {
          // Slide com imagem: avança após 4 segundos
          adAutoplayTimer = setTimeout(function() {
            showAdSlide(currentAdIndex + 1);
          }, slideDuration);
        }
      }

      function initAdCarouselFeatures() {
        const carousel = document.getElementById('adCarousel');
        if (carousel && adCount > 1) {
          showAdSlide(0);
          
          carousel.addEventListener('scroll', () => {
            const scrollPos = carousel.scrollLeft;
            const width = carousel.offsetWidth || 1;
            const newIdx = Math.round(scrollPos / width);
            if (newIdx !== currentAdIndex && newIdx < adCount) {
              currentAdIndex = newIdx;
              updateAdVideos();
              updateAdAudioButton();
              updateAdProgress();
              setupAdAutoplay();
            }
          });

          window.addEventListener('resize', () => {
            const width = carousel.offsetWidth;
            carousel.scrollTo({ left: currentAdIndex * width, behavior: 'auto' });
          });
        }
      }

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initAdCarouselFeatures);
      } else {
        initAdCarouselFeatures();
      }
    `;
  }

  if (ad.timerEnabled) {
    const duration = ad.timerDuration || 15;
    js += `
      let _adTimerStarted = false;
      function initAdTimerSetup() {
        if (!_adTimerStarted) {
          _adTimerStarted = true;
          startAdTimer(${duration});
        }
      }

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initAdTimerSetup);
      } else {
        initAdTimerSetup();
      }
      
      function startAdTimer(duration) {
        if (duration <= 0) return;
        const closeBtn = document.getElementById('adCloseBtn');
        const timerBadge = document.getElementById('adTimerBadge');
        
        if (closeBtn) closeBtn.style.display = 'none';
        if (timerBadge) {
          timerBadge.style.display = 'block';
          timerBadge.innerHTML = 'Aguarde ' + duration + 's...';
        }

        let count = duration;
        const timer = setInterval(() => {
          count--;
          if (timerBadge) {
            timerBadge.innerHTML = 'Aguarde ' + count + 's...';
          }
          if (count <= 0) {
            clearInterval(timer);
            if (timerBadge) timerBadge.style.display = 'none';
            if (closeBtn) closeBtn.style.display = 'flex';
          }
        }, 1000);
      }
    `;
  } else {
    js += `
      function initNoTimerSetup() {
        const closeBtn = document.getElementById('adCloseBtn');
        const timerBadge = document.getElementById('adTimerBadge');
        if (closeBtn) closeBtn.style.display = 'flex';
        if (timerBadge) timerBadge.style.display = 'none';
      }

      if (document.readyState === 'loading') {
        window.addEventListener('DOMContentLoaded', initNoTimerSetup);
      } else {
        initNoTimerSetup();
      }
    `;
  }

  return { css, html, js };
}

function generateEffectsMarkup(effects: any = {}, colors: any = {}, social: any = {}, badges: any = {}, customCode: any = {}, bg: any = {}) {
  const bgEffect = effects.bgEffect || 'none';
  const speed = effects.bgEffectSpeed || 'normal';
  const shape = effects.cardShape || 'rounded';
  const brand = colors.brand || '#2563eb';
  const brandDark = colors.brandDark || '#1d4ed8';
  const blue = colors.blue || '#2563eb';
  const green = colors.green || '#10b981';

  let bgHtml = '';
  let cssEffects = '';
  let jsEffects = '';

  if (bgEffect && bgEffect !== 'none') {
    const fx = getNicheEffectMarkup(bgEffect, speed, brand, brandDark, blue, green);
    bgHtml = fx.html;
    cssEffects += fx.css;
    jsEffects += fx.js;
    const effectiveBg = colors.bg || '#090a0f';
    cssEffects += `
html, body { background: ${effectiveBg} !important; background-color: ${effectiveBg} !important; }
.theme-layout, #wrapper, .bg-overlay, .background-overlay { background: transparent !important; background-color: transparent !important; background-image: none !important; }
#mg-app-root, form, .container, main, .main, .content { position: relative !important; z-index: 2 !important; }
#box, .login-card, .login-box, .card { position: relative !important; z-index: 10 !important; }
canvas#mg-fx-niche, canvas#mg-fx-canvas-matrix, canvas#mg-live-canvas, .mg-fx-canvas { position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; width: 100% !important; height: 100% !important; z-index: 1 !important; pointer-events: none !important; }
`;
    if (bg && bg.url) {
      cssEffects += `\n#mg-fx-niche, #mg-fx-canvas-particles, #mg-fx-canvas-matrix, #mg-fx-canvas-warp, #mg-fx-canvas-waves, #mg-fx-cybergrid, #mg-fx-orbs, #mg-fx-fireflies, #mg-fx-aurora { background: transparent !important; }\n`;
    }
  }

  // Card Shapes
  if (shape === 'square') {
    cssEffects += `#box, .login-card, .card { border-radius: 4px !important; clip-path: none !important; }\n`;
  } else if (shape === 'pill') {
    cssEffects += `#box, .login-card, .card { border-radius: 36px !important; clip-path: none !important; }\n`;
  } else if (shape === 'scifi-cut') {
    cssEffects += `#box, .login-card, .card { border-radius: 0 !important; clip-path: polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px)) !important; }\n`;
  } else {
    cssEffects += `#box, .login-card, .card { border-radius: 20px !important; clip-path: none !important; }\n`;
  }

  // Card Noise Texture
  if (effects.cardNoiseTexture) {
    cssEffects += `#box, .login-card, .card { background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 0) !important; background-size: 8px 8px !important; }\n`;
  }

  if (effects.cardGlowBorder) {
    cssEffects += `
#box, .login-card, .card {
  position: relative !important;
  box-shadow: 0 0 25px ${brand}40, inset 0 0 15px ${brand}20 !important;
}
#box::before, .login-card::before, .card::before {
  content: '';
  position: absolute;
  inset: -2px;
  border-radius: inherit;
  padding: 2px;
  background: linear-gradient(90deg, ${brand}, ${green}, ${blue}, ${brand});
  background-size: 300% 300%;
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: mgBorderBeam 4s linear infinite;
  pointer-events: none;
}
@keyframes mgBorderBeam {
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
}
`;
  }

  if (effects.cardTilt3d) {
    jsEffects += `
(function() {
  var card = document.getElementById('box') || document.querySelector('.login-card') || document.querySelector('.card');
  if (!card) return;
  card.style.transition = 'transform 0.15s ease-out';
  card.style.transformStyle = 'preserve-3d';

  function handleMove(e) {
    var rect = card.getBoundingClientRect();
    var clientX = e.clientX || (e.touches && e.touches[0].clientX);
    var clientY = e.clientY || (e.touches && e.touches[0].clientY);
    if (!clientX || !clientY) return;
    var x = clientX - rect.left - rect.width / 2;
    var y = clientY - rect.top - rect.height / 2;
    var maxTilt = 8;
    var tiltX = -(y / (rect.height / 2)) * maxTilt;
    var tiltY = (x / (rect.width / 2)) * maxTilt;
    card.style.transform = 'perspective(1000px) rotateX(' + tiltX + 'deg) rotateY(' + tiltY + 'deg) scale3d(1.01, 1.01, 1.01)';
  }

  function handleLeave() {
    card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)';
  }

  window.addEventListener('mousemove', handleMove);
  window.addEventListener('touchmove', handleMove);
  window.addEventListener('mouseleave', handleLeave);
  window.addEventListener('touchend', handleLeave);
})();
`;
  }

  if (effects.btnShimmer) {
    cssEffects += `
.btn-login, #btnSignup, button[type="submit"], input[type="submit"] {
  position: relative !important;
  overflow: hidden !important;
}
.btn-login::after, #btnSignup::after, button[type="submit"]::after {
  content: '' !important;
  position: absolute !important;
  top: -50% !important;
  left: -60% !important;
  width: 40% !important;
  height: 200% !important;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent) !important;
  transform: rotate(30deg) !important;
  animation: mgShimmerSweep 3.5s infinite !important;
  pointer-events: none !important;
}
@keyframes mgShimmerSweep {
  0% { left: -60%; }
  30% { left: 140%; }
  100% { left: 140%; }
}
`;
  }

  if (effects.btnPulse) {
    cssEffects += `
.btn-login, button[type="submit"], input[type="submit"] {
  animation: mgPulseGlow 2s infinite alternate !important;
}
@keyframes mgPulseGlow {
  0% { box-shadow: 0 0 5px ${blue}40; transform: scale(1); }
  100% { box-shadow: 0 0 20px ${blue}90; transform: scale(1.02); }
}
`;
  }

  if (effects.titleGradient) {
    cssEffects += `
#box h1, .card h1, #heading h1, .title {
  background: linear-gradient(135deg, ${brand}, ${green}, ${blue}, ${brand}) !important;
  background-size: 300% 300% !important;
  -webkit-background-clip: text !important;
  -webkit-text-fill-color: transparent !important;
  animation: mgTitleGradient 6s ease infinite alternate !important;
}
@keyframes mgTitleGradient {
  0% { background-position: 0% 50%; }
  100% { background-position: 100% 50%; }
}
`;
  }

  // Floating WhatsApp Support
  let socialHtml = '';
  if (social && social.whatsappEnabled && social.whatsappNumber) {
    const waMsg = encodeURIComponent(social.whatsappMessage || '');
    socialHtml += `
<a id="mg-floating-whatsapp" href="https://wa.me/${social.whatsappNumber}?text=${waMsg}" target="_blank" style="position:fixed; bottom:20px; right:20px; width:52px; height:52px; border-radius:50%; background:#25d366; color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(37,211,102,0.45); z-index:9999; text-decoration:none;">
  <svg style="width:28px;height:28px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z"/></svg>
</a>
`;
  }

  // Network Badges
  let badgesHtml = '';
  if (badges && (badges.showWifiSpeed || badges.showSecurityBadge || badges.showConnectedCount)) {
    let bInner = '';
    if (badges.showWifiSpeed) {
      bInner += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;padding:3px 8px;border-radius:12px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);">${badges.wifiSpeedText || '⚡ 5G WiFi'}</span>`;
    }
    if (badges.showSecurityBadge) {
      bInner += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;padding:3px 8px;border-radius:12px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);">${badges.securityText || '🔒 WPA3'}</span>`;
    }
    if (badges.showConnectedCount) {
      bInner += `<span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;font-weight:bold;padding:3px 8px;border-radius:12px;background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);">🟢 $(logged-in) online</span>`;
    }
    badgesHtml = `
<div id="mg-badges-bar" style="display:flex;flex-wrap:wrap;justify-content:center;gap:6px;margin-bottom:12px;">
  ${bInner}
</div>
`;
  }

  // Custom User CSS
  if (customCode && customCode.customCss) {
    cssEffects += `\n/* ====== USER CUSTOM CSS ====== */\n${customCode.customCss}\n`;
  }

  return `<!-- MIKROGESTOR EFFECTS -->
<link href="fonts/fonts.css" rel="stylesheet">
${bgHtml}
${socialHtml}
${badgesHtml}
<style>
${cssEffects}
</style>
<script>
${jsEffects}
</script>
<!-- END MIKROGESTOR EFFECTS -->`;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedTemplate = searchParams.get('template');
    
    let lastDeployedTemplate = null;
    let lastEditedTemplate = null;
    try {
      const [depRecord, editRecord] = await Promise.all([
        prisma.systemConfig.findUnique({ where: { key: 'LAST_DEPLOYED_TEMPLATE' } }),
        prisma.systemConfig.findUnique({ where: { key: 'LAST_EDITED_TEMPLATE' } })
      ]);
      if (depRecord?.value) lastDeployedTemplate = depRecord.value;
      if (editRecord?.value) lastEditedTemplate = editRecord.value;
    } catch (e) {
      console.warn('Erro ao ler LAST_DEPLOYED_TEMPLATE / LAST_EDITED_TEMPLATE:', e);
    }

    const template = requestedTemplate || lastDeployedTemplate || lastEditedTemplate || 'default';
    const { CONFIG_PATH } = getPaths(template);

    const defaultPortalUrl = getMaskedPortalUrl();
    let config = {
      ...DEFAULT_CONFIG,
      systemUrl: defaultPortalUrl
    };

    if (fs.existsSync(CONFIG_PATH)) {
      const fileContent = fs.readFileSync(CONFIG_PATH, 'utf8');
      const savedConfig = JSON.parse(fileContent);
      
      // If the saved URL is empty, contains raw IP, localhost, or portal.wifi.local (in VPS mode), update to masked domain
      if (!savedConfig.systemUrl || isVpsMode() || savedConfig.systemUrl.includes('portal.wifi.local') || /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?/i.test(savedConfig.systemUrl) || savedConfig.systemUrl.includes('localhost')) {
        savedConfig.systemUrl = defaultPortalUrl;
      }

      // Merge new schema fields in configuration properties
      savedConfig.enabled = savedConfig.enabled !== undefined ? savedConfig.enabled : true;
      savedConfig.redirectUrl = savedConfig.redirectUrl !== undefined ? savedConfig.redirectUrl : '';
      savedConfig.registerButtonText = savedConfig.registerButtonText !== undefined ? savedConfig.registerButtonText : 'Cadastre-se aqui';
      savedConfig.registerTitle = savedConfig.registerTitle !== undefined ? savedConfig.registerTitle : 'Wi-Fi Grátis';
      savedConfig.registerSubtitle = savedConfig.registerSubtitle !== undefined ? savedConfig.registerSubtitle : 'Cadastre-se abaixo para liberar o acesso à internet';
      savedConfig.registerSubmitText = savedConfig.registerSubmitText !== undefined ? savedConfig.registerSubmitText : 'Cadastrar e Conectar';
      savedConfig.termsText = savedConfig.termsText !== undefined ? savedConfig.termsText : 'Ao se cadastrar, você concorda com nossos Termos de Uso e Política de Privacidade.';
      savedConfig.trialEnabled = savedConfig.trialEnabled !== undefined ? savedConfig.trialEnabled : true;
      savedConfig.trialText = savedConfig.trialText !== undefined ? savedConfig.trialText : 'Acesso de teste disponível, ';
      savedConfig.trialLinkText = savedConfig.trialLinkText !== undefined ? savedConfig.trialLinkText : 'clique aqui';
      savedConfig.trialModalTitle = savedConfig.trialModalTitle !== undefined ? savedConfig.trialModalTitle : 'Acesso de Teste';
      savedConfig.trialModalMessage = savedConfig.trialModalMessage !== undefined ? savedConfig.trialModalMessage : 'Tem certeza de que deseja liberar o acesso grátis por 30 minutos?';
      savedConfig.trialModalConfirmText = savedConfig.trialModalConfirmText !== undefined ? savedConfig.trialModalConfirmText : 'Sim, Conectar';
      savedConfig.fields = { ...DEFAULT_CONFIG.fields, ...savedConfig.fields };
      savedConfig.effects = { ...DEFAULT_CONFIG.effects, ...savedConfig.effects };
      savedConfig.social = { ...DEFAULT_CONFIG.social, ...savedConfig.social };
      savedConfig.badges = { ...DEFAULT_CONFIG.badges, ...savedConfig.badges };
      savedConfig.customCode = { ...DEFAULT_CONFIG.customCode, ...savedConfig.customCode };
      savedConfig.studio = { ...DEFAULT_CONFIG.studio, ...savedConfig.studio };
      savedConfig.bg = { ...DEFAULT_CONFIG.bg, ...savedConfig.bg };
      savedConfig.ad = { ...DEFAULT_CONFIG.ad, ...savedConfig.ad };

      // Save updated configuration back to disk
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(savedConfig, null, 2), 'utf8');
      config = savedConfig;
    } else {
      // Create default config file if it does not exist
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf8');
    }

    // Carregar estado soberano de free_wifi_mode do sistema
    let systemFreeWifiMode = true;
    try {
      const freeWifiRecord = await prisma.systemConfig.findUnique({
        where: { key: 'free_wifi_mode' }
      });
      if (freeWifiRecord) {
        systemFreeWifiMode = freeWifiRecord.value === 'true';
      }
    } catch (e) {
      console.warn('Erro ao ler free_wifi_mode em GET /api/portal/config:', e);
    }

    return NextResponse.json({ 
      success: true, 
      template,
      lastDeployedTemplate,
      lastEditedTemplate,
      config: {
        ...config,
        systemFreeWifiMode,
        // Garante que o saleMode reflita coerentemente o modo do sistema se houver conflito
        saleMode: !systemFreeWifiMode && Boolean(config.saleMode)
      }
    });
  } catch (error: any) {
    console.error('Error fetching portal config:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const newConfig = await request.json();
    const template = searchParams.get('template') || newConfig.template || 'default';
    const { HOTSPOT_DIR, CONFIG_PATH, LOGIN_HTML_PATH } = getPaths(template);
    const safeName = template;
    
    const defaultPortalUrl = getMaskedPortalUrl();
    if (!newConfig.systemUrl || isVpsMode() || newConfig.systemUrl.includes('portal.wifi.local') || newConfig.systemUrl.includes('localhost') || /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?/i.test(newConfig.systemUrl)) {
      newConfig.systemUrl = defaultPortalUrl;
    }

    // Save configuration
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2), 'utf8');

    // Registrar template de trabalho para continuidade permanente
    try {
      await prisma.systemConfig.upsert({
        where: { key: 'LAST_EDITED_TEMPLATE' },
        update: { value: template },
        create: { key: 'LAST_EDITED_TEMPLATE', value: template }
      });
    } catch (e) {
      console.warn('Falha ao registrar LAST_EDITED_TEMPLATE no DB:', e);
    }

    if (newConfig.systemUrl) {
      await prisma.systemConfig.upsert({
        where: { key: 'SYSTEM_URL' },
        update: { value: newConfig.systemUrl },
        create: { key: 'SYSTEM_URL', value: newConfig.systemUrl }
      }).catch(() => null);
    }

    if (isVpsMode()) {
      const publicDomain = getPublicDomain() || 'mikrogestor.com';
      await prisma.systemConfig.upsert({
        where: { key: 'HOTSPOT_DNS_NAME' },
        update: { value: publicDomain },
        create: { key: 'HOTSPOT_DNS_NAME', value: publicDomain }
      }).catch(() => null);
    }

    const isFreeMode = newConfig.systemFreeWifiMode !== undefined
      ? Boolean(newConfig.systemFreeWifiMode)
      : (newConfig.saleMode !== undefined ? !newConfig.saleMode : undefined);

    if (isFreeMode !== undefined) {
      const modeValue = isFreeMode ? 'free' : 'paid';
      await Promise.all([
        prisma.systemConfig.upsert({
          where: { key: 'PORTAL_SALES_MODE' },
          update: { value: modeValue },
          create: { key: 'PORTAL_SALES_MODE', value: modeValue }
        }),
        prisma.systemConfig.upsert({
          where: { key: 'free_wifi_mode' },
          update: { value: isFreeMode ? 'true' : 'false' },
          create: { key: 'free_wifi_mode', value: isFreeMode ? 'true' : 'false' }
        })
      ]).catch(() => null);
    }

    // Clean unused ad uploads dynamically to prevent file pollution
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (fs.existsSync(uploadDir)) {
        const activeUrls = new Set<string>();
        
        // Add current config (since it may not be fully saved/synced yet)
        // Helper to safely extract absolute path from any url variant
        const getSafePath = (urlStr: string) => {
          if (!urlStr) return '';
          let u = urlStr.split('?')[0];
          if (u.startsWith('http')) {
            try { u = new URL(u).pathname; } catch (e) {}
          }
          return u;
        };

        if (newConfig.ad) {
          if (newConfig.ad.mediaUrl) {
            const sp = getSafePath(newConfig.ad.mediaUrl);
            if (sp) activeUrls.add(sp);
          }
          if (Array.isArray(newConfig.ad.items)) {
            newConfig.ad.items.forEach((item: any) => {
              if (item && item.url) {
                const sp = getSafePath(item.url);
                if (sp) activeUrls.add(sp);
              }
            });
          }
        }
        if (newConfig.bg && newConfig.bg.url) {
          const sp = getSafePath(newConfig.bg.url);
          if (sp) activeUrls.add(sp);
        }
        
        // Gather ALL active urls from ALL OTHER templates to prevent cross-template deletion
        const hotspotDir = path.join(process.cwd(), 'hotspot');
        if (fs.existsSync(hotspotDir)) {
          const templates = fs.readdirSync(hotspotDir);
          templates.forEach(tpl => {
            const cfgPath = path.join(hotspotDir, tpl, 'config.json');
            if (fs.existsSync(cfgPath)) {
              try {
                const tplConfig = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
                if (tplConfig.ad) {
                  if (tplConfig.ad.mediaUrl) {
                    const sp = getSafePath(tplConfig.ad.mediaUrl);
                    if (sp) activeUrls.add(sp);
                  }
                  if (Array.isArray(tplConfig.ad.items)) {
                    tplConfig.ad.items.forEach((item: any) => {
                      if (item && item.url) {
                        const sp = getSafePath(item.url);
                        if (sp) activeUrls.add(sp);
                      }
                    });
                  }
                }
                if (tplConfig.bg && tplConfig.bg.url) {
                  const sp = getSafePath(tplConfig.bg.url);
                  if (sp) activeUrls.add(sp);
                }
              } catch (e) {}
            }
          });
        }
        
        const files = fs.readdirSync(uploadDir);
        files.forEach(file => {
          if (file.startsWith('ad_') || file.startsWith('bg_')) {
            const fileUrl = `/uploads/${file}`;
            if (!activeUrls.has(fileUrl)) {
              try {
                fs.unlinkSync(path.join(uploadDir, file));
                console.log(`Auto-cleaned unused upload file: ${file}`);
              } catch (err) {}
            }
          }
        });
      }
    } catch (cleanupErr) {
      console.error('Failed to auto-clean unused ad ad uploads:', cleanupErr);
    }

    // If login.html exists, update its CSS variables and redirect URL
    if (fs.existsSync(LOGIN_HTML_PATH)) {
      let html = fs.readFileSync(LOGIN_HTML_PATH, 'utf8');
      html = normalizeHtmlStructure(html, template || 'default');
      html = html.replace(/onerror\s*=\s*["'][^"']*["']/gi, 'onerror="this.onerror=null;"');

      // Strip any stale debug overlay scripts injected by older compiled versions
      html = html.replace(/<div[^>]*id="mg-debug-overlay"[^>]*>[\s\S]*?<\/div>/gi, '');
      html = html.replace(/var debugOverlay[\s\S]*?debugOverlay\.innerText\s*=\s*[^;]+;/g, '');
      // Strip any accidentally compiled livePreviewScript blocks
      html = html.replace(/<!-- MG_LIVE_PREVIEW_SCRIPT -->[\s\S]*?<!-- END_MG_LIVE_PREVIEW_SCRIPT -->/gi, '');

      // ═══════════════════════════════════════════════════════════════
      // TEXT & CONTENT REPLACEMENT
      // ═══════════════════════════════════════════════════════════════
      const loginBtnLabel = newConfig.loginButtonLabel || 'Entrar';
      html = html.replace(/(<button[^>]*id=["']btnLogin["'][^>]*>)(.*?)(<\/button>)/i, `$1${loginBtnLabel}$3`);
      
      const msgText = newConfig.message || 'Bem-vindo à nossa rede gratuita. Insira o seu voucher para navegar.';
      html = html.replace(/(<div[^>]*class=["'][^"']*mg-message[^"']*["'][^>]*>)(.*?)(<\/div>)/i, `$1${msgText}$3`);

      // ═══════════════════════════════════════════════════════════════
      // THEME CSS COMPILATION (MIKROGESTOR_THEME_LINK)
      // ═══════════════════════════════════════════════════════════════
      const c = newConfig.colors || {};
      const studio = newConfig.studio || {};
      const brand = newConfig.brand || {};
      
      const brandColor = c.brand || '#f3d078';
      const brandDarkColor = c.brandDark || '#c49d3b';
      const bgColor = c.bg || '#141418';
      const inkColor = c.ink || '#ffffff';
      const mutedColor = c.muted || '#9a9aa8';
      const blueColor = c.blue || brandColor || '#f3d078';
      const greenColor = c.green || '#e5c158';
      const fontFamily = studio.fontFamily || 'Outfit';
      const rawGlass = c.glassOpacity !== undefined ? c.glassOpacity : 90;
      let opVal = (rawGlass <= 1 && rawGlass > 0) ? Math.round(rawGlass * 100) : Number(rawGlass);
      if (isNaN(opVal) || opVal < 0) opVal = 0;
      if (opVal > 100) opVal = 100;
      const glassOpacity = (opVal / 100).toFixed(2);
      const glassBlur = c.glassBlur !== undefined ? `${c.glassBlur}px` : '12px';
      
      // Card Setup
      const cardRadiusTL = studio.cardRadiusTL !== undefined ? `${studio.cardRadiusTL}px` : '20px';
      const cardRadiusTR = studio.cardRadiusTR !== undefined ? `${studio.cardRadiusTR}px` : '20px';
      const cardRadiusBR = studio.cardRadiusBR !== undefined ? `${studio.cardRadiusBR}px` : '20px';
      const cardRadiusBL = studio.cardRadiusBL !== undefined ? `${studio.cardRadiusBL}px` : '20px';
      const cardPaddingTop = studio.cardPaddingTop !== undefined ? `${studio.cardPaddingTop}px` : '24px';
      const cardPaddingRight = studio.cardPaddingRight !== undefined ? `${studio.cardPaddingRight}px` : '24px';
      const cardPaddingBottom = studio.cardPaddingBottom !== undefined ? `${studio.cardPaddingBottom}px` : '24px';
      const cardPaddingLeft = studio.cardPaddingLeft !== undefined ? `${studio.cardPaddingLeft}px` : '24px';
      const cardBorderWidth = studio.cardBorderWidth !== undefined ? `${studio.cardBorderWidth}px` : '1px';
      const cardGap = studio.cardGap !== undefined ? `${studio.cardGap}px` : '16px';
      
      // Button Setup
      const btnHeight = studio.btnHeight !== undefined ? `${studio.btnHeight}px` : '46px';
      const btnRadiusTL = studio.btnRadiusTL !== undefined ? `${studio.btnRadiusTL}px` : '12px';
      const btnRadiusTR = studio.btnRadiusTR !== undefined ? `${studio.btnRadiusTR}px` : '12px';
      const btnRadiusBR = studio.btnRadiusBR !== undefined ? `${studio.btnRadiusBR}px` : '12px';
      const btnRadiusBL = studio.btnRadiusBL !== undefined ? `${studio.btnRadiusBL}px` : '12px';
      const btnFontSize = studio.btnFontSize !== undefined ? `${studio.btnFontSize}px` : '14px';
      const btnFontWeight = studio.btnFontWeight || '600';
      const btnLetterSpacing = studio.btnLetterSpacing !== undefined ? `${studio.btnLetterSpacing}px` : '0.5px';
      const btnBorderWidth = studio.btnBorderWidth !== undefined ? `${studio.btnBorderWidth}px` : '0px';
      
      // Input Setup
      const inputHeight = studio.inputHeight !== undefined ? `${studio.inputHeight}px` : '44px';
      const inputRadius = studio.inputRadius !== undefined ? `${studio.inputRadius}px` : '10px';
      const inputBorderWidth = studio.inputBorderWidth !== undefined ? `${studio.inputBorderWidth}px` : '1px';

      // Typography Setup
      const titleFontSize = studio.titleFontSize !== undefined ? `${studio.titleFontSize}px` : '24px';
      const titleFontWeight = studio.titleFontWeight || '700';
      const titleLineHeight = studio.titleLineHeight !== undefined ? studio.titleLineHeight : '1.2';
      const titleLetterSpacing = studio.titleLetterSpacing !== undefined ? `${studio.titleLetterSpacing}px` : '0px';
      const titleAlign = studio.titleAlign || 'center';

      // Advanced Colors
      const trialBtnBg = c.trialButtonBg || '#1e90ff';
      const trialBtnText = c.trialButtonText || '#ffffff';
      const cardBorderColor = c.cardBorder || 'rgba(0,0,0,0.08)';
      const inputBgColor = c.inputBg || '#ffffff';
      const inputTextColor = c.inputText || '#0f172a';
      const inputBorderColor = c.inputBorder || '#e2e8f0';
      const inputPlaceholderColor = c.inputPlaceholder || '#94a3b8';
      const loginBtnText = c.loginButtonText || '#ffffff';
      const regBtnText = c.registerButtonText || '#ffffff';

      function hexToRgb(hex: string) {
        if (!hex) return '255, 255, 255';
        hex = hex.replace('#', '');
        if (hex.length === 3) hex = hex.split('').map(ch => ch + ch).join('');
        if (hex.length !== 6) return '255, 255, 255';
        const num = parseInt(hex, 16);
        return `${(num >> 16) & 255}, ${(num >> 8) & 255}, ${num & 255}`;
      }
      const cardBgRgb = hexToRgb(c.cardBg || '#ffffff');

      const themeCss = `
/* ==============================================
   MIKROGESTOR PORTAL CSS — GERADO DINAMICAMENTE
   ============================================== */
@import url('https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600;700&family=Inter:wght@400;600;700&family=Montserrat:wght@400;600;700&family=Outfit:wght@400;600;700&family=Poppins:wght@400;600;700&family=Roboto+Mono:wght@400;600;700&display=swap');

:root {
  --brand: ${brandColor};
  --brand-dark: ${brandDarkColor};
  --bg: ${bgColor};
  --ink: ${inkColor};
  --muted: ${mutedColor};
  --blue: ${blueColor};
  --green: ${greenColor};
  
  --trial-btn-bg: ${trialBtnBg};
  --trial-btn-text: ${trialBtnText};
  --card-border-color: ${cardBorderColor};
  --input-bg: ${inputBgColor};
  --input-text: ${inputTextColor};
  --input-border: ${inputBorderColor};
  --input-placeholder: ${inputPlaceholderColor};
  --login-btn-text: ${loginBtnText};
  --reg-btn-text: ${regBtnText};

  --font-family: '${fontFamily}', 'Outfit', 'Segoe UI', Roboto, Arial, sans-serif;
  --glass-opacity: ${glassOpacity};
  --glass-blur: ${glassBlur};
  --card-bg-rgb: ${cardBgRgb};
  
  /* Layout */
  --card-radius-tl: ${cardRadiusTL};
  --card-radius-tr: ${cardRadiusTR};
  --card-radius-br: ${cardRadiusBR};
  --card-radius-bl: ${cardRadiusBL};
  --card-padding-t: ${cardPaddingTop};
  --card-padding-r: ${cardPaddingRight};
  --card-padding-b: ${cardPaddingBottom};
  --card-padding-l: ${cardPaddingLeft};
  --card-border-width: ${cardBorderWidth};
  --card-gap: ${cardGap};
  
  /* Buttons */
  --btn-height: ${btnHeight};
  --btn-radius-tl: ${btnRadiusTL};
  --btn-radius-tr: ${btnRadiusTR};
  --btn-radius-br: ${btnRadiusBR};
  --btn-radius-bl: ${btnRadiusBL};
  --btn-font-size: ${btnFontSize};
  --btn-font-weight: ${btnFontWeight};
  --btn-letter-spacing: ${btnLetterSpacing};
  --btn-border-width: ${btnBorderWidth};
  
  /* Inputs */
  --input-height: ${inputHeight};
  --input-radius: ${inputRadius};
  --input-border-width: ${inputBorderWidth};

  /* Typography */
  --title-font-size: ${titleFontSize};
  --title-font-weight: ${titleFontWeight};
  --title-line-height: ${titleLineHeight};
  --title-letter-spacing: ${titleLetterSpacing};
  --title-align: ${titleAlign};

  --border-radius: ${cardRadiusTL}; /* Fallback for legacy */
  --glow-color: transparent;
}

*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  padding: 0;
  min-width: 300px;
  font-family: var(--font-family);
  background: var(--bg);
  min-height: 100vh;
  color: var(--ink);
}

  /* Background Video & Image full cover responsive without borders */
  #mg-bg-video {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    min-width: 100%;
    min-height: 100%;
    z-index: -2;
    object-fit: cover !important;
    object-position: center center !important;
    background-color: #000;
    pointer-events: none;
  }

  #mg-bg-image {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    width: 100vw;
    height: 100vh;
    min-width: 100%;
    min-height: 100%;
    z-index: -2;
    background-size: cover !important;
    background-position: center center !important;
    background-repeat: no-repeat !important;
    pointer-events: none;
  }

#mg-app-root, form, .container, main, .main, .content {
  position: relative !important;
  z-index: 1 !important;
}

#box {
  position: relative;
  z-index: 10 !important;
  background: rgba(var(--card-bg-rgb), var(--glass-opacity)) !important;
  backdrop-filter: blur(var(--glass-blur)) !important; -webkit-backdrop-filter: blur(var(--glass-blur)) !important;
  border-radius: var(--border-radius) !important; border: 1px solid rgba(255,255,255,0.25) !important;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06) !important;
  padding: 20px; margin: 40px auto 24px; max-width: 420px; width: calc(100% - 32px); padding-bottom: 24px;
}
.mg-wifi-icon { display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; width: 52px; height: 52px; border-radius: 50%; background: rgba(255,255,255,0.12); border: 1px solid rgba(255,255,255,0.18); }
.mg-wifi-icon svg { width: 26px; height: 26px; fill: var(--blue); }
.mg-message { text-align: center; font-size: 12px; color: var(--muted); margin-bottom: 16px; line-height: 1.5; }
.mg-input-wrap { position: relative; margin: 0 0 calc(var(--card-gap, 14px) * 0.75) 0 !important; }
.mg-input-wrap .mg-input-icon { position: absolute; left: 11px; top: 50%; transform: translateY(-50%); width: 16px; height: 16px; opacity: 0.45; pointer-events: none; }
.mg-input-wrap input { padding-left: 36px !important; }
.mg-eye-btn { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; padding: 4px; color: #9ca3af; display: flex; align-items: center; justify-content: center; touch-action: manipulation; }
.mg-eye-btn:focus { outline: none; }
.mg-eye-btn svg { width: 18px; height: 18px; }
#user, #pass {
  border: 1px solid rgba(226,232,240,0.7); color: #111827; background: rgba(248,250,252,0.92); height: var(--input-height, 44px); min-height: var(--input-height, 44px); font-size: 14px;
  font-family: var(--font-family); display: block; width: 100%; border-radius: var(--input-radius, 10px); padding: 0 40px 0 36px; margin: 0 0 calc(var(--card-gap, 14px) * 0.75) 0;
  -webkit-appearance: none; appearance: none; outline: none; transition: border-color 0.2s, box-shadow 0.2s;
}
#user { padding-right: 12px; }
#user:focus, #pass:focus { border-color: var(--brand); box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand) 20%, transparent); }
#user::placeholder, #pass::placeholder { color: #9ca3af; }
${newConfig.enabled !== false ? `.actions { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: var(--card-gap, 12px) !important; margin-top: var(--card-gap, 14px) !important; width: 100% !important; }` : `.actions { display: flex !important; flex-direction: column !important; gap: 0 !important; margin-top: var(--card-gap, 14px) !important; width: 100% !important; }
.actions .btn, .actions .btn-login, .actions #btnLogin { width: 100% !important; display: flex !important; }
#btnSignup, .btn-cad, .btn-register, a[href*="register"] {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  min-height: 0 !important;
  max-height: 0 !important;
  padding: 0 !important;
  margin: 0 !important;
  border: none !important;
  pointer-events: none !important;
  opacity: 0 !important;
  overflow: hidden !important;
}`}
.btn {
  -webkit-appearance: none; appearance: none; border: 0; height: var(--btn-height, 44px); min-height: var(--btn-height, 44px); border-radius: var(--btn-radius-tl, 10px); cursor: pointer; font-weight: var(--btn-font-weight, 600);
  font-size: var(--btn-font-size, 13px); letter-spacing: 0.3px; font-family: var(--font-family); width: 100%; display: flex !important; align-items: center; justify-content: center; gap: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.12), 0 1px 2px rgba(0,0,0,0.08); transition: filter 0.15s ease, transform 0.1s, box-shadow 0.15s; touch-action: manipulation; text-decoration: none;
  white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; padding: 0 8px !important;
}
.btn:hover { filter: brightness(0.94); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
.btn:active { transform: translateY(1px); box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
.btn-login { background: var(--blue) !important; color: #fff !important; }
.btn-cad { background: var(--green) !important; color: #fff !important; }
#trial-container { margin-top: calc(var(--card-gap, 14px) * 0.85) !important; width: 100% !important; display: flex; flex-direction: column; align-items: center; }
.footer { text-align: center; margin-top: var(--card-gap, 16px); padding-top: 12px; border-top: 1px solid rgba(128,128,128,0.15); font-size: 9px; color: var(--muted); opacity: 0.7; }
.footer a { text-decoration: none; color: var(--blue); }
.err {
  background: rgba(127,29,29,0.15); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; padding: 8px 12px; border-radius: 10px; margin: 12px auto 0;
  max-width: 420px; width: calc(100% - 32px); text-align: center; font-size: 13px;
}
@media (max-width: 480px) {
  #box { padding: 16px; }
  .actions { grid-template-columns: 1fr !important; gap: 12px !important; }
  #btnLogin + #btnSignup, .btn-submit + .btn-cad, .btn-submit + .btn-signup { margin-top: 12px !important; }
}
${newConfig.brand?.displayMode === 'none' ? `
#mg-brand-container, #mg-live-brand-container, .logo, #logo, .brand-logo, .edu-logo, .header-brand {
  display: none !important;
  visibility: hidden !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}
` : ''}
`;

      const colorsRegex = /(<!--\s*MIKROGESTOR_THEME_LINK\s*-->|<!--\s*MIKROGESTOR COLORS\s*-->)[\s\S]*?(<!--\s*END_MIKROGESTOR_THEME_LINK\s*-->|<!--\s*END MIKROGESTOR COLORS\s*-->)/i;
      const themeHtml = `<!-- MIKROGESTOR_THEME_LINK -->\n  <style id="mg-theme-css-inline">${themeCss}  </style>\n  <!-- END_MIKROGESTOR_THEME_LINK -->`;

      if (colorsRegex.test(html)) {
         html = html.replace(colorsRegex, themeHtml);
      } else if (html.includes('</head>')) {
         html = html.replace('</head>', `${themeHtml}\n</head>`);
      } else {
         html = `${themeHtml}\n` + html;
      }

      // Update Business Name in #business-name if present
      const bName = newConfig.brand?.titleText || newConfig.businessName;
      if (bName) {
        html = html.replace(/(<h2[^>]*id="business-name"[^>]*>)[^<]*(<\/h2>)/i, `$1${bName}$2`);
        html = html.replace(/(<title>)[^<]*(<\/title>)/i, `$1Hotspot - ${bName}$2`);
      }

      const dbSystemUrl = await prisma.systemConfig.findUnique({ where: { key: 'SYSTEM_URL' } });
      const fallbackUrl = getMaskedPortalUrl();
      let systemUrl = newConfig.systemUrl || dbSystemUrl?.value || fallbackUrl;
      if (isVpsMode() || /^https?:\/\/(\d{1,3}\.){3}\d{1,3}(:\d+)?/i.test(systemUrl) || systemUrl.includes('localhost') || systemUrl.includes('portal.wifi.local')) {
        systemUrl = fallbackUrl;
      }
      const MG_SERVER_BASE = systemUrl.replace(/\/$/, '');

      // ═══════════════════════════════════════════════════════════════
      // BRAND LOGO INJECTION & VISIBILITY PRESERVATION
      // ═══════════════════════════════════════════════════════════════
      const logoBlockRegex = /<!--\s*MIKROGESTOR_BRAND_LOGO\s*-->[\s\S]*?<!--\s*END_MIKROGESTOR_BRAND_LOGO\s*-->/i;
      const logoVisibilityRegex = /<!--\s*MIKROGESTOR_LOGO_VISIBILITY\s*-->[\s\S]*?<!--\s*END_MIKROGESTOR_LOGO_VISIBILITY\s*-->/i;
      const isLogoEnabled = newConfig.brand?.displayMode !== 'none';
      const hasNativeTemplateLogo = html.includes('edu-logo') || html.includes('header-brand');
      const explicitLogoUrl = newConfig.brand?.logoUrl ? String(newConfig.brand.logoUrl).trim() : '';

      // Gerenciar estilo de ocultação (sem eliminar código nativo/SVG do template)
      let visibilityHtml = '';
      if (!isLogoEnabled) {
        visibilityHtml = `<!-- MIKROGESTOR_LOGO_VISIBILITY -->\n<style id="mg-logo-visibility">#mg-brand-container, #mg-live-brand-container, .mg-brand-container, .logo, #logo, .brand-logo, .edu-logo, .header-brand { display: none !important; }</style>\n<!-- END_MIKROGESTOR_LOGO_VISIBILITY -->`;
      } else {
        visibilityHtml = `<!-- MIKROGESTOR_LOGO_VISIBILITY -->\n<!-- END_MIKROGESTOR_LOGO_VISIBILITY -->`;
      }

      if (logoVisibilityRegex.test(html)) {
        html = html.replace(logoVisibilityRegex, visibilityHtml);
      } else if (!isLogoEnabled) {
        if (html.includes('</head>')) {
          html = html.replace('</head>', `${visibilityHtml}\n</head>`);
        } else {
          html = visibilityHtml + html;
        }
      }

      let logoHtml = '';
      // Injeta container de imagem apenas se a logo estiver ativa E (não for template com logo nativa OU tiver logoUrl personalizada)
      if (isLogoEnabled && (!hasNativeTemplateLogo || explicitLogoUrl)) {
        const logoSrc = explicitLogoUrl
          ? (explicitLogoUrl.startsWith('http') ? explicitLogoUrl : `${MG_SERVER_BASE}${explicitLogoUrl.startsWith('/') ? '' : '/'}${explicitLogoUrl}`)
          : `${MG_SERVER_BASE}/api/portal/logo?template=${encodeURIComponent(template)}`;

        const lSize = newConfig.brand?.logoSize || 120;
        const lShape = newConfig.brand?.logoShape || 'rounded';
        const rad = lShape === 'circle' ? '50%' : (lShape === 'rounded' ? '12px' : '0');
        const lAlign = newConfig.brand?.textAlign || 'center';
        const justify = lAlign === 'left' ? 'flex-start' : (lAlign === 'right' ? 'flex-end' : 'center');
        logoHtml = `<!-- MIKROGESTOR_BRAND_LOGO -->\n<div id="mg-brand-container" class="mg-brand-container" style="display: flex; justify-content: ${justify}; align-items: center; margin-bottom: 20px; width: 100%; text-align: ${lAlign};">\n  <img src="${logoSrc}" class="logo brand-logo" alt="" style="max-width: ${lSize}px; max-height: ${lSize}px; width: auto; height: auto; border-radius: ${rad}; object-fit: contain; display: block;" onerror="this.style.display='none'; if (this.parentElement) this.parentElement.style.display='none';" />\n</div>\n<!-- END_MIKROGESTOR_BRAND_LOGO -->`;
      } else {
        logoHtml = `<!-- MIKROGESTOR_BRAND_LOGO -->\n<!-- END_MIKROGESTOR_BRAND_LOGO -->`;
      }

      if (logoBlockRegex.test(html)) {
        html = html.replace(logoBlockRegex, logoHtml);
      } else if (logoHtml.includes('<div id="mg-brand-container"')) {
        if (html.includes('<div id="box">')) {
          html = html.replace('<div id="box">', `<div id="box">\n        ${logoHtml}`);
        } else if (html.includes('<div class="login-card">')) {
          html = html.replace('<div class="login-card">', `<div class="login-card">\n        ${logoHtml}`);
        } else if (/<form[^>]*>/i.test(html)) {
          html = html.replace(/(<form[^>]*>)/i, `$1\n        ${logoHtml}`);
        }
      }

      if (!isLogoEnabled) {
        html = html.replace(/<div[^>]*id=["']mg-(?:live-)?brand-container["'][^>]*>[\s\S]*?<\/div>/gi, '');
      }

      const bgBlockRegex = /(<!--\s*MIKROGESTOR_BG_SCRIPT\s*-->|<!--\s*MIKROGESTOR BG\s*-->)[\s\S]*?(<!--\s*END_MIKROGESTOR_BG_SCRIPT\s*-->|<!--\s*END MIKROGESTOR BG\s*-->)/i;
      let bgHtml = '<!-- MIKROGESTOR_BG_SCRIPT -->\n';

      const hasBgMedia = Boolean(
        newConfig.bg &&
        newConfig.bg.url &&
        String(newConfig.bg.url).trim() !== '' &&
        newConfig.bg.type !== 'default' &&
        newConfig.bg.type !== 'none'
      );

      if (hasBgMedia) {
        const cleanBgUrl = newConfig.bg.url.split('?')[0];
        const isVideo = newConfig.bg.type === 'video' || cleanBgUrl.match(/\.(mp4|webm|ogg)$/i);
        const directAssetUrl = cleanBgUrl.startsWith('http') ? cleanBgUrl : (cleanBgUrl.startsWith('/') ? `${MG_SERVER_BASE}${cleanBgUrl}` : `${MG_SERVER_BASE}/${cleanBgUrl}`);

        if (isVideo) {
          bgHtml += `<video id="mg-bg-video" autoplay loop muted playsinline webkit-playsinline x5-playsinline preload="auto" poster="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 1 1'%3E%3C/svg%3E" style="position:fixed;top:0;left:0;right:0;bottom:0;width:100vw;height:100vh;min-width:100%;min-height:100%;object-fit:cover !important;object-position:center center !important;z-index:-2;background-color:#000;pointer-events:none;" disablepictureinpicture controlslist="nodownload no-fullscreen noremoteplayback">
  <source src="${directAssetUrl}" type="video/mp4">
</video>
<script>
  (function() {
    function mgInitVideo() {
      var v = document.getElementById('mg-bg-video');
      if (!v) return;
      v.muted = true;
      v.defaultMuted = true;
      v.playsInline = true;
      v.setAttribute('muted', '');
      v.setAttribute('playsinline', '');
      v.setAttribute('webkit-playsinline', '');
      v.setAttribute('poster', 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"%3E%3C/svg%3E');
      if (v.paused) {
        var p = v.play();
        if (p && typeof p.catch === 'function') {
          p.catch(function() {
            var unlock = function() {
              v.play().catch(function(){});
              document.removeEventListener('click', unlock);
              document.removeEventListener('touchstart', unlock);
            };
            document.addEventListener('click', unlock, { once: true });
            document.addEventListener('touchstart', unlock, { once: true });
          });
        }
      }
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', mgInitVideo);
    } else {
      mgInitVideo();
    }
    window.addEventListener('load', mgInitVideo);
  })();
</script>
`;
        } else {
          bgHtml += `<div id="mg-bg-image" style="position:fixed;right:0;bottom:0;min-width:100%;min-height:100%;width:100vw;height:100vh;z-index:-2;background-image:url('${directAssetUrl}');background-size:cover;background-position:center;background-repeat:no-repeat;pointer-events:none;"></div>
`;
        }
      } else {
        newConfig.bg = { type: 'default', url: '' };
        // Aggressively clean any lingering video or background image elements
        html = html.replace(/<video[^>]*id=["']mg-bg-video["'][^>]*>[\s\S]*?<\/video>/gi, '');
        html = html.replace(/<div[^>]*id=["']mg-bg-image["'][^>]*><\/div>/gi, '');
        html = html.replace(/<script[^>]*>[\s\S]*?mgInitVideo[\s\S]*?<\/script>/gi, '');
      }
      bgHtml += '<!-- END_MIKROGESTOR_BG_SCRIPT -->';

      if (bgBlockRegex.test(html)) {
        html = html.replace(bgBlockRegex, bgHtml);
      } else if (hasBgMedia) {
        html = html.replace(/(<body[^>]*>)/i, `$1\n  ${bgHtml}\n`);
      }

      // ═══════════════════════════════════════════════════════════════
      // EFFECTS & VISUAL NICHES INJECTION (MIKROGESTOR_EFFECTS)
      // ═══════════════════════════════════════════════════════════════
      const effectsMarkup = generateEffectsMarkup(
        newConfig.effects,
        newConfig.colors,
        newConfig.social,
        newConfig.badges,
        newConfig.customCode,
        newConfig.bg
      );

      const effectsBlockRegex = /<!--\s*MIKROGESTOR[_\s]EFFECTS\s*-->[\s\S]*?<!--\s*END[_\s]MIKROGESTOR[_\s]EFFECTS\s*-->/i;
      if (effectsBlockRegex.test(html)) {
        html = html.replace(effectsBlockRegex, effectsMarkup);
      } else {
        html = html.replace(/(<body[^>]*>)/i, `$1\n  ${effectsMarkup}\n`);
      }

      // ═══════════════════════════════════════════════════════════════
      // REGISTER BUTTON INJECTION (MIKROGESTOR_REGISTER_BTN)
      // ═══════════════════════════════════════════════════════════════
      const btnRegex = /(<!--\s*MIKROGESTOR_REGISTER_BTN\s*-->)[\s\S]*?(<!--\s*END_MIKROGESTOR_REGISTER_BTN\s*-->)/i;
      const isRegEnabled = newConfig.enabled !== false;
      const displayStyle = isRegEnabled
        ? 'display: flex !important;'
        : 'display: none !important; visibility: hidden !important; height: 0 !important; margin: 0 !important; padding: 0 !important; pointer-events: none !important;';
      const btnText = newConfig.registerButtonText || 'ACESSAR REDE VIP';
      const registerButtonHTML = `<!-- MIKROGESTOR_REGISTER_BTN -->\n<a id="btnSignup" class="btn btn-cad" href="${MG_SERVER_BASE}/portal/register?link-login-only=$$(link-login-only-esc)&link-orig=$$(link-orig-esc)" style="${displayStyle}">${btnText}</a>\n<!-- END_MIKROGESTOR_REGISTER_BTN -->`;

      if (btnRegex.test(html)) {
         html = html.replace(btnRegex, registerButtonHTML);
      } else {
         const oldBtnRegex = /(<a[^>]*id="btnSignup"[^>]*>|<button[^>]*id="btnSignup"[^>]*>)[\s\S]*?(<\/a>|<\/button>)/i;
         if (oldBtnRegex.test(html)) {
            html = html.replace(oldBtnRegex, registerButtonHTML);
         }
      }
      if (!isRegEnabled) {
        html = html.replace(/grid-template-columns:\s*1fr\s+1fr/gi, 'grid-template-columns: 1fr');
      }

      // ═══════════════════════════════════════════════════════════════
      // TRIAL BLOCK INJECTION (MIKROGESTOR_TRIAL_BLOCK)
      // ═══════════════════════════════════════════════════════════════
      const trialDisplay = newConfig.trialEnabled !== false ? 'block' : 'none';
      const trialText = newConfig.trialText !== undefined ? newConfig.trialText : 'Acesso de teste disponível, ';
      const trialLinkText = newConfig.trialLinkText || 'clique aqui';
      const trialConfirmMsg = newConfig.trialModalMessage || 'Confirmar acesso de teste?';

      const trialContainerRegex = /(<!--\s*MIKROGESTOR_TRIAL_BLOCK\s*-->)[\s\S]*?(<!--\s*END_MIKROGESTOR_TRIAL_BLOCK\s*-->)/i;
      const trialHtml = `<!-- MIKROGESTOR_TRIAL_BLOCK -->\n<div id="trial-container" style="display: ${trialDisplay}; text-align: center; font-size: 11px; margin-top: 12px; color: var(--muted);">\n$$(if trial == 'yes')\n<span class="trial-label">${trialText}</span><a href="javascript:void(0)" onclick="if(confirm('${trialConfirmMsg}')) confirmTrialLogin()" style="color: var(--blue); text-decoration: underline; font-weight: 600;">${trialLinkText}</a>.\n$$(endif)\n</div>\n<!-- END_MIKROGESTOR_TRIAL_BLOCK -->`;

      if (trialContainerRegex.test(html)) {
         html = html.replace(trialContainerRegex, trialHtml);
      } else {
         const oldTrialRegex = /<(span|div)\s+id="trial-container"[\s\S]*?<\/div>/i;
         if (oldTrialRegex.test(html)) {
             html = html.replace(oldTrialRegex, trialHtml);
         } else if (html.includes('<div class="footer">')) {
             html = html.replace('<div class="footer">', `<div class="footer">\n        ${trialHtml}`);
         } else {
             html = html.replace(/<\/form>/i, `\n\n${trialHtml}\n\n$&`);
         }
      }

      // Update trial modal texts based on configuration
      const tmTitle = newConfig.trialModalTitle || 'Acesso de Teste';
      const tmMsg = newConfig.trialModalMessage || 'Tem certeza de que deseja liberar o acesso grátis por 30 minutos?';
      const tmConfirm = newConfig.trialModalConfirmText || 'Sim, Conectar';
      const tmCancel = newConfig.trialModalCancelText || 'Não, Voltar';

      // Update comment-wrapped trial modal (legacy format)
      const tmRegex = /<!-- Trial Modal -->[\s\S]*?<!-- End Trial Modal -->/i;
      if (tmRegex.test(html)) {
        html = html.replace(
          tmRegex,
          `<!-- Trial Modal -->
  <div id="trial-modal" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(5px); justify-content: center; align-items: center; z-index: 9999; padding: 15px;">
    <div style="background: #fff; color: var(--ink); border-radius: 12px; max-width: 380px; width: 100%; padding: 20px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.2);">
      <h3 id="trial-modal-title" style="margin-top: 0; font-size: 18px; font-weight: bold; color: var(--brand);">${tmTitle}</h3>
      <p id="trial-modal-message" style="font-size: 13px; color: var(--muted); margin: 15px 0;">${tmMsg}</p>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 20px;">
        <button id="trial-modal-cancel" type="button" class="btn" style="background: #e5e7eb; color: #374151; font-size: 13px;" onclick="closeTrialModal()">${tmCancel}</button>
        <button id="trial-modal-confirm" type="button" class="btn btn-login" style="font-size: 13px;" onclick="confirmTrialLogin()">${tmConfirm}</button>
      </div>
    </div>
  </div>
  <!-- End Trial Modal -->`
        );
      } else {
        // Update id-based trial modal (new template format) - just update the text nodes
        html = html.replace(/(<h3[^>]*id="trialModalTitle"[^>]*>)[^<]*/i, `$1${tmTitle}`);
        html = html.replace(/(<p[^>]*id="trialModalMsg"[^>]*>)[^<]*/i,   `$1${tmMsg}`);
        html = html.replace(/(<button[^>]*id="trialCancelBtn"[^>]*>)[^<]*/i,  `$1${tmCancel}`);
        html = html.replace(/(<button[^>]*id="trialConfirmBtn"[^>]*>)[^<]*/i, `$1${tmConfirm}`);
      }


      // Compile and inject Ad Carousel & Timer dynamic elements
      const { css: adCSS, html: adHTML, js: adJS } = generateAdMarkup(newConfig.ad, newConfig.systemUrl, bName);
      
      const cssRegex = /(\/\*\s*AdCarouselStyles\s*\*\/)[\s\S]*?(\/\*\s*EndAdCarouselStyles\s*\*\/)/i;
      if (cssRegex.test(html)) {
        html = html.replace(cssRegex, (match, p1, p2) => `${p1}\n${adCSS}\n${p2}`);
      } else if (adCSS) {
        if (/<\/style>/i.test(html)) {
           html = html.replace(/(<\/style>)/i, `/* AdCarouselStyles */\n${adCSS}\n/* EndAdCarouselStyles */\n$1`);
        } else if (/<\/head>/i.test(html)) {
           html = html.replace(/(<\/head>)/i, `<style>\n/* AdCarouselStyles */\n${adCSS}\n/* EndAdCarouselStyles */\n</style>\n$1`);
        }
      }
      
      const htmlRegex = /(<!--\s*AdCarouselBlock\s*-->)[\s\S]*?(<!--\s*EndAdCarouselBlock\s*-->)/i;
      if (htmlRegex.test(html)) {
        html = html.replace(htmlRegex, (match, p1, p2) => `${p1}\n${adHTML}\n${p2}`);
      } else if (adHTML) {
        if (/<body[^>]*>/i.test(html)) {
           html = html.replace(/(<body[^>]*>)/i, `$1\n<!-- AdCarouselBlock -->\n${adHTML}\n<!-- EndAdCarouselBlock -->\n`);
        } else {
           html = `<!-- AdCarouselBlock -->\n${adHTML}\n<!-- EndAdCarouselBlock -->\n` + html;
        }
      }
      
      const jsRegex = /(\/\*\s*AdCarouselScript\s*\*\/)[\s\S]*?(\/\*\s*EndAdCarouselScript\s*\*\/)/i;
      if (jsRegex.test(html)) {
        html = html.replace(jsRegex, (match, p1, p2) => `${p1}\n${adJS}\n${p2}`);
      } else if (adJS) {
        if (/<\/body>/i.test(html)) {
           html = html.replace(/(<\/body>)/i, `<script>\n/* AdCarouselScript */\n${adJS}\n/* EndAdCarouselScript */\n</script>\n$1`);
        } else {
           html += `\n<script>\n/* AdCarouselScript */\n${adJS}\n/* EndAdCarouselScript */\n</script>\n`;
        }
      }

      // Sanitize any remaining portal.wifi.local or local IPs in login.html
      if (isVpsMode() || MG_SERVER_BASE.startsWith('http')) {
        html = html.replace(/https?:\/\/portal\.wifi\.local(:\d+)?/gi, MG_SERVER_BASE);
        html = html.replace(/https?:\/\/192\.168\.\d+\.\d+(:\d+)?/gi, MG_SERVER_BASE);
        html = html.replace(/https?:\/\/10\.\d+\.\d+\.\d+(:\d+)?/gi, MG_SERVER_BASE);
      }

      // Write changes back to login.html
      fs.writeFileSync(LOGIN_HTML_PATH, html, 'utf8');
    }

    return NextResponse.json({ success: true, message: 'Configurações salvas e aplicadas localmente.' });
  } catch (error: any) {
    console.error('Error updating portal config:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
