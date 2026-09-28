export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { getBrandEffectsStyles } from '@/lib/brand-effects-styles';
import { resolveTemplateDir, normalizeHtmlStructure } from '@/lib/portal-template-utils';
import { getNicheEffectMarkup } from '@/lib/niche-effects';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const template = searchParams.get('template') || 'default';
    const screen = searchParams.get('screen') || 'login';

    // Se o usuário solicitou a tela de cadastro no preview, redirecionar para a rota real de cadastro com preview=1
    if (screen === 'register') {
      const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || 'localhost';
      const proto = request.headers.get('x-forwarded-proto') || 'http';
      const cleanHost = host.split(':')[0] === '0.0.0.0' ? 'localhost' : host;
      const regUrl = new URL(`/portal/register?template=${encodeURIComponent(template)}&preview=1`, `${proto}://${cleanHost}`);
      return NextResponse.redirect(regUrl.toString());
    }

    const templateDir = resolveTemplateDir(template);
    const loginHtmlPath = path.join(templateDir, 'login.html');
    const configJsonPath = path.join(templateDir, 'config.json');

    if (!fs.existsSync(loginHtmlPath)) {
      return new NextResponse('<h1>Template não encontrado</h1>', { status: 404, headers: { 'Content-Type': 'text/html' } });
    }

    let html = fs.readFileSync(loginHtmlPath, 'utf8');
    html = normalizeHtmlStructure(html, template);
    let initialConfig: any = {};
    if (fs.existsSync(configJsonPath)) {
      try { initialConfig = JSON.parse(fs.readFileSync(configJsonPath, 'utf8')); } catch (e) {}
    }

    // Replace MikroTik conditional blocks: show "yes" branch for trial
    html = html.replace(/\$\(if trial == 'yes'\)([\s\S]*?)\$\(endif\)/gi, '$1');
    html = html.replace(/(id="trial-container"[^>]*style="[^"]*)display:\s*none;?/gi, '$1display: flex;');

    // Hide error block in preview (no actual error exists)
    html = html.replace(/\$\(if error\)[\s\S]*?\$\(endif\)/gi, '');

    // Replace remaining MikroTik variables with demo values
    html = html
      .replace(/\$\(username\)/g, 'demo_user')
      .replace(/\$\(error\)/g, '')
      .replace(/\$\(chap-id\)/g, '')
      .replace(/\$\(chap-challenge\)/g, '')
      .replace(/\$\(link-login-only\)/g, '#')
      .replace(/\$\(link-login-only-esc\)/g, '%23')
      .replace(/\$\(link-orig\)/g, 'http://google.com')
      .replace(/\$\(link-orig-esc\)/g, 'http%3A%2F%2Fgoogle.com')
      .replace(/\$\(mac\)/g, '9A:1E:3E:0D:8C:34')
      .replace(/\$\(mac-esc\)/g, '9A%3A1E%3A3E%3A0D%3A8C%3A34')
      .replace(/\$\(ip\)/g, '192.168.88.252')
      .replace(/\$\(trial\)/g, 'yes')
      .replace(/\$\(logged-in\)/g, '42')
      .replace(/\$\$\(if trial == 'yes'\)/g, '')
      .replace(/\$\$\(endif\)/g, '')
      .replace(/\$\$\(link-login-only\)/g, '#')
      .replace(/\$\$\(link-orig\)/g, 'http://google.com')
      .replace(/\$\([^)]*\)/g, '')
      .replace(/\$\$\([^)]*\)/g, '');

    // Replace broken or missing top-bar wifi-lock icons with self-contained crisp vector SVG
    const svgWifiIcon = `<svg style="height: 28px; width: 28px; fill: #ffffff;" viewBox="0 0 24 24"><path d="M12 3C6.95 3 2.5 5.56 0 9.42l2.36 2.36C4.12 8.44 7.78 6.5 12 6.5s7.88 1.94 9.64 5.28L24 9.42C21.5 5.56 17.05 3 12 3zm0 5c-3.31 0-6.29 1.52-8.25 3.91l2.36 2.36C7.39 12.87 9.53 12 12 12s4.61.87 5.89 2.27l2.36-2.36C18.29 9.52 15.31 8 12 8zm0 5c-1.38 0-2.5 1.12-2.5 2.5v.5H9c-.55 0-1 .45-1 1v4c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-4c0-.55-.45-1-1-1h-.5v-.5c0-1.38-1.12-2.5-2.5-2.5zm1 3h-2v-.5c0-.55.45-1 1-1s1 .45 1 1v.5z"/></svg>`;
    html = html.replace(/<img[^>]*wifi-lock\.png[^>]*>/gi, svgWifiIcon);

    // Sanitize onerror handlers to prevent infinite image loops
    html = html.replace(/onerror\s*=\s*["'][^"']*["']/gi, 'onerror="this.onerror=null;"');

    // 1. CRITICAL: Normalize any absolute URL pointing to uploads so the admin preview iframe loads it directly from localhost
    html = html.replace(/https?:\/\/[^\/"'\s\\]+\/uploads\//gi, '/uploads/');

    // When registration is disabled in initialConfig, enforce hidden state immediately on initial HTML
    const isInitialRegDisabled = initialConfig.enabled === false;
    const initialRegHideStyle = isInitialRegDisabled
      ? `<style id="mg-initial-cad-hide">#btnSignup, .btn-cad, .btn-register, a[href*="register"] { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; opacity: 0 !important; pointer-events: none !important; overflow: hidden !important; } .actions { grid-template-columns: 1fr !important; } .actions .btn, .actions .btn-login, .actions #btnLogin { width: 100% !important; }</style>`
      : '';
    if (isInitialRegDisabled) {
      html = html.replace(/(<a[^>]*id="btnSignup"[^>]*style=")[^"]*(")/gi, '$1display: none !important; visibility: hidden !important; height: 0 !important; margin: 0 !important; padding: 0 !important;$2');
      html = html.replace(/grid-template-columns:\s*1fr\s+1fr/gi, 'grid-template-columns: 1fr');
    }

    // When background media is not active in initialConfig, strip any lingering video/image elements
    const hasInitialMedia = Boolean(
      initialConfig.bg &&
      initialConfig.bg.url &&
      String(initialConfig.bg.url).trim() !== '' &&
      initialConfig.bg.type !== 'default' &&
      initialConfig.bg.type !== 'none'
    );
    if (!hasInitialMedia) {
      html = html.replace(/<video[^>]*id=["']mg-bg-video["'][^>]*>[\s\S]*?<\/video>/gi, '');
      html = html.replace(/<div[^>]*id=["']mg-bg-image["'][^>]*><\/div>/gi, '');
      html = html.replace(/<script[^>]*>[\s\S]*?mgInitVideo[\s\S]*?<\/script>/gi, '');
    }

    // When logo is disabled in initialConfig, enforce hidden state immediately on initial HTML
    const isInitialLogoDisabled = initialConfig.brand?.displayMode === 'none';
    const initialLogoHideStyle = isInitialLogoDisabled
      ? `<style id="mg-initial-logo-hide">#mg-live-brand-container, #mg-brand-container, .logo, #logo, .brand-logo, .edu-logo, .header-brand { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; opacity: 0 !important; pointer-events: none !important; overflow: hidden !important; }</style>`
      : '';

    // Remove duplicate fonts.css if already present in template
    html = html.replace(/<link\s+[^>]*href=["'](?:\/)?fonts\/fonts\.css["'][^>]*>/gi, '');

    // 2. Inject live styling hooks into <head> WITHOUT stripping the compiled effects/styles from login.html
    const fontsTags = `<link href="/fonts/fonts.css" rel="stylesheet">${initialRegHideStyle}${initialLogoHideStyle}<style id="mg-preview-ad-close-fix">#adCloseBtn, .ad-modal-close { display: flex !important; pointer-events: auto !important; cursor: pointer !important; z-index: 9999999 !important; }</style><style id="mg-live-injected-css"></style><style id="mg-live-studio-css"></style><style id="mg-live-colors-css"></style><style id="mg-live-bg-style"></style>`;
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${fontsTags}</head>`);
    } else {
      html = fontsTags + html;
    }

    // 3. Rewrite relative asset URLs (like logo.png, etc.)
    html = html.replace(
      /(src|href)="(?!https?:|\/\/|data:|javascript:|\/uploads\/|\/api\/|\/fonts\/)([^"]+)"/gi,
      (match, attr, filePath) => {
        if (filePath.startsWith('/')) return match;
        if (filePath.startsWith('fonts/')) return `${attr}="/${filePath}"`;
        return `${attr}="/api/portal/asset?template=${encodeURIComponent(template)}&file=${encodeURIComponent(filePath)}"`;
      }
    );

    html = html.replace(
      /this\.src\s*=\s*['"](?!https?:|\/\/|data:|javascript:|\/uploads\/|\/api\/|\/fonts\/)([^'"]+)['"]/gi,
      (match, filePath) => {
        if (filePath.startsWith('/')) return match;
        return `this.src='/api/portal/asset?template=${encodeURIComponent(template)}&file=${encodeURIComponent(filePath)}'`;
      }
    );

    const initialConfigJson = JSON.stringify(initialConfig || {});

    const livePreviewScript = `
<script>
  (function() {
    var activeRaf = null;
    var activeInterval = null;
    var activeEffectKey = '';
    var currentConfig = ${initialConfigJson};
    var pendingConfig = null;

    function clearActiveFX() {
      activeEffectKey = '';
      if (activeRaf) { cancelAnimationFrame(activeRaf); activeRaf = null; }
      if (activeInterval) { clearInterval(activeInterval); activeInterval = null; }
      var fxContainer = document.getElementById('mg-live-fx-container');
      if (fxContainer) fxContainer.innerHTML = '';
      var legacyCanvas = document.querySelectorAll('#mg-fx-niche, #mg-fx-canvas-particles, #mg-fx-canvas-matrix, #mg-fx-canvas-warp, #mg-fx-canvas-waves, #mg-fx-cybergrid, #mg-fx-orbs, #mg-fx-fireflies, #mg-fx-aurora, #mg-fx-aurora-canvas, #mg-fx-cybergrid-canvas, #mg-fx-orbs-canvas, #mg-fx-fireflies-canvas, #mg-live-canvas, .mg-fx-canvas');
      legacyCanvas.forEach(function(el) { el.remove(); });
      var prevScript = document.getElementById('mg-live-fx-script');
      if (prevScript) prevScript.remove();
      var prevStyle = document.getElementById('mg-live-fx-style');
      if (prevStyle) prevStyle.remove();
    }

    var getNicheEffectMarkup = ${getNicheEffectMarkup.toString()};

            function updateInjectedCss(cfg) {
      if (!cfg) return;
      var liveStyle = document.getElementById('mg-live-injected-css');
      if (!liveStyle) {
        liveStyle = document.createElement('style');
        liveStyle.id = 'mg-live-injected-css';
        document.head.appendChild(liveStyle);
      }
      var rules = [];
      var cardSelector = 'html body #box, html body .login-card, html body .login-box, html body .card';
      rules.push('#mg-app-root, form, .container, main, .main, .content { position: relative !important; z-index: 2 !important; }');
      rules.push(cardSelector + ' { position: relative !important; z-index: 10 !important; }');
      rules.push('html body .container { margin-top: 15px !important; padding-top: 0 !important; }');
      var btnSelector = 'html body .btn-login, html body #btnConnect, html body #btnSubmit, html body button[type="submit"], html body input[type="submit"]';
      var btnCadSelector = 'html body .btn-cad, html body #btnSignup, html body .btn-register';
      var btnTrialSelector = 'html body .btn-trial, html body button.btn-trial, html body a.btn-trial';
      var inpSelector = 'html body input[type="text"], html body input[type="password"], html body select, html body textarea, html body .form-input';
      var titleSelector = 'html body h1, html body h2, html body .brand-title, html body #businessName, html body .title, html body legend, html body .logo-text';
      
      var st = cfg.studio || {};
      var brand = (cfg.colors && (cfg.colors.blue || cfg.colors.brand)) || '#2563eb';
      var green = (cfg.colors && (cfg.colors.green || cfg.colors.btnSecondary)) || '#10b981';
      var blue = (cfg.colors && (cfg.colors.blue || cfg.colors.brand)) || '#2563eb';

      // Only apply explicit user overrides from Studio or Effects
      if (st.fontFamily && st.fontFamily !== 'Inter') {
        rules.push('body, input, button, select, textarea, h1, h2, h3, p, span { font-family: "' + st.fontFamily + '", sans-serif !important; }');
      }

      if (st.cardRadiusTL !== undefined && st.cardRadiusTR !== undefined) {
        rules.push(cardSelector + ' { border-radius: ' + st.cardRadiusTL + 'px ' + st.cardRadiusTR + 'px ' + st.cardRadiusBR + 'px ' + st.cardRadiusBL + 'px !important; clip-path: none !important; }');
      } else if (cfg.effects && cfg.effects.cardShape) {
        var shape = cfg.effects.cardShape;
        if (shape === 'square') {
          rules.push(cardSelector + ' { border-radius: 4px !important; clip-path: none !important; }');
        } else if (shape === 'pill') {
          rules.push(cardSelector + ' { border-radius: 36px !important; clip-path: none !important; }');
        } else if (shape === 'scifi-cut') {
          rules.push(cardSelector + ' { border-radius: 0 !important; clip-path: polygon(0 16px, 16px 0, calc(100% - 16px) 0, 100% 16px, 100% calc(100% - 16px), calc(100% - 16px) 100%, 16px 100%, 0 calc(100% - 16px)) !important; }');
        }
      }

      if (st.cardPaddingTop !== undefined && st.cardPaddingRight !== undefined) {
        rules.push(cardSelector + ' { padding: ' + st.cardPaddingTop + 'px ' + st.cardPaddingRight + 'px ' + st.cardPaddingBottom + 'px ' + st.cardPaddingLeft + 'px !important; }');
      }

      if (st.cardBorderWidth !== undefined && st.cardBorderWidth > 1) {
        rules.push(cardSelector + ' { border-width: ' + st.cardBorderWidth + 'px !important; border-style: ' + (st.cardBorderStyle || 'solid') + ' !important; }');
      }

      if (cfg.effects && cfg.effects.cardNoiseTexture) {
        rules.push(cardSelector + ' { background-image: radial-gradient(rgba(255,255,255,0.06) 1px, transparent 0) !important; background-size: 8px 8px !important; }');
      }
      if (cfg.effects && cfg.effects.cardGlowBorder) {
        rules.push(cardSelector + ' { box-shadow: 0 0 25px color-mix(in srgb, ' + brand + ' 40%, transparent) !important; border-color: ' + brand + ' !important; }');
      }

      var isRegEnabled = cfg.enabled !== false;
      var cardGapVal = (st.cardGap !== undefined && st.cardGap !== null) ? st.cardGap : 14;
      var inputGapVal = Math.max(8, Math.round(cardGapVal * 0.75));

      var brandCfg = cfg.brand || {};
      var isLogoEnabled = brandCfg.displayMode !== 'none';
      if (!isLogoEnabled) {
        rules.push('#mg-live-brand-container, #mg-brand-container, .logo, #logo, .brand-logo, .edu-logo, .header-brand { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; opacity: 0 !important; pointer-events: none !important; overflow: hidden !important; }');
      }

      rules.push(inpSelector + ' { margin-top: 0 !important; margin-bottom: ' + inputGapVal + 'px !important; }');
      rules.push('html body .mg-input-wrap { margin-top: 0 !important; margin-bottom: ' + inputGapVal + 'px !important; }');

      if (!isRegEnabled) {
        rules.push('html body #btnSignup, html body .btn-cad, html body .btn-register, html body a[href*="register"] { display: none !important; visibility: hidden !important; height: 0 !important; min-height: 0 !important; max-height: 0 !important; padding: 0 !important; margin: 0 !important; border: none !important; opacity: 0 !important; pointer-events: none !important; overflow: hidden !important; }');
        rules.push('html body .actions { display: flex !important; flex-direction: column !important; gap: 0 !important; margin-top: ' + cardGapVal + 'px !important; width: 100% !important; }');
        rules.push('html body .actions .btn, html body .actions .btn-login, html body .actions #btnLogin { width: 100% !important; }');
      } else {
        rules.push('html body #btnSignup, html body .btn-cad, html body .btn-register { display: flex !important; visibility: visible !important; width: 100% !important; }');
        rules.push('html body .actions { display: grid !important; grid-template-columns: 1fr 1fr !important; gap: ' + cardGapVal + 'px !important; margin-top: ' + cardGapVal + 'px !important; width: 100% !important; }');
        rules.push('@media (max-width: 480px) { html body .actions { grid-template-columns: 1fr !important; gap: 8px !important; } }');
      }

      var btnGroupSelector = isRegEnabled ? (btnSelector + ', ' + btnCadSelector + ', ' + btnTrialSelector) : (btnSelector + ', ' + btnTrialSelector);

      if (st.btnRadiusTL !== undefined && st.btnRadiusTR !== undefined) {
        rules.push(btnGroupSelector + ' { border-radius: ' + st.btnRadiusTL + 'px ' + st.btnRadiusTR + 'px ' + st.btnRadiusBR + 'px ' + st.btnRadiusBL + 'px !important; }');
      }
      if (st.btnHeight && st.btnHeight > 0) {
        rules.push(btnGroupSelector + ' { height: ' + st.btnHeight + 'px !important; min-height: ' + st.btnHeight + 'px !important; display: flex !important; align-items: center !important; justify-content: center !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; padding: 0 8px !important; }');
      } else {
        rules.push(btnGroupSelector + ' { white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; padding: 0 8px !important; }');
      }
      if (st.btnFontSize) {
        rules.push(btnGroupSelector + ' { font-size: ' + st.btnFontSize + 'px !important; }');
      }
      if (st.btnFontWeight) {
        rules.push(btnSelector + ' { font-weight: ' + st.btnFontWeight + ' !important; }');
      }
      if (st.btnLetterSpacing !== undefined) {
        rules.push(btnSelector + ' { letter-spacing: ' + st.btnLetterSpacing + 'px !important; }');
      }
      if (st.btnBorderWidth !== undefined) {
        rules.push(btnSelector + ' { border-width: ' + st.btnBorderWidth + 'px !important; }');
      }

      if (st.inputHeight) {
        rules.push(inpSelector + ' { height: ' + st.inputHeight + 'px !important; min-height: ' + st.inputHeight + 'px !important; }');
      }
      if (st.inputRadius !== undefined) {
        rules.push(inpSelector + ' { border-radius: ' + st.inputRadius + 'px !important; }');
      }
      if (st.inputBorderWidth !== undefined) {
        rules.push(inpSelector + ' { border-width: ' + st.inputBorderWidth + 'px !important; }');
      }

      if (st.titleFontSize) {
        rules.push(titleSelector + ' { font-size: ' + st.titleFontSize + 'px !important; }');
      }
      if (st.titleFontWeight) {
        rules.push(titleSelector + ' { font-weight: ' + st.titleFontWeight + ' !important; }');
      }
      if (st.titleLineHeight) {
        rules.push(titleSelector + ' { line-height: ' + st.titleLineHeight + ' !important; }');
      }
      if (st.titleLetterSpacing !== undefined) {
        rules.push(titleSelector + ' { letter-spacing: ' + st.titleLetterSpacing + 'px !important; }');
      }
      if (st.titleAlign) {
        rules.push(titleSelector + ' { text-align: ' + st.titleAlign + ' !important; }');
      }
      if (st.titleItalic !== undefined) {
        rules.push(titleSelector + ' { font-style: ' + (st.titleItalic ? 'italic' : 'normal') + ' !important; }');
      }
      if (st.titleUnderline !== undefined) {
        rules.push(titleSelector + ' { text-decoration: ' + (st.titleUnderline ? 'underline' : 'none') + ' !important; }');
      }

      if (cfg.effects && cfg.effects.btnShimmer) {
        var allBtns = btnSelector + ', ' + btnCadSelector + ', ' + btnTrialSelector;
        var btnAfterSelector = 'html body .btn-login::after, html body #btnConnect::after, html body #btnSubmit::after, html body button[type="submit"]::after, html body input[type="submit"]::after, html body .btn-cad::after, html body #btnSignup::after, html body .btn-register::after, html body .btn-trial::after';
        rules.push(allBtns + ' { position: relative !important; overflow: hidden !important; } ' + btnAfterSelector + ' { content:"" !important; position:absolute !important; top:-50% !important; left:-60% !important; width:40% !important; height:200% !important; background:linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent) !important; transform:rotate(30deg) !important; animation:mgShimmerSweep 3.5s infinite !important; pointer-events:none !important; }');
      }
      if (cfg.effects && cfg.effects.btnPulse) {
        rules.push(btnSelector + ' { animation: mgPulseGlow 2s infinite !important; }');
      }
      if (cfg.effects && cfg.effects.titleGradient) {
        rules.push(titleSelector + ' { background: linear-gradient(135deg, ' + brand + ', ' + green + ', ' + blue + ', ' + brand + ') !important; background-size: 300% 300% !important; -webkit-background-clip: text !important; -webkit-text-fill-color: transparent !important; animation: mgTitleGrad 6s ease infinite alternate !important; }');
      }

      rules.push('@keyframes mgShimmerSweep { 0% { left: -60%; } 20%, 100% { left: 160%; } }');
      rules.push('@keyframes mgPulseGlow { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 ' + brand + '40; } 50% { transform: scale(1.02); box-shadow: 0 0 15px 4px ' + brand + '80; } }');
      rules.push('@keyframes mgTitleGrad { 0% { background-position: 0% 50%; } 100% { background-position: 100% 50%; } }');
      rules.push('@keyframes mgGridMove { 0% { background-position: 0 0, 0 0, 0 0; } 100% { background-position: 0 0, 0 0, 0 80px; } }');
      rules.push('@keyframes mgAuroraFloat { 0% { transform: translate(0, 0) scale(1); } 50% { transform: translate(15%, 15%) scale(1.15) rotate(20deg); } 100% { transform: translate(-10%, 25%) scale(0.9) rotate(-15deg); } }');
      rules.push('@keyframes mgAuroraPulse { 0% { transform: scale(0.8); opacity:0.3; } 100% { transform: scale(1.2); opacity:0.6; } }');
      rules.push('@keyframes mgOrbFloat1 { 0% { top: 10%; left: 10%; } 50% { top: 60%; left: 70%; } 100% { top: 10%; left: 10%; } }');
      rules.push('@keyframes mgOrbFloat2 { 0% { top: 70%; left: 20%; } 50% { top: 20%; left: 80%; } 100% { top: 70%; left: 20%; } }');
      rules.push('@keyframes mgOrbFloat3 { 0% { top: 40%; left: 80%; } 50% { top: 75%; left: 30%; } 100% { top: 40%; left: 80%; } }');

      liveStyle.innerHTML = rules.join(' ');
    }

    function applyLiveConfig(config) {
      if (!config) return;
      if (!document.body) {
        pendingConfig = config;
        return;
      }
      currentConfig = config;
      updateInjectedCss(config);
      var root = document.documentElement;
      var brand = (config.colors && config.colors.brand) || '#2563eb';
      var brandDark = (config.colors && config.colors.brandDark) || '#1d4ed8';
      var green = (config.colors && config.colors.green) || '#10b981';
      var blue = (config.colors && config.colors.blue) || '#2563eb';

      // 1. Tokens CSS e Estilos Dinâmicos Instantâneos de Cores
      if (config.colors) {
        var c = config.colors;
        var primaryBtnBg = c.blue || c.brand || '#2563eb';
        var primaryBtnText = c.loginButtonText || c.brandDark || '#ffffff';
        var secondaryBtnBg = c.green || c.btnSecondary || '#10b981';
        var secondaryBtnText = c.registerButtonText || c.btnSecondaryText || '#ffffff';
        var trialBtnBg = c.trialButtonBg || c.btnTrial || '#1E90FF';
        var trialBtnText = c.trialButtonText || c.btnTrialText || '#FFFFFF';
        var cardBgColor = c.cardBg || '#ffffff';
        var cardBorderColor = c.cardBorder || 'rgba(0,0,0,0.08)';
        var inputBgColor = c.inputBg || '#ffffff';
        var inputTextColor = c.inputText || '#0f172a';
        var inputBorderColor = c.inputBorder || '#e2e8f0';
        var inputPlaceholderColor = c.inputPlaceholder || '#94a3b8';
        var inkColor = c.ink || '#0f172a';
        var mutedColor = c.muted || '#64748b';
        var pageBgColor = c.bg || '#0f172a';
        var rawOp = c.glassOpacity !== undefined ? c.glassOpacity : 90;
        var opVal = (rawOp <= 1 && rawOp > 0) ? Math.round(rawOp * 100) : Number(rawOp);
        if (isNaN(opVal) || opVal < 0) opVal = 0;
        if (opVal > 100) opVal = 100;
        var blVal = c.glassBlur !== undefined ? c.glassBlur : 8;

        function hexToRgbStr(hex) {
          if (!hex) return '39, 39, 42';
          hex = String(hex).replace('#', '');
          if (hex.length === 3) hex = hex.split('').map(function(ch) { return ch + ch; }).join('');
          if (hex.length !== 6) return '39, 39, 42';
          var num = parseInt(hex, 16);
          return ((num >> 16) & 255) + ', ' + ((num >> 8) & 255) + ', ' + (num & 255);
        }
        var cardBgRgbStr = hexToRgbStr(cardBgColor);
        var glassAlpha = (opVal / 100).toFixed(2);

        root.style.setProperty('--brand', primaryBtnBg);
        root.style.setProperty('--brand-dark', primaryBtnText);
        root.style.setProperty('--bg', pageBgColor);
        root.style.setProperty('--ink', inkColor);
        root.style.setProperty('--text-muted', mutedColor);
        root.style.setProperty('--muted', mutedColor);
        root.style.setProperty('--btn-primary', primaryBtnBg);
        root.style.setProperty('--btn-primary-text', primaryBtnText);
        root.style.setProperty('--btn-secondary', secondaryBtnBg);
        root.style.setProperty('--btn-secondary-text', secondaryBtnText);
        root.style.setProperty('--trialButtonBg', trialBtnBg);
        root.style.setProperty('--trialButtonText', trialBtnText);
        root.style.setProperty('--card-bg', cardBgColor);
        root.style.setProperty('--card-border', cardBorderColor);
        root.style.setProperty('--input-bg', inputBgColor);
        root.style.setProperty('--input-text', inputTextColor);
        root.style.setProperty('--input-border', inputBorderColor);
        root.style.setProperty('--input-placeholder', inputPlaceholderColor);
        root.style.setProperty('--glass-opacity', glassAlpha);
        root.style.setProperty('--glass-blur', blVal + 'px');
        root.style.setProperty('--card-bg-rgb', cardBgRgbStr);

        var liveColorsStyle = document.getElementById('mg-live-colors-css');
        if (!liveColorsStyle) {
          liveColorsStyle = document.createElement('style');
          liveColorsStyle.id = 'mg-live-colors-css';
          document.head.appendChild(liveColorsStyle);
        }

        var colorRules = [
          'html body #box, html body .card:not(.login-card), html body #card, html body form#login, html body .box-login, html body .login-panel { background: rgba(' + cardBgRgbStr + ', ' + glassAlpha + ') !important; border: 1px solid ' + cardBorderColor + ' !important; backdrop-filter: blur(' + blVal + 'px) !important; -webkit-backdrop-filter: blur(' + blVal + 'px) !important; }',
          'html body .login-card { border: 1px solid ' + cardBorderColor + ' !important; }',
          'html body .login-card .card-body { background: rgba(' + cardBgRgbStr + ', ' + glassAlpha + ') !important; }',
          'html body .btn-login, html body #btnConnect, html body #btnSubmit, html body button[type="submit"]:not(.btn-trial), html body input[type="submit"], html body .btn-primary { background-color: ' + primaryBtnBg + ' !important; color: ' + primaryBtnText + ' !important; border-color: ' + primaryBtnBg + ' !important; }',
          'html body #btnSignup, html body .btn-register, html body .btn-secondary, html body .btn-cad { background-color: ' + secondaryBtnBg + ' !important; color: ' + secondaryBtnText + ' !important; border-color: ' + secondaryBtnBg + ' !important; }',
          'html body #trial-container button, html body .btn-trial, html body button.btn-trial, html body a.btn-trial { background-color: ' + trialBtnBg + ' !important; color: ' + trialBtnText + ' !important; border-color: ' + trialBtnBg + ' !important; }',
          'html body input[type="text"], html body input[type="password"], html body select, html body textarea, html body .form-input { background-color: ' + inputBgColor + ' !important; color: ' + inputTextColor + ' !important; border-color: ' + inputBorderColor + ' !important; }',
          'html body input::placeholder { color: ' + inputPlaceholderColor + ' !important; opacity: 0.8 !important; }',
          'html body .card-body label, html body .input-group label { color: ' + inkColor + ' !important; }',
          'html body #box h1, html body #box h2, html body #box h3, html body .card h1, html body .card h2, html body .card h3, html body .title, html body .brand-title, html body #businessName, html body legend { color: ' + inkColor + ' !important; }',
          'html body #box p, html body .subtitle, html body .card p, html body .instructions, html body .text-muted, html body #welcomeMessage, html body p.message { color: ' + mutedColor + ' !important; }'
        ];

        liveColorsStyle.innerHTML = colorRules.join(' ');
      }

      // 2. Fundo Estático ou Vídeo (Background Media Layer)
      var customBg = document.getElementById('custom-bg-layer');
      if (!customBg && document.body) {
        customBg = document.createElement('div');
        customBg.id = 'custom-bg-layer';
        document.body.prepend(customBg);
      }
      
      var bgUrl = (config.bg && config.bg.url) ? config.bg.url : '';
      var bgType = (config.bg && config.bg.type) ? config.bg.type : 'default';
      var effect = (config.effects && config.effects.bgEffect) || 'none';
      var hasBgMedia = Boolean(bgUrl && String(bgUrl).trim() !== '') && bgType !== 'default' && bgType !== 'none';
      var isVideo = hasBgMedia && (bgType === 'video' || (bgUrl && bgUrl.match(/\.(mp4|webm|ogg)$/i)));

      if (hasBgMedia || effect !== 'none') {
        var cleanUrl = bgUrl;
        if (cleanUrl.startsWith('http')) {
          try { cleanUrl = new URL(cleanUrl).pathname; } catch(e) {}
        }
        if (cleanUrl.indexOf('/uploads/') !== -1) {
          // Extract direct path starting from /uploads/
          cleanUrl = cleanUrl.substring(cleanUrl.indexOf('/uploads/'));
        } else if (cleanUrl && !cleanUrl.startsWith('http') && !cleanUrl.startsWith('/')) {
          cleanUrl = '/api/portal/asset?template=' + encodeURIComponent(config.template || 'default') + '&file=' + encodeURIComponent(cleanUrl);
        }

        // Force html and body transparency so media/effects are 100% visible without hiding login box
        var bgStyle = document.getElementById('mg-live-bg-style');
        if (!bgStyle) {
          bgStyle = document.createElement('style');
          bgStyle.id = 'mg-live-bg-style';
          document.head.appendChild(bgStyle);
        }
        bgStyle.innerHTML = 'html, body, html body[class], body[class*="theme-"], #wrapper, .bg-overlay, .background-overlay, .theme-layout { background: transparent !important; background-color: transparent !important; background-image: none !important; }';

        if (hasBgMedia) {
          if (isVideo) {
            var existingVid = document.getElementById('mg-bg-video');
            var cleanBase = cleanUrl ? cleanUrl.split('?')[0] : '';
            if (existingVid) {
              var currentBase = existingVid.src ? existingVid.src.split('?')[0] : '';
              if (cleanBase && !currentBase.endsWith(cleanBase) && !cleanBase.endsWith(currentBase)) {
                existingVid.src = cleanUrl;
                existingVid.load();
              }
              existingVid.muted = true;
              existingVid.defaultMuted = true;
              existingVid.playsInline = true;
              existingVid.setAttribute('muted', '');
              existingVid.setAttribute('playsinline', '');
              existingVid.setAttribute('webkit-playsinline', '');
              existingVid.setAttribute('poster', 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7');
              if (existingVid.paused) {
                existingVid.play().catch(function() {});
              }
            } else {
              customBg.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; width:100vw; height:100vh; min-width:100%; min-height:100%; z-index:-2; pointer-events:none; overflow:hidden; display:block;';
              customBg.innerHTML = '<video autoplay muted loop playsinline webkit-playsinline x5-playsinline poster="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" id="mg-bg-video" style="position:fixed; top:0; left:0; right:0; bottom:0; width:100vw; height:100vh; min-width:100%; min-height:100%; object-fit:cover !important; object-position:center center !important; pointer-events:none; z-index:-2; background-color:#000;" src="' + cleanUrl + '"></video>';
              var vidEl = document.getElementById('mg-bg-video');
              if (vidEl) {
                vidEl.muted = true;
                vidEl.defaultMuted = true;
                vidEl.playsInline = true;
                vidEl.setAttribute('muted', '');
                vidEl.setAttribute('playsinline', '');
                vidEl.setAttribute('webkit-playsinline', '');
                vidEl.play().catch(function() {});
              }
            }
          } else {
            var allVids = document.querySelectorAll('#mg-bg-video, video');
            allVids.forEach(function(v) {
              if (v.id !== 'mg-ad-video') {
                try { v.pause(); } catch(e) {}
                v.remove();
              }
            });
            customBg.innerHTML = '';
            customBg.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; width:100vw; height:100vh; min-width:100%; min-height:100%; z-index:-2; pointer-events:none; background-image: url("' + cleanUrl + '") !important; background-size: cover !important; background-position: center center !important; background-repeat: no-repeat !important; display:block;';
          }
        } else {
          var allVids = document.querySelectorAll('#mg-bg-video, video');
          allVids.forEach(function(v) {
            if (v.id !== 'mg-ad-video') {
              try { v.pause(); } catch(e) {}
              v.remove();
            }
          });
          var existingImg = document.getElementById('mg-bg-image');
          if (existingImg) existingImg.remove();
          customBg.innerHTML = '';
          customBg.style.cssText = 'display:none;';
        }
      } else {
        var allVids = document.querySelectorAll('#mg-bg-video, video');
        allVids.forEach(function(v) {
          if (v.id !== 'mg-ad-video') {
            try { v.pause(); } catch(e) {}
            v.remove();
          }
        });
        var existingImg = document.getElementById('mg-bg-image');
        if (existingImg) existingImg.remove();
        customBg.innerHTML = '';
        customBg.style.cssText = 'display:none;';
        var bgStyle = document.getElementById('mg-live-bg-style');
        if (bgStyle) {
          bgStyle.innerHTML = 'html, body { background-color: ' + (config.colors && config.colors.bg ? config.colors.bg : '#0f172a') + ' !important; }';
        }
      }

      // 3. Efeitos & Animações Visuais em Tempo Real (Unified Engine: 100% Identical to login.html)
      var effect = (config.effects && config.effects.bgEffect) || 'none';
      var speed = (config.effects && config.effects.bgEffectSpeed) || 'normal';
      var brand = (config.colors && (config.colors.blue || config.colors.brand)) || '#2563eb';
      var brandDark = (config.colors && (config.colors.brandDark || config.colors.loginButtonText)) || '#1d4ed8';
      var blue = (config.colors && config.colors.blue) || '#2563eb';
      var green = (config.colors && (config.colors.green || config.colors.btnSecondary)) || '#10b981';
      var effectiveBg = (config.colors && config.colors.bg) || '#090a0f';
      var fxKey = effect + '|' + speed + '|' + brand + '|' + green + '|' + (hasBgMedia ? 'media' : 'nomedia');

      if (fxKey !== activeEffectKey) {
        clearActiveFX();
        activeEffectKey = fxKey;

        if (effect !== 'none') {
          var fx = getNicheEffectMarkup(effect, speed, brand, brandDark, blue, green);
          var fxStyle = document.createElement('style');
          fxStyle.id = 'mg-live-fx-style';
          fxStyle.innerHTML = (fx.css || '') +
            ' html, body { background: ' + effectiveBg + ' !important; background-color: ' + effectiveBg + ' !important; }' +
            ' .theme-layout, #wrapper, .bg-overlay, .background-overlay { background: transparent !important; background-color: transparent !important; background-image: none !important; }' +
            ' #mg-app-root, form, .container, main, .main, .content { position: relative !important; z-index: 2 !important; }' +
            ' #box, .login-card, .login-box, .card { position: relative !important; z-index: 10 !important; }' +
            (hasBgMedia ? ' canvas#mg-fx-niche, canvas#mg-fx-canvas-matrix, canvas#mg-live-canvas, .mg-fx-canvas { background: transparent !important; background-color: transparent !important; }' : '');
          document.head.appendChild(fxStyle);

          if (fx.html) {
            var temp = document.createElement('div');
            temp.innerHTML = fx.html;
            while (temp.firstChild) {
              document.body.prepend(temp.firstChild);
            }
          }
          if (fx.js) {
            var sc = document.createElement('script');
            sc.id = 'mg-live-fx-script';
            sc.textContent = fx.js;
            document.body.appendChild(sc);
          }
        }
      } else {
        // When canvas is already running, only update background style if needed
        var existingFxStyle = document.getElementById('mg-live-fx-style');
        if (existingFxStyle && effect !== 'none') {
          var fx = getNicheEffectMarkup(effect, speed, brand, brandDark, blue, green);
          existingFxStyle.innerHTML = (fx.css || '') +
            ' html, body { background: ' + effectiveBg + ' !important; background-color: ' + effectiveBg + ' !important; }' +
            ' .theme-layout, #wrapper, .bg-overlay, .background-overlay { background: transparent !important; background-color: transparent !important; background-image: none !important; }' +
            ' #mg-app-root, form, .container, main, .main, .content { position: relative !important; z-index: 2 !important; }' +
            ' #box, .login-card, .login-box, .card { position: relative !important; z-index: 10 !important; }' +
            (hasBgMedia ? ' canvas#mg-fx-niche, canvas#mg-fx-canvas-matrix, canvas#mg-live-canvas, .mg-fx-canvas { background: transparent !important; background-color: transparent !important; }' : '');
        }
      }

      // 4. Live Efeitos de Card, Formas, Botões e Tipografia (Studio Inspector)
      updateInjectedCss(config);

      // 5. Injetar CSS Pro do Usuário
      var userCssEl = document.getElementById('mg-user-custom-css');
      if (!userCssEl) {
        userCssEl = document.createElement('style');
        userCssEl.id = 'mg-user-custom-css';
        document.head.appendChild(userCssEl);
      }
      userCssEl.innerHTML = (config.customCode && config.customCode.customCss) || '';

      // 5. Faixa Superior (#heading) & Header Style
      var brandCfg = config.brand || {};
      var headingEl = document.getElementById('heading') || document.querySelector('header.top-bar') || document.querySelector('.header-bar');
      if (headingEl) {
        if (brandCfg.headerStyle === 'hidden') {
          headingEl.style.setProperty('display', 'none', 'important');
        } else {
          headingEl.style.removeProperty('display');
        }
      }

      // 5.2 Logo & Tipografia da Marca
      var displayMode = brandCfg.displayMode || 'image'; // 'image' | 'text' | 'both' | 'none'
      var logoEl = document.querySelector('.logo') || document.querySelector('#logo') || document.querySelector('img.brand-logo');
      var logoContainer = document.getElementById('mg-live-brand-container');

      if (displayMode === 'none') {
        if (logoContainer) {
          logoContainer.style.setProperty('display', 'none', 'important');
        }
        if (logoEl) {
          logoEl.style.setProperty('display', 'none', 'important');
        }
        var otherLogos = document.querySelectorAll('.logo, #logo, .brand-logo, .edu-logo, .header-brand');
        otherLogos.forEach(function(el) {
          el.style.setProperty('display', 'none', 'important');
        });
      } else {
        var otherLogos = document.querySelectorAll('.logo, #logo, .brand-logo, .edu-logo, .header-brand');
        otherLogos.forEach(function(el) {
          if (el !== logoEl && el !== logoContainer) {
            el.style.removeProperty('display');
          }
        });

        if (!logoContainer) {
          var targetBox = document.querySelector('#box') || document.querySelector('.card') || document.querySelector('.login-card') || document.querySelector('form') || document.body;
          if (logoEl && logoEl.parentNode) {
            logoContainer = document.createElement('div');
            logoContainer.id = 'mg-live-brand-container';
            logoContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 20px; width: 100%; text-align: center;';
            logoEl.parentNode.insertBefore(logoContainer, logoEl);
            logoContainer.appendChild(logoEl);
          } else if (targetBox) {
            logoContainer = document.createElement('div');
            logoContainer.id = 'mg-live-brand-container';
            logoContainer.style.cssText = 'display: flex; flex-direction: column; align-items: center; justify-content: center; margin-bottom: 20px; width: 100%; text-align: center;';
            targetBox.prepend(logoContainer);
          }
        }

        if (logoContainer) {
          logoContainer.style.removeProperty('display');
          logoContainer.style.display = 'flex';
          logoContainer.style.animation = 'none';
          var tAlign = brandCfg.textAlign || 'center';
          logoContainer.style.alignItems = tAlign === 'left' ? 'flex-start' : tAlign === 'right' ? 'flex-end' : 'center';
          logoContainer.style.textAlign = tAlign;

          if (!logoEl) {
            logoEl = document.createElement('img');
            logoEl.className = 'logo brand-logo';
            logoEl.alt = '';
            logoContainer.prepend(logoEl);
          }

          if (logoEl) {
            logoEl.onerror = function() {
              this.style.setProperty('display', 'none', 'important');
            };
            logoEl.onload = function() {
              this.style.setProperty('display', 'block', 'important');
            };

            var currentTmpl = config.template || 'default';
            var baseLogoUrl = '/api/portal/logo?template=' + currentTmpl;
            if (!logoEl.dataset.loadedTmpl || logoEl.dataset.loadedTmpl !== currentTmpl) {
              logoEl.dataset.loadedTmpl = currentTmpl;
              logoEl.src = baseLogoUrl + '&t=' + Date.now();
            }
            
            var lSize = brandCfg.logoSize || 120;
            var lPad = brandCfg.logoPadding || 0;
            var lShape = brandCfg.logoShape || 'rounded';
            var rad = lShape === 'circle' ? '50%' : (lShape === 'rounded' ? '12px' : '0');
            
            logoEl.style.setProperty('width', 'auto', 'important');
            logoEl.style.setProperty('max-width', lSize + 'px', 'important');
            logoEl.style.setProperty('max-height', lSize + 'px', 'important');
            logoEl.style.setProperty('padding', lPad + 'px', 'important');
            logoEl.style.setProperty('border-radius', rad, 'important');
            logoEl.style.setProperty('object-fit', 'contain', 'important');
            logoEl.style.setProperty('background', 'transparent', 'important');
            logoEl.style.setProperty('border', 'none', 'important');
            logoEl.style.setProperty('box-shadow', 'none', 'important');
            logoEl.style.setProperty('display', 'block', 'important');
          }
        }
      }

      var textEl = document.getElementById('mg-live-brand-text');
      if (textEl) {
        if (displayMode === 'text' || displayMode === 'both') {
          textEl.style.setProperty('display', 'block', 'important');
        } else {
          textEl.style.setProperty('display', 'none', 'important');
        }
      }

      // 6. Botão Flutuante de WhatsApp (Live Preview)
      var waBtn = document.getElementById('mg-floating-whatsapp');
      if (config.social && config.social.whatsappEnabled) {
        if (!waBtn) {
          waBtn = document.createElement('a');
          waBtn.id = 'mg-floating-whatsapp';
          waBtn.target = '_blank';
          waBtn.style.cssText = 'position:fixed; bottom:20px; right:20px; width:52px; height:52px; border-radius:50%; background:#25d366; color:#fff; display:flex; align-items:center; justify-content:center; box-shadow:0 6px 20px rgba(37,211,102,0.45); z-index:9999; text-decoration:none; transition:all 0.2s; cursor:pointer;';
          waBtn.innerHTML = '<svg style="width:28px;height:28px;" fill="currentColor" viewBox="0 0 24 24"><path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.77-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.86s.275.072.376-.043c.101-.116.433-.506.549-.68.116-.173.231-.145.39-.087s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z"/></svg>';
          document.body.appendChild(waBtn);
        }
        var waNum = config.social.whatsappNumber || '5511999999999';
        var msg = encodeURIComponent(config.social.whatsappMessage || 'Olá, preciso de suporte com o Wi-Fi.');
        waBtn.href = 'https://wa.me/' + waNum + '?text=' + msg;
        waBtn.style.display = 'flex';
      } else if (waBtn) {
        waBtn.style.display = 'none';
      }
      // 7. Badges de Status da Rede
      var badgeBar = document.getElementById('mg-badges-bar') || document.getElementById('mg-live-badges-bar');
      if (config.badges && (config.badges.showWifiSpeed || config.badges.showSecurityBadge || config.badges.showConnectedCount)) {
        if (!badgeBar) {
          badgeBar = document.createElement('div');
          badgeBar.id = 'mg-badges-bar';
          badgeBar.style.cssText = 'display:flex; flex-wrap:wrap; justify-content:center; gap:6px; margin-top:20px; margin-bottom:14px; width:100%;';
          var containerEl = document.querySelector('.container') || document.querySelector('#main') || document.body;
          if (containerEl) containerEl.appendChild(badgeBar);
        }
        var bHtml = '';
        if (config.badges.showWifiSpeed) {
          bHtml += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:bold;padding:4px 10px;border-radius:14px;background:rgba(16,185,129,0.15);color:#34d399;border:1px solid rgba(16,185,129,0.3);"><svg style=\"width:12px;height:12px;\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z\"></svg>' + (config.badges.wifiSpeedText || '⚡ 5G WiFi') + '</span>';
        }
        if (config.badges.showSecurityBadge) {
          bHtml += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:bold;padding:4px 10px;border-radius:14px;background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);"><svg style=\"width:12px;height:12px;\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" viewBox=\"0 0 24 24\"><path stroke-linecap=\"round\" stroke-linejoin=\"round\" d=\"M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z\"></svg>' + (config.badges.securityText || '🔒 WPA3') + '</span>';
        }
        if (config.badges.showConnectedCount) {
          bHtml += '<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:bold;padding:4px 10px;border-radius:14px;background:rgba(245,158,11,0.15);color:#fcd34d;border:1px solid rgba(245,158,11,0.3);">🟢 <span id="mg-online-count">' + (config.badges.connectedCountNumber || '42') + '</span> online</span>';
        }
        badgeBar.innerHTML = bHtml;
        badgeBar.style.display = 'flex';
      } else if (badgeBar) {
        badgeBar.style.display = 'none';
      }

      // 8. Atualizar Textos e Botões
      var actionsEl = document.querySelector('.actions');
      var isRegEnabled = config.enabled !== false;
      var cardGapVal = (config.studio && config.studio.cardGap !== undefined) ? config.studio.cardGap : 14;
      if (actionsEl) {
        if (isRegEnabled) {
          actionsEl.style.setProperty('display', 'grid', 'important');
          actionsEl.style.setProperty('grid-template-columns', '1fr 1fr', 'important');
          actionsEl.style.setProperty('gap', cardGapVal + 'px', 'important');
        } else {
          actionsEl.style.setProperty('display', 'flex', 'important');
          actionsEl.style.setProperty('flex-direction', 'column', 'important');
          actionsEl.style.setProperty('gap', '0', 'important');
        }
        actionsEl.style.setProperty('margin-top', cardGapVal + 'px', 'important');
        actionsEl.style.setProperty('width', '100%', 'important');
      }

      var btnLogin = document.querySelector('.btn-login') || document.querySelector('button[type="submit"]') || document.querySelector('#btnConnect');
      if (btnLogin) {
        btnLogin.style.setProperty('display', 'flex', 'important');
        btnLogin.style.setProperty('width', '100%', 'important');
        btnLogin.style.setProperty('align-items', 'center', 'important');
        btnLogin.style.setProperty('justify-content', 'center', 'important');
        if (config.loginButtonLabel !== undefined && config.loginButtonLabel !== '') {
          btnLogin.innerText = config.loginButtonLabel;
        } else if (!btnLogin.innerText || btnLogin.innerText.trim() === '') {
          btnLogin.innerText = 'Conectar';
        }
      }

      var btnSignup = document.getElementById('btnSignup') || document.querySelector('.btn-register') || document.querySelector('a[href*="register"]');
      if (!btnSignup && actionsEl && config.enabled !== false) {
        btnSignup = document.createElement('button');
        btnSignup.id = 'btnSignup';
        btnSignup.type = 'button';
        btnSignup.className = 'btn btn-cad';
        btnSignup.style.cssText = 'display: flex; width: 100%; border-radius: 8px; padding: 10px; cursor: pointer; font-weight: bold; border: none; font-size: 14px; background: var(--btn-secondary, #34d399); color: #fff; align-items: center; justify-content: center;';
        btnSignup.onclick = function() {
          var loader = document.getElementById('mg-instant-loader');
          if (loader) loader.style.display = 'flex';
        };
        actionsEl.appendChild(btnSignup);
      }
      var isRegEnabled = config.enabled !== false;
      if (btnSignup) {
        if (!isRegEnabled) {
          btnSignup.style.setProperty('display', 'none', 'important');
          btnSignup.style.setProperty('visibility', 'hidden', 'important');
          btnSignup.style.setProperty('height', '0', 'important');
          btnSignup.style.setProperty('min-height', '0', 'important');
          btnSignup.style.setProperty('max-height', '0', 'important');
          btnSignup.style.setProperty('padding', '0', 'important');
          btnSignup.style.setProperty('margin', '0', 'important');
          btnSignup.style.setProperty('border', 'none', 'important');
          btnSignup.style.setProperty('opacity', '0', 'important');
          btnSignup.style.setProperty('pointer-events', 'none', 'important');
          btnSignup.style.setProperty('overflow', 'hidden', 'important');
        } else {
          btnSignup.style.setProperty('display', 'flex', 'important');
          btnSignup.style.setProperty('visibility', 'visible', 'important');
          btnSignup.style.removeProperty('height');
          btnSignup.style.removeProperty('min-height');
          btnSignup.style.removeProperty('max-height');
          btnSignup.style.removeProperty('padding');
          btnSignup.style.removeProperty('margin');
          btnSignup.style.removeProperty('border');
          btnSignup.style.removeProperty('opacity');
          btnSignup.style.removeProperty('pointer-events');
          btnSignup.style.removeProperty('overflow');
          btnSignup.style.setProperty('width', '100%', 'important');
          btnSignup.style.setProperty('align-items', 'center', 'important');
          btnSignup.style.setProperty('justify-content', 'center', 'important');
          btnSignup.innerText = config.registerButtonText || 'Cadastre-se aqui';
        }
      }

      var businessName = document.getElementById('businessName') || document.querySelector('.brand-title') || document.querySelector('h1');
      if (businessName && config.businessName) businessName.innerText = config.businessName;

      var welcomeMessage = document.getElementById('welcomeMessage') || document.querySelector('.welcome-msg') || document.querySelector('p.message');
      if (welcomeMessage && config.message) welcomeMessage.innerText = config.message;
      
      var trialContainer = document.getElementById('trial-container');
      if (!trialContainer && config.trialEnabled !== false) {
        var boxEl = document.querySelector('#box, .login-card, .card, form');
        if (boxEl) {
          var footerEl = boxEl.querySelector('.footer');
          trialContainer = document.createElement('div');
          trialContainer.id = 'trial-container';
          if (footerEl) {
            footerEl.parentNode.insertBefore(trialContainer, footerEl);
          } else {
            boxEl.appendChild(trialContainer);
          }
        }
      }
      if (trialContainer) {
        if (config.trialEnabled === false) {
          trialContainer.style.setProperty('display', 'none', 'important');
        } else {
          trialContainer.style.setProperty('display', 'block', 'important');
          trialContainer.style.setProperty('text-align', 'center', 'important');
          trialContainer.style.setProperty('font-size', '11px', 'important');
          trialContainer.style.setProperty('margin-top', '12px', 'important');
          trialContainer.style.setProperty('color', 'var(--muted)', 'important');
          
          var tText = config.trialText !== undefined ? config.trialText : 'Acesso de teste disponível, ';
          var tLinkText = config.trialLinkText !== undefined ? config.trialLinkText : 'clique aqui';
          var tConfirm = config.trialModalMsg || config.trialModalMessage || 'Confirmar acesso de teste?';

          var trialLink = trialContainer.querySelector('a');
          if (!trialLink) {
            trialLink = document.createElement('a');
            trialLink.href = 'javascript:void(0)';
            trialLink.style.cssText = 'color: var(--blue); text-decoration: underline; font-weight: 600;';
            trialLink.onclick = function() {
              if (confirm(tConfirm)) {
                if (typeof confirmTrialLogin === 'function') confirmTrialLogin();
              }
            };
            trialContainer.appendChild(trialLink);
          }
          trialLink.innerText = tLinkText;

          // Remove nós de texto soltos para evitar qualquer duplicação
          var childNodes = Array.prototype.slice.call(trialContainer.childNodes);
          childNodes.forEach(function(node) {
            if (node.nodeType === 3) {
              node.parentNode && node.parentNode.removeChild(node);
            }
          });

          var labelSpan = trialContainer.querySelector('.trial-label');
          if (!labelSpan) {
            labelSpan = document.createElement('span');
            labelSpan.className = 'trial-label';
            trialContainer.insertBefore(labelSpan, trialLink);
          }
          labelSpan.innerText = tText;
        }
      }

      var tTitle = document.getElementById('trialModalTitle') || document.getElementById('trial-modal-title');
      if (tTitle && config.trialModalTitle !== undefined) tTitle.innerText = config.trialModalTitle;
      var tMsg = document.getElementById('trialModalMsg') || document.getElementById('trial-modal-message');
      if (tMsg && config.trialModalMsg !== undefined) tMsg.innerText = config.trialModalMsg;
      var tCancel = document.getElementById('trialCancelBtn') || document.getElementById('trial-modal-cancel');
      if (tCancel && config.trialModalCancelText !== undefined) tCancel.innerText = config.trialModalCancelText;
      var tConfirm = document.getElementById('trialConfirmBtn') || document.getElementById('trial-modal-confirm');
      if (tConfirm && config.trialModalConfirmText !== undefined) {
        tConfirm.innerText = config.trialModalConfirmText;
        tConfirm.setAttribute('data-orig-text', config.trialModalConfirmText);
      }

      // 9. STUDIO PRO LIVE CSS ENGINE (Tipografia, Cantos, Formas, Alturas, Espaçamentos)
      if (config.studio || config.effects) {
        var st = config.studio || {};
        var ef = config.effects || {};
        var styleStudio = document.getElementById('mg-live-studio-css');
        if (!styleStudio) {
          styleStudio = document.createElement('style');
          styleStudio.id = 'mg-live-studio-css';
          document.head.appendChild(styleStudio);
        }

        var fontCss = st.fontFamily ? 'font-family: "' + st.fontFamily + '", sans-serif !important;' : '';
        var titleAlignCss = st.titleAlign ? 'text-align: ' + st.titleAlign + ' !important; justify-content: ' + (st.titleAlign === 'left' ? 'flex-start' : st.titleAlign === 'right' ? 'flex-end' : 'center') + ' !important;' : '';
        var titleSizeCss = st.titleFontSize ? 'font-size: ' + st.titleFontSize + 'px !important;' : '';
        var titleWeightCss = st.titleFontWeight ? 'font-weight: ' + st.titleFontWeight + ' !important;' : '';

        var btnHeightCss = st.btnHeight ? 'height: ' + st.btnHeight + 'px !important; min-height: ' + st.btnHeight + 'px !important; display: flex !important; align-items: center !important; justify-content: center !important;' : '';
        var btnRadiusCss = (st.btnRadiusTL !== undefined) ? 'border-radius: ' + st.btnRadiusTL + 'px ' + st.btnRadiusTR + 'px ' + st.btnRadiusBR + 'px ' + st.btnRadiusBL + 'px !important;' : '';
        var cardRadiusCss = (st.cardRadiusTL !== undefined) ? 'border-radius: ' + st.cardRadiusTL + 'px ' + st.cardRadiusTR + 'px ' + st.cardRadiusBR + 'px ' + st.cardRadiusBL + 'px !important;' : '';
        var cardPaddingCss = (st.cardPaddingTop !== undefined) ? 'padding: ' + st.cardPaddingTop + 'px ' + st.cardPaddingRight + 'px ' + st.cardPaddingBottom + 'px ' + st.cardPaddingLeft + 'px !important;' : '';
        var cardGapCss = st.cardGap ? 'gap: ' + st.cardGap + 'px !important;' : '';
        var inputRadiusCss = (st.inputRadius !== undefined) ? 'border-radius: ' + st.inputRadius + 'px !important;' : '';

        var cardShapeClip = '';
        if (ef.cardShape === 'scifi-cut') {
          cardShapeClip = 'clip-path: polygon(0 14px, 14px 0, calc(100% - 14px) 0, 100% 14px, 100% calc(100% - 14px), calc(100% - 14px) 100%, 14px 100%, 0 calc(100% - 14px)) !important;';
        }

        var cardGlowCss = ef.cardGlowBorder ? 'box-shadow: 0 0 25px rgba(6, 182, 212, 0.4), inset 0 0 15px rgba(6, 182, 212, 0.2) !important; border-color: rgba(6, 182, 212, 0.8) !important;' : '';
        var btnPulseCss = ef.btnPulse ? 'animation: mgBtnPulse 1.8s infinite ease-in-out !important;' : '';

        var cardSelector = 'html body #box, html body .login-card, html body .login-box';
        var btnSelector = 'html body .btn-login, html body #btnConnect, html body #btnSubmit, html body button[type="submit"]' + (config.enabled !== false ? ', html body .btn-cad, html body #btnSignup, html body .btn-register' : '') + ', html body .btn-trial';
        var inpSelector = 'html body input[type="text"], html body input[type="password"], html body select, html body textarea, html body .form-input';
        var titleSelector = 'html body h1, html body h2, html body .brand-title, html body #businessName, html body .title, html body legend, html body .logo-text';

        var inputMarginBottom = Math.max(8, Math.round((st.cardGap || 14) * 0.75));

        styleStudio.innerHTML = 
          'html body, html body button, html body input, html body select, html body textarea, ' + cardSelector + ' { ' + fontCss + ' } ' +
          titleSelector + ' { ' + titleSizeCss + ' ' + titleAlignCss + ' ' + titleWeightCss + ' } ' +
          cardSelector + ' { ' + cardRadiusCss + ' ' + cardPaddingCss + ' ' + cardShapeClip + ' ' + cardGlowCss + ' } ' +
          'html body #box .actions, html body form .actions, html body .actions { ' + cardGapCss + ' margin-top: ' + (st.cardGap || 14) + 'px !important; } ' +
          btnSelector + ' { ' + btnHeightCss + ' ' + btnRadiusCss + ' ' + btnPulseCss + ' } ' +
          inpSelector + ' { ' + inputRadiusCss + ' margin-top: 0 !important; margin-bottom: ' + inputMarginBottom + 'px !important; } ' +
          'html body .mg-input-wrap { margin-top: 0 !important; margin-bottom: ' + inputMarginBottom + 'px !important; } ' +
          '@keyframes mgBtnPulse { 0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(6, 182, 212, 0.4); } 50% { transform: scale(1.02); box-shadow: 0 0 16px 4px rgba(6, 182, 212, 0.6); } } ' +
          '@keyframes mgMetalShine { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } } ' +
          '@keyframes mgNeonFlicker { 0%, 100% { opacity: 1; filter: brightness(1); } 50% { opacity: 0.85; filter: brightness(1.25); } } ' +
          '@keyframes mgGoldSweep { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } } ' +
          '@keyframes mgGlitch { 0%, 100% { transform: translate(0); } 20% { transform: translate(-2px, 2px); } 40% { transform: translate(-2px, -2px); } 60% { transform: translate(2px, 2px); } 80% { transform: translate(2px, -2px); } } ' +
          '@keyframes mgFirePulse { 0% { filter: drop-shadow(0 -2px 6px rgba(249,115,22,0.6)); } 100% { filter: drop-shadow(0 -4px 14px rgba(249,115,22,0.95)); } } ' +
          '@keyframes mgRainbowHolo { 0% { background-position: 0% 50%; } 100% { background-position: 300% 50%; } } ' +
          '@keyframes mgFadeZoom { 0% { opacity: 0; transform: scale(0.35); filter: blur(6px); } 60% { transform: scale(1.08); filter: blur(0); } 100% { opacity: 1; transform: scale(1); filter: blur(0); } } ' +
          '@keyframes mgSlideUp3D { 0% { opacity: 0; transform: perspective(600px) translateY(50px) rotateX(30deg); filter: blur(6px); } 100% { opacity: 1; transform: perspective(600px) translateY(0) rotateX(0deg); filter: blur(0); } } ' +
          '@keyframes mgSlideDownBounce { 0% { opacity: 0; transform: translateY(-70px); } 55% { transform: translateY(14px); } 75% { transform: translateY(-6px); } 90% { transform: translateY(3px); } 100% { opacity: 1; transform: translateY(0); } } ' +
          '@keyframes mgTypewriter { 0% { opacity: 0; clip-path: inset(0 100% 0 0); filter: blur(4px); } 100% { opacity: 1; clip-path: inset(0 0 0 0); filter: blur(0); } } ' +
          '@keyframes mgGlitchCyber { 0% { opacity: 0; transform: skew(14deg); filter: drop-shadow(4px 0 #06b6d4) drop-shadow(-4px 0 #f43f5e); } 20% { opacity: 1; transform: skew(-10deg) translate(-2px, 2px); } 40% { transform: skew(6deg) translate(2px, -1px); } 60% { transform: skew(-3deg); } 80% { transform: skew(1deg); } 100% { opacity: 1; transform: none; filter: none; } } ' +
          '@keyframes mgWaveReveal { 0% { opacity: 0; transform: translateY(20px) scale(0.9); clip-path: polygon(0 100%, 100% 100%, 100% 100%, 0 100%); } 100% { opacity: 1; transform: translateY(0) scale(1); clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); } } ' +
          '@keyframes mgFlip3DX { 0% { opacity: 0; transform: perspective(600px) rotateX(90deg); } 65% { transform: perspective(600px) rotateX(-15deg); } 100% { opacity: 1; transform: perspective(600px) rotateX(0deg); } } ' +
          '@keyframes mgFlip3DY { 0% { opacity: 0; transform: perspective(600px) rotateY(90deg); } 65% { transform: perspective(600px) rotateY(-15deg); } 100% { opacity: 1; transform: perspective(600px) rotateY(0deg); } } ' +
          '@keyframes mgGoldShimmerSweep { 0% { opacity: 0; transform: scale(0.92); filter: brightness(3) contrast(2); } 60% { opacity: 1; filter: brightness(1.6) contrast(1.3); } 100% { opacity: 1; transform: scale(1); filter: brightness(1) contrast(1); } } ' +
          '@keyframes mgKineticStamp { 0% { opacity: 0; transform: scale(2.5) translateY(-30px); } 50% { opacity: 1; transform: scale(0.92) translateY(0); } 75% { transform: scale(1.05); } 100% { opacity: 1; transform: scale(1); } } ' +
          '@keyframes mgBlurFocus { 0% { opacity: 0; filter: blur(28px); transform: scale(1.15); } 100% { opacity: 1; filter: blur(0px); transform: scale(1); } } ' +
          '@keyframes mgStaggerLetter { 0% { opacity: 0; transform: translateY(30px) rotate(-6deg); } 70% { transform: translateY(-4px) rotate(2deg); } 100% { opacity: 1; transform: translateY(0) rotate(0deg); } } ' +
          '@keyframes mgMatrixDecrypt { 0% { opacity: 0; filter: hue-rotate(120deg) blur(6px); transform: scaleY(0.5); } 50% { opacity: 0.8; filter: hue-rotate(60deg) blur(2px); transform: scaleY(1.1); } 100% { opacity: 1; filter: none; transform: scaleY(1); } } ' +
          '@keyframes mgCurtainReveal { 0% { opacity: 0; clip-path: polygon(50% 0, 50% 0, 50% 100%, 50% 100%); } 100% { opacity: 1; clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); } } ' +
          '@keyframes mgSpiralIn { 0% { opacity: 0; transform: rotate(-240deg) scale(0.15); filter: blur(10px); } 70% { transform: rotate(15deg) scale(1.08); filter: blur(0); } 100% { opacity: 1; transform: rotate(0deg) scale(1); filter: blur(0); } } ' +
          '@keyframes mgContinuousFloating { 0% { transform: translateY(0px); } 100% { transform: translateY(-8px); } } ' +
          '@keyframes mgContinuousNeonBreathe { 0%, 100% { filter: brightness(1) drop-shadow(0 0 6px rgba(255,255,255,0.4)); } 50% { filter: brightness(1.3) drop-shadow(0 0 18px rgba(6,182,212,0.8)); } } ' +
          '@keyframes mgContinuousShimmerLoop { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } } ' +
          '@keyframes mgContinuousRainbowCycle { 0% { filter: hue-rotate(0deg); } 100% { filter: hue-rotate(360deg); } } ' +
          '@keyframes mgContinuousJitterGlitch { 0%, 92%, 100% { transform: none; } 93% { transform: skew(4deg) translate(-2px, 1px); } 95% { transform: skew(-4deg) translate(2px, -1px); } 97% { transform: skew(2deg); } } ' +
          '@keyframes mgContinuousWobble3D { 0% { transform: perspective(500px) rotateX(0deg) rotateY(0deg); } 25% { transform: perspective(500px) rotateX(6deg) rotateY(-8deg); } 75% { transform: perspective(500px) rotateX(-6deg) rotateY(8deg); } 100% { transform: perspective(500px) rotateX(0deg) rotateY(0deg); } }';
      }

      // Pooling em tempo real para obter a quantidade real de conexões ativas do MikroTik a cada 10 segundos
      if (config.badges && config.badges.showConnectedCount) {
        function updateLiveOnlineCount() {
          var el = document.getElementById('mg-online-count');
          if (!el) return;
          fetch('/api/dashboard/stats')
            .then(function(res) { return res.json(); })
            .then(function(json) {
              if (json && json.success && json.data && json.data.activeUsersCount !== undefined) {
                el.innerText = json.data.activeUsersCount;
              }
            })
            .catch(function() {});
        }
        if (!window.mgOnlineInterval) {
          window.mgOnlineInterval = setInterval(updateLiveOnlineCount, 10000);
        }
        updateLiveOnlineCount();
      }

      // 10. Preloader Instantâneo de Cadastro ao Clicar em "Cadastre-se"
      var registerBtns = document.querySelectorAll('#btnSignup, .btn-register, a[href*="register"]');
      registerBtns.forEach(function(btn) {
        if (!btn.dataset.mgLoadAttached) {
          btn.dataset.mgLoadAttached = 'true';
          btn.addEventListener('click', function(e) {
            var loader = document.getElementById('mg-instant-loader');
            if (!loader) {
              loader = document.createElement('div');
              loader.id = 'mg-instant-loader';
              loader.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(10,12,20,0.85);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);z-index:999999;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#fff;font-family:sans-serif;transition:opacity 0.2s;';
              loader.innerHTML = '<div style="width:44px;height:44px;border:3px solid rgba(255,255,255,0.2);border-top-color:#2563eb;border-radius:50%;animation:mgSpin 0.7s linear infinite;"></div><div style="margin-top:14px;font-size:13px;font-weight:600;letter-spacing:0.5px;color:#f8fafc;">Abrindo Cadastro...</div><style>@keyframes mgSpin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }</style>';
              document.body.appendChild(loader);
            } else {
              loader.style.display = 'flex';
            }
          });
        }
      });
    }

    // =========================================================================
    // VISUAL CLICK-TO-EDIT INSPECTOR (SELEÇÃO DIRETA WYSIWYG - SEM DESFOQUE)
    // =========================================================================
    var inspectorActive = true;
    var currentSelectedEl = null;

    var TARGET_SPECS = {
      typography: {
        id: 'typography',
        title: 'Tipografia & Título',
        cardId: 'properties',
        selector: 'h1, h2, .brand-title, #businessName, .title, legend, #welcomeMessage, .welcome-msg, p.message'
      },
      button: {
        id: 'button',
        title: 'Botão Conectar',
        cardId: 'spacing',
        selector: 'button:not(.btn-trial):not(#btnSignup), .btn-primary, .btn-login, input[type="submit"], #btnConnect, #btnSubmit'
      },
      input: {
        id: 'input',
        title: 'Campos de Entrada',
        cardId: 'spacing',
        selector: 'input[type="text"], input[type="password"], select, textarea, .retro-input'
      },
      register_btn: {
        id: 'register_btn',
        title: 'Botão Cadastre-se',
        cardId: 'fields',
        selector: '#btnSignup, .btn-register, a[href*="register"]'
      },
      trial: {
        id: 'trial',
        title: 'Acesso Grátis (Trial)',
        cardId: 'fields',
        selector: '#trial-container, .btn-trial, #trial-btn, a[href*="trial"]'
      },
      badges: {
        id: 'badges',
        title: 'Badges de Rede',
        cardId: 'social_badges',
        selector: '#mg-live-badges-bar, .badge, .status-badge'
      },
      whatsapp: {
        id: 'whatsapp',
        title: 'WhatsApp Flutuante',
        cardId: 'social_badges',
        selector: '#mg-floating-whatsapp'
      },
      card: {
        id: 'card',
        title: 'Card do Portal',
        cardId: 'spacing',
        selector: '#box, .login-card, .card, .container > div, .box, #card, .login-box, form, main'
      },
      background: {
        id: 'background',
        title: 'Fundo & FX',
        cardId: 'background',
        selector: '#custom-bg-layer, #mg-live-fx-container, canvas, body'
      }
    };

    function initVisualSelectionStyles() {
      if (document.getElementById('mg-selection-css')) return;
      var style = document.createElement('style');
      style.id = 'mg-selection-css';
      style.innerHTML = [
        '.mg-interactive-target { cursor: pointer !important; }',
        '.mg-hover-target { outline: 1.5px dashed #06b6d4 !important; outline-offset: 2px !important; transition: outline 0.1s ease !important; cursor: pointer !important; }',
        '.mg-selected-target { outline: 2.5px solid #06b6d4 !important; outline-offset: 3px !important; box-shadow: 0 0 16px rgba(6, 182, 212, 0.6) !important; transition: all 0.15s ease !important; cursor: pointer !important; }'
      ].join(' ');
      document.head.appendChild(style);
    }

    function setSelectedElement(el) {
      if (currentSelectedEl && currentSelectedEl.classList && currentSelectedEl !== el) {
        currentSelectedEl.classList.remove('mg-selected-target');
      }
      currentSelectedEl = el;
      if (el && el.classList && el !== document.body) {
        el.classList.add('mg-selected-target');
      }
    }

    function clearSelection() {
      if (currentSelectedEl && currentSelectedEl.classList) {
        currentSelectedEl.classList.remove('mg-selected-target');
        currentSelectedEl = null;
      }
      document.querySelectorAll('.mg-hover-target').forEach(function(h) {
        if (h && h.classList) h.classList.remove('mg-hover-target');
      });
    }

    function findMatchingSpec(el) {
      if (!el || el === document.body || el === document.documentElement) {
        return { el: document.body, spec: TARGET_SPECS.background };
      }
      
      // Order of specificity
      var keys = ['button', 'input', 'register_btn', 'trial', 'badges', 'whatsapp', 'typography', 'card'];
      for (var i = 0; i < keys.length; i++) {
        var spec = TARGET_SPECS[keys[i]];
        if (el.matches && el.matches(spec.selector)) return { el: el, spec: spec };
        var closest = el.closest && el.closest(spec.selector);
        if (closest) return { el: closest, spec: spec };
      }
      return { el: el, spec: TARGET_SPECS.card };
    }

    var lastHoverEl = null;

    function setupVisualSelectionListeners() {
      initVisualSelectionStyles();

      // Mark interactive elements with pointer cursor
      document.addEventListener('mouseover', function(e) {
        if (!inspectorActive) return;
        var hit = findMatchingSpec(e.target);
        if (hit && hit.el && hit.el !== document.body) {
          if (lastHoverEl && lastHoverEl !== hit.el) {
            lastHoverEl.classList.remove('mg-hover-target');
          }
          lastHoverEl = hit.el;
          if (!hit.el.classList.contains('mg-selected-target')) {
            hit.el.classList.add('mg-hover-target');
          }
        }
      }, { passive: true });

      document.addEventListener('mouseout', function(e) {
        if (lastHoverEl) {
          lastHoverEl.classList.remove('mg-hover-target');
          lastHoverEl = null;
        }
      }, { passive: true });

      document.addEventListener('click', function(e) {
        // Se o usuário clicar no botão fechar (X) do anúncio (adCloseBtn ou .ad-modal-close)
        var closeBtnHit = e.target && (e.target.closest('#adCloseBtn, .ad-modal-close') || (e.target.id === 'adCloseBtn'));
        if (closeBtnHit) {
          e.preventDefault();
          e.stopPropagation();
          if (typeof window.closeAdModal === 'function') {
            window.closeAdModal();
          } else {
            var modal = document.getElementById('adModal');
            if (modal) {
              modal.style.setProperty('display', 'none', 'important');
              document.body.style.overflow = '';
            }
          }
          return;
        }

        var hit = findMatchingSpec(e.target);
        if (hit && hit.spec) {
          // Se for o botão/link de cadastro no preview e o usuário clicou para testar a navegação
          if (hit.spec.id === 'register_btn') {
            try {
              window.parent.postMessage({
                type: 'PREVIEW_ELEMENT_CLICK',
                target: hit.spec.id,
                cardId: hit.spec.cardId,
                title: hit.spec.title
              }, '*');
            } catch(err) {}
            // Navega o iframe para a tela de cadastro em modo preview
            window.location.href = '/portal/register?template=' + encodeURIComponent('${template}') + '&preview=1';
            return;
          }

          e.preventDefault();
          e.stopPropagation();
          setSelectedElement(hit.el);
          try {
            window.parent.postMessage({
              type: 'PREVIEW_ELEMENT_CLICK',
              target: hit.spec.id,
              cardId: hit.spec.cardId,
              title: hit.spec.title
            }, '*');
          } catch(err) {}
        }
      }, true);

      // Interceptar envio do formulário de login para simular no preview sem tentar ir para $(link-login-only)
      var loginForms = document.querySelectorAll('form');
      loginForms.forEach(function(f) {
        f.addEventListener('submit', function(e) {
          e.preventDefault();
          e.stopPropagation();
          var btn = f.querySelector('button[type="submit"], input[type="submit"], #btnLogin, #btnConnect, .btn-login');
          var origText = btn ? (btn.innerText || btn.value) : 'Conectar';
          if (btn) {
            btn.disabled = true;
            if (btn.tagName === 'INPUT') btn.value = 'Autenticando (Simulação)...';
            else btn.innerText = 'Autenticando (Simulação)...';
          }
          var alertBox = document.querySelector('.alert-box, .error, .login-feedback');
          if (!alertBox) {
            alertBox = document.createElement('div');
            alertBox.style.cssText = 'background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.4); color: #10b981; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; text-align: center; margin: 12px 0;';
            f.prepend(alertBox);
          }
          alertBox.style.display = 'block';
          alertBox.style.background = 'rgba(16, 185, 129, 0.15)';
          alertBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          alertBox.style.color = '#10b981';
          alertBox.innerText = '🎉 Conexão simulada com sucesso! Voucher autenticado no MikroTik.';
          setTimeout(function() {
            if (btn) {
              btn.disabled = false;
              if (btn.tagName === 'INPUT') btn.value = origText;
              else btn.innerText = origText;
            }
          }, 3000);
        });
      });

      // Disparar no primeiro clique/toque na tela: libera o áudio automaticamente em qualquer vídeo ou carrossel do preview
      (function setupPreviewAudioUnlock() {
        function unlockAllAudio() {
          window._mgAudioPermanentlyUnlocked = true;
          
          // Desmuta e aciona play APENAS no vídeo do slide visível no momento
          var activeVid = null;
          var carouselEl = document.getElementById('adCarousel');
          if (carouselEl && carouselEl.children.length > 1 && typeof currentAdIndex !== 'undefined') {
            var curSlide = carouselEl.children[currentAdIndex];
            if (curSlide) activeVid = curSlide.querySelector('video');
          } else if (!carouselEl || carouselEl.children.length <= 1) {
            var modal = document.getElementById('adModal');
            if (modal && modal.style.display !== 'none') {
              activeVid = modal.querySelector('video');
            }
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

          var audioBtn = document.getElementById('adAudioBtn');
          if (audioBtn) audioBtn.innerHTML = '🔊';

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
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() { 
        applyLiveConfig(pendingConfig || currentConfig); 
        setupVisualSelectionListeners();
      });
    } else {
      applyLiveConfig(pendingConfig || currentConfig);
      setupVisualSelectionListeners();
    }

    window.addEventListener('message', function(event) {
      var data = event.data;
      if (!data) return;
      if (data.type === 'LIVE_PREVIEW') {
        applyLiveConfig(data);
      } else if (data.type === 'INSPECTOR_HOVER_CARD') {
        var cardTarget = data.target;
        if (!cardTarget) {
          clearSelection();
          return;
        }
        var spec = TARGET_SPECS[cardTarget] || TARGET_SPECS.card;
        if (spec) {
          var targetEl = document.querySelector(spec.selector) || document.body;
          setSelectedElement(targetEl);
        }
      } else if (data.type === 'INSPECTOR_CLEAR') {
        clearSelection();
      } else if (data.type === 'REPLAY_ANIMATION') {
        var bWrap = document.getElementById('mg-live-brand-container');
        if (bWrap && bWrap.parentNode) {
          var clone = bWrap.cloneNode(true);
          bWrap.parentNode.replaceChild(clone, bWrap);
        }
      }
    });

    if (window.parent && window.parent !== window) {
      try { window.parent.postMessage({ type: 'IFRAME_READY' }, '*'); } catch(e) {}
    }
  })();
</script>
`;

    if (html.includes('</body>')) {
      html = html.replace('</body>', `${livePreviewScript}</body>`);
    } else {
      html += livePreviewScript;
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Frame-Options': 'SAMEORIGIN',
        'Cache-Control': 'no-cache, no-store',
      },
    });
  } catch (error: any) {
    return new NextResponse(`<h1>Erro: ${error.message}</h1>`, { status: 500, headers: { 'Content-Type': 'text/html' } });
  }
}
