"use client";

import { useState } from 'react';

type LoginStep = 'CREDENTIALS' | 'OTP_WHATSAPP' | 'EMERGENCY_TOKEN';

export default function SystemLogin() {
  const [step, setStep] = useState<LoginStep>('CREDENTIALS');
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [otpCode, setOtpCode] = useState('');

  const [emergencyToken, setEmergencyToken] = useState('');
  const [maskedPhone, setMaskedPhone] = useState('');
  const [emergencyAvailable, setEmergencyAvailable] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successInfo, setSuccessInfo] = useState('');

  // Etapa 1: Validação de Credenciais
  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user.trim() || !pass) {
      setError('Por favor, informe o usuário e a senha.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessInfo('');

    try {
      const res = await fetch('/api/auth/otp/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.trim(), password: pass }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        if (res.status === 429) {
          setError(data?.message || 'Muitas tentativas incorretas. Acesso bloqueado por 15 minutos.');
        } else if (data?.message) {
          const remainingInfo =
            typeof data.remainingAttempts === 'number' && data.remainingAttempts < 3
              ? ` (${data.remainingAttempts} tentativa(s) restante(s))`
              : '';
          setError(`${data.message}${remainingInfo}`);
        } else {
          setError('Usuário ou senha incorretos.');
        }
        return;
      }

      // Se 2FA não for necessário (sem telefone configurado ou login direto)
      if (data?.otpRequired === false) {
        if (data?.emergencyFallback) {
          // WhatsApp indisponível, mas tem tokens de emergência cadastrados
          setEmergencyAvailable(true);
          setStep('EMERGENCY_TOKEN');
          setError('WhatsApp offline. Utilize um Token de Emergência para prosseguir.');
          return;
        }
        // Login direto efetuado com sucesso (cookie já emitido)
        window.location.assign('/dashboard');
        return;
      }

      // Se 2FA ativo -> avança para tela de OTP
      if (data?.otpRequired === true) {
        setMaskedPhone(data.maskedPhone || 'seu WhatsApp');
        setEmergencyAvailable(!!data.emergencyAvailable);
        setStep('OTP_WHATSAPP');
        setSuccessInfo(`Código enviado para ${data.maskedPhone || 'seu WhatsApp'}.`);
        return;
      }

      setError('Resposta inesperada do servidor.');
    } catch (networkError) {
      console.error('Erro de conexão ao autenticar:', networkError);
      setError('Não foi possível conectar ao servidor. Verifique a rede.');
    } finally {
      setLoading(false);
    }
  };

  // Etapa 2A: Verificação do Código OTP recebido no WhatsApp
  const handleOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || otpCode.trim().length < 6) {
      setError('Informe o código de 6 dígitos.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.trim(), code: otpCode.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        window.location.assign('/dashboard');
        return;
      }

      setError(data?.message || 'Código inválido ou expirado.');
    } catch {
      setError('Erro de conexão ao validar o código.');
    } finally {
      setLoading(false);
    }
  };

  // Etapa 2B: Fallback de Segurança com Token Offline de Emergência
  const handleEmergencySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emergencyToken.trim()) {
      setError('Informe o token de emergência.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/emergency-tokens/use', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.trim(), token: emergencyToken.trim() }),
      });

      const data = await res.json().catch(() => null);

      if (res.ok && data?.success) {
        window.location.assign('/dashboard');
        return;
      }

      setError(data?.message || 'Token de emergência inválido ou já utilizado.');
    } catch {
      setError('Erro de conexão ao validar token de emergência.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="mg-login-canvas">
      {/* ── Background Aura Glow ── */}
      <div
        className="aurora-blob blob-indigo"
        style={{ width: '520px', height: '520px', top: '-160px', left: '-160px', animationDelay: '0s', opacity: 0.25 }}
      />
      <div
        className="aurora-blob blob-cyan aurora-blob-reverse"
        style={{ width: '420px', height: '420px', bottom: '-130px', right: '-130px', animationDelay: '-5s', opacity: 0.2 }}
      />

      {/* ── Login Card ── */}
      <div className="mg-login-card animate-fade-in">
        
        {/* Logo & Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="mg-login-logo-box">
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a9 9 0 0112.14 0M1.394 9h.01m21.196 0h.01" />
            </svg>
          </div>

          <h1 className="mg-login-title">
            Mikro<span style={{ color: 'var(--mg-primary)' }}>Gestor</span>
          </h1>
          <p className="mg-login-subtitle">
            Hotspot Gateway v2.0 • Proteção 2FA
          </p>

          {/* Status pill */}
          <div className="flex items-center gap-2 mt-1 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-400">
              {step === 'CREDENTIALS' ? 'Acesso Seguro' : step === 'OTP_WHATSAPP' ? 'Autenticação 2FA' : 'Modo de Emergência'}
            </span>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mg-alert mg-alert-danger mb-4">
            <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
            <span className="text-xs font-bold">{error}</span>
          </div>
        )}

        {/* Success / Info Message */}
        {successInfo && (
          <div className="mg-alert mg-alert-info mb-4">
            <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
            <span className="text-xs font-semibold">{successInfo}</span>
          </div>
        )}

        {/* ── TELA 1: Credenciais ── */}
        {step === 'CREDENTIALS' && (
          <form onSubmit={handleCredentialsSubmit} className="space-y-4">
            <div>
              <label className="mg-label">
                Usuário
              </label>
              <input
                id="login-username"
                type="text"
                required
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="ex: admin"
                className="mg-input"
                autoComplete="username"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="mg-label !mb-0">
                  Senha
                </label>
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="text-[11px] font-semibold cursor-pointer hover:underline"
                  style={{ color: 'var(--mg-primary)' }}
                >
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPass ? 'text' : 'password'}
                  required
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  placeholder="••••••••"
                  className="mg-input pr-10"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="mg-btn mg-btn-primary w-full mt-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Verificando...</span>
                </>
              ) : (
                <>
                  <span>Prosseguir</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </>
              )}
            </button>
          </form>
        )}

        {/* ── TELA 2: Código OTP via WhatsApp ── */}
        {step === 'OTP_WHATSAPP' && (
          <form onSubmit={handleOtpSubmit} className="space-y-4">
            <div className="mg-otp-badge-box">
              <span className="text-2xl mb-1 block">📱</span>
              <p className="text-xs" style={{ color: 'var(--mg-text-muted)' }}>
                Enviamos um código de 6 dígitos via WhatsApp para:
              </p>
              <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--mg-primary)' }}>{maskedPhone}</p>
            </div>

            <div>
              <label className="mg-label text-center">
                Código de Verificação (6 dígitos)
              </label>
              <input
                id="login-otp"
                type="text"
                required
                maxLength={6}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                className="mg-input text-center tracking-[0.5em] text-xl font-mono"
                autoFocus
              />
            </div>

            <button
              id="otp-submit"
              type="submit"
              disabled={loading || otpCode.length < 6}
              className="mg-btn mg-btn-success w-full mt-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <span>Confirmar e Entrar</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                </>
              )}
            </button>

            <div className="flex flex-col gap-2 pt-3 border-t border-[var(--mg-card-border)] text-center">
              <button
                type="button"
                onClick={() => { setStep('CREDENTIALS'); setOtpCode(''); }}
                className="text-xs hover:underline cursor-pointer"
                style={{ color: 'var(--mg-text-muted)' }}
              >
                ← Voltar e alterar credenciais
              </button>

              {emergencyAvailable && (
                <button
                  type="button"
                  onClick={() => { setStep('EMERGENCY_TOKEN'); setError(''); }}
                  className="text-xs text-amber-500 hover:underline font-medium flex items-center justify-center gap-1 cursor-pointer"
                >
                  <span>📴 WhatsApp inacessível? Usar Token de Emergência</span>
                </button>
              )}
            </div>
          </form>
        )}

        {/* ── TELA 3: Token Offline de Emergência ── */}
        {step === 'EMERGENCY_TOKEN' && (
          <form onSubmit={handleEmergencySubmit} className="space-y-4">
            <div className="mg-alert mg-alert-warning text-center flex-col">
              <span className="text-2xl mb-1 block">🚨</span>
              <p className="text-xs font-bold">
                Modo de Recuperação Offline
              </p>
              <p className="text-[11px] mt-1 leading-relaxed opacity-90">
                Utilize um dos tokens pré-gerados salvos no seu grupo seguro ou guardados offline.
              </p>
            </div>

            <div>
              <label className="mg-label text-center">
                Token de Emergência
              </label>
              <input
                id="emergency-token"
                type="text"
                required
                value={emergencyToken}
                onChange={(e) => setEmergencyToken(e.target.value.toUpperCase())}
                placeholder="EMG-XXXX-XXXX"
                className="mg-input text-center font-mono text-base uppercase"
                autoFocus
              />
            </div>

            <button
              id="emergency-submit"
              type="submit"
              disabled={loading || !emergencyToken.trim()}
              className="mg-btn mg-btn-warning w-full mt-2"
            >
              {loading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Verificando Token...</span>
                </>
              ) : (
                <>
                  <span>Desbloquear Painel</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5V6.75a4.5 4.5 0 119 0v3.75M3.75 21.75h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H3.75A2.25 2.25 0 001.5 12.75v6.75a2.25 2.25 0 002.25 2.25z" />
                  </svg>
                </>
              )}
            </button>

            <div className="flex flex-col gap-2 pt-3 border-t border-[var(--mg-card-border)] text-center">
              <button
                type="button"
                onClick={() => { setStep('CREDENTIALS'); setEmergencyToken(''); setError(''); }}
                className="text-xs hover:underline cursor-pointer"
                style={{ color: 'var(--mg-text-muted)' }}
              >
                ← Voltar para login normal
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="text-center text-[11px] font-medium mt-6" style={{ color: 'var(--mg-text-muted)' }}>
          MikroGestor © 2026 — Hotspot Gateway Enterprise
        </p>
      </div>
    </main>
  );
}
