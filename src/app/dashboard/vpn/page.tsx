"use client";

/**
 * /dashboard/vpn — Painel de VPN Control
 * Gerencia conexões WireGuard entre a VPS, MikroTiks e dispositivos de administração (Windows / Celular).
 */

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Plus,
  Copy,
  Check,
  Download,
  Trash2,
  RefreshCw,
  Wifi,
  ExternalLink,
  AlertTriangle,
  Lock,
  Globe,
  Smartphone,
  Laptop,
  Monitor,
  QrCode,
  CheckCircle2,
  Info,
  Sparkles,
  Eye,
  EyeOff,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

// ─── Tipos ─────────────────────────────────────────────────────────────────

interface VpnRouter {
  id: string;
  name: string;
  vpnIp: string | null;
  vpnStatus: string;
  vpnLastSeen: string | null;
  subdomain?: string | null;
  sslActive?: boolean;
  sslExpiresAt?: string | null;
  user?: string;
  active?: boolean;
  peer: {
    endpoint: string | null;
    lastHandshake: string | null;
    transferRx: number;
    transferTx: number;
  } | null;
}

interface RouterBasic {
  id: string;
  name: string;
  host: string;
  vpnEnabled: boolean;
}

interface VpnPeerClient {
  id: string;
  name: string;
  deviceType: string;
  vpnIp: string;
  publicKey: string;
  status: string;
  lastSeen: string | null;
  createdAt: string;
  transferRx: number;
  transferTx: number;
  endpoint: string | null;
}

// ─── Utils ─────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatLastSeen(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const d = new Date(dateStr);
  const ago = Math.floor((Date.now() - d.getTime()) / 1000);
  if (ago < 60) return `${ago}s atrás`;
  if (ago < 3600) return `${Math.floor(ago / 60)}m atrás`;
  if (ago < 86400) return `${Math.floor(ago / 3600)}h atrás`;
  return d.toLocaleDateString("pt-BR");
}

// ─── Componentes Auxiliares ────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  if (status === "connected") {
    return (
      <span className="mg-badge-success inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        Online
      </span>
    );
  }
  if (status === "pending") {
    return (
      <span className="mg-badge-warning inline-flex items-center gap-1.5">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Aguardando
      </span>
    );
  }
  return (
    <span className="mg-badge-danger inline-flex items-center gap-1.5">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
      Offline
    </span>
  );
}

function DeviceIcon({ type }: { type: string }) {
  switch (type.toLowerCase()) {
    case "android":
    case "ios":
      return <Smartphone className="w-5 h-5 text-indigo-600" />;
    case "macos":
    case "linux":
      return <Laptop className="w-5 h-5 text-slate-700" />;
    case "windows":
    default:
      return <Monitor className="w-5 h-5 text-blue-600" />;
  }
}

function CopyButton({ text, label = "Copiar" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-xs cursor-pointer"
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          <span>Copiado!</span>
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          <span>{label}</span>
        </>
      )}
    </button>
  );
}

// ─── Modal de Criação / Geração de Túnel MikroTik ───────────────────────────

interface CreateTunnelModalProps {
  existingRouters: RouterBasic[];
  selectedRouter?: RouterBasic | null;
  onClose: () => void;
  onSuccess: () => void;
}

function CreateTunnelModal({
  existingRouters,
  selectedRouter,
  onClose,
  onSuccess,
}: CreateTunnelModalProps) {
  const [mode, setMode] = useState<"existing" | "new">(
    selectedRouter ? "existing" : existingRouters.length > 0 ? "existing" : "new"
  );
  const [selectedId, setSelectedId] = useState(selectedRouter?.id || (existingRouters[0]?.id ?? ""));
  const [routerName, setRouterName] = useState("");
  const [user, setUser] = useState("admin");
  const [password, setPassword] = useState("");
  const [autoCredentials, setAutoCredentials] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [scriptResult, setScriptResult] = useState<{
    routerId?: string;
    routerName: string;
    vpnIp: string;
    script: string;
    subdomain?: string;
    user?: string;
    password?: string;
  } | null>(null);

  const [autoConnected, setAutoConnected] = useState(false);
  const [autoConnectMessage, setAutoConnectMessage] = useState(
    "Aguardando execução do script no MikroTik..."
  );

  // Monitora em tempo real a execução do script e a conexão da API no MikroTik
  useEffect(() => {
    if (!scriptResult?.routerId || autoConnected) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/vpn/router/${scriptResult.routerId}/verify-connection`);
        const data = await res.json();
        if (data.connected && data.authenticated) {
          setAutoConnected(true);
          setAutoConnectMessage(data.message || "MikroTik conectado e autenticado com sucesso!");
          onSuccess();
        } else if (data.connected && !data.authenticated) {
          setAutoConnectMessage("Túnel WireGuard conectado! Finalizando aplicação do usuário de API...");
        }
      } catch {
        // Continua polling em silêncio
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [scriptResult?.routerId, autoConnected, onSuccess]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload =
        mode === "existing"
          ? { routerId: selectedId }
          : {
              routerName,
              user: autoCredentials ? undefined : user,
              password: autoCredentials ? undefined : password,
            };

      const res = await fetch("/api/vpn/router/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao gerar túnel VPN.");

      setScriptResult({
        routerId: data.routerId,
        routerName: data.routerName || routerName || "MikroTik",
        vpnIp: data.vpnIp,
        script: data.script,
        subdomain: data.subdomain,
        user: data.user,
        password: data.password,
      });
      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha na comunicação com o servidor.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const downloadScript = () => {
    if (!scriptResult) return;
    const blob = new Blob([scriptResult.script], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mikrogestor-vpn-${scriptResult.routerName.replace(/\s+/g, "-").toLowerCase()}.rsc`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                {scriptResult ? "Script de Conexão Gerado" : "Novo Túnel VPN WireGuard (MikroTik)"}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {scriptResult
                  ? `Cole este comando no terminal do seu MikroTik (${scriptResult.vpnIp})`
                  : "Crie um túnel seguro para controlar seu roteador sem IP público"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!scriptResult ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {existingRouters.length > 0 && (
                <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setMode("existing")}
                    className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                      mode === "existing"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Usar Roteador Cadastrado
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("new")}
                    className={`py-2 px-3 rounded-xl transition-all cursor-pointer ${
                      mode === "new"
                        ? "bg-white text-slate-900 shadow-xs"
                        : "text-slate-600 hover:text-slate-900"
                    }`}
                  >
                    Cadastrar Novo Roteador
                  </button>
                </div>
              )}

              {mode === "existing" ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    Selecione o Roteador
                  </label>
                  <select
                    value={selectedId}
                    onChange={(e) => setSelectedId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 transition-colors"
                  >
                    {existingRouters.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name} ({r.host})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Nome do Roteador / Local
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: MikroTik Praça Central ou mikrogestor fap"
                      value={routerName}
                      onChange={(e) => setRouterName(e.target.value)}
                      required
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 transition-colors"
                    />
                  </div>

                  {/* Configuração Inteligente de Credenciais */}
                  <div className="p-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border border-blue-200/90 rounded-2xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-blue-950 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                        Credenciais de API Automáticas (Zero Configuração)
                      </span>
                      <label className="flex items-center gap-1.5 cursor-pointer text-[11px] font-bold text-blue-800 bg-white/80 px-2 py-0.5 rounded-lg border border-blue-200">
                        <input
                          type="checkbox"
                          checked={autoCredentials}
                          onChange={(e) => setAutoCredentials(e.target.checked)}
                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
                        />
                        <span>Automático</span>
                      </label>
                    </div>
                    <p className="text-[11px] text-blue-800 font-medium leading-relaxed">
                      {autoCredentials
                        ? "O MikroGestor gerará um usuário exclusivo com permissões completas e uma senha ultra-segura. O script criará as credenciais no MikroTik e ativará o roteador em Roteadores e Sistema automaticamente."
                        : "Você pode definir credenciais manuais caso já possua um usuário criado no RouterOS:"}
                    </p>

                    {!autoCredentials && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Usuário RouterOS
                          </label>
                          <input
                            type="text"
                            value={user}
                            onChange={(e) => setUser(e.target.value)}
                            required
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:border-blue-500 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-slate-700 mb-1">
                            Senha RouterOS
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-medium text-slate-800 focus:border-blue-500 transition-colors"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="pt-4 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gerando Túnel & Credenciais...
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      Gerar VPN & Script
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 animate-fade-in">
              {/* Banner de Status com Reconhecimento Automático */}
              {autoConnected ? (
                <div className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-4 flex items-center justify-between shadow-sm shadow-emerald-500/10 animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/30 shrink-0">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                          MikroTik Conectado & Autenticado!
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-200 text-emerald-900">
                          Roteador Ativo
                        </span>
                      </div>
                      <p className="text-xs text-emerald-800 font-medium mt-0.5">
                        {autoConnectMessage}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-600 flex items-center justify-center shrink-0">
                      <RefreshCw className="w-5 h-5 animate-spin text-amber-600" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-xs font-black text-amber-950 uppercase tracking-wider">
                          Aguardando Execução no MikroTik...
                        </span>
                      </div>
                      <p className="text-xs text-amber-800 font-medium mt-0.5">
                        {autoConnectMessage}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-[11px] font-mono font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                      IP: {scriptResult.vpnIp}
                    </span>
                  </div>
                </div>
              )}

              {/* Informações de Credenciais e Subdomínio */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Usuário API Criado
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-slate-900">
                      {scriptResult.user || "admin"}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigator.clipboard.writeText(scriptResult.user || "")}
                      className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                    >
                      Copiar
                    </button>
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Senha API Criada
                  </span>
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-xs text-slate-900">
                      {showPassword ? scriptResult.password : "••••••••••••••••"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="p-1 rounded text-slate-400 hover:text-slate-700"
                        title={showPassword ? "Ocultar" : "Mostrar"}
                      >
                        {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(scriptResult.password || "")}
                        className="text-[10px] font-bold text-blue-600 hover:text-blue-800"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Subdomínio Dedicado */}
              {scriptResult.subdomain && (
                <div className="bg-blue-50/70 border border-blue-200 rounded-2xl p-3 flex items-center justify-between">
                  <span className="text-xs text-blue-900 font-bold flex items-center gap-1.5">
                    <Globe className="w-3.5 h-3.5 text-blue-600" />
                    Subdomínio HTTPS:
                  </span>
                  <a
                    href={`https://${scriptResult.subdomain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="font-mono text-xs text-blue-700 underline font-black inline-flex items-center gap-1"
                  >
                    https://{scriptResult.subdomain}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}

              {/* Instruções de Conexão */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                  Como Conectar no MikroTik (1 Clique):
                </h4>
                <ol className="text-xs text-slate-600 font-medium space-y-1.5 list-decimal list-inside leading-relaxed">
                  <li>Abra o <strong>Winbox</strong> conectado ao seu MikroTik na rede local.</li>
                  <li>Clique no botão <strong>New Terminal</strong> no menu lateral esquerdo.</li>
                  <li><strong>Cole o script gerado</strong> e pressione Enter.</li>
                  <li>O MikroGestor detectará a conexão e autenticará o roteador automaticamente!</li>
                </ol>
              </div>

              {/* Script Pre */}
              <div>
                <div className="flex items-center justify-between pb-1.5 text-[11px] font-bold text-slate-500">
                  <span>Script RouterOS 7+ (.rsc)</span>
                  <div className="flex items-center gap-2">
                    <CopyButton text={scriptResult.script} label="Copiar Script" />
                    <button
                      onClick={downloadScript}
                      className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                      title="Baixar arquivo .rsc"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <pre className="bg-[#0f172a] text-slate-200 p-4 rounded-2xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-52 custom-scrollbar border border-slate-800 selection:bg-blue-600">
                  {scriptResult.script}
                </pre>
              </div>

              {/* Botões do Rodapé */}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-5 py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm ${
                    autoConnected
                      ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                >
                  {autoConnected ? "Concluído / Acessar Painel" : "Fechar"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Criação de Peer (Windows / Celular) ───────────────────────────

interface CreatePeerModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function CreatePeerModal({ onClose, onSuccess }: CreatePeerModalProps) {
  const [name, setName] = useState("");
  const [deviceType, setDeviceType] = useState<"windows" | "android" | "ios" | "macos" | "linux">("windows");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    peer: { id: string; name: string; deviceType: string; vpnIp: string };
    clientConfig: string;
  } | null>(null);

  const [activeTab, setActiveTab] = useState<"qr" | "conf">("conf");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/vpn/peers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, deviceType }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao criar dispositivo VPN.");

      setResult({
        peer: data.peer,
        clientConfig: data.clientConfig,
      });

      if (deviceType === "android" || deviceType === "ios") {
        setActiveTab("qr");
      } else {
        setActiveTab("conf");
      }

      onSuccess();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Falha na comunicação ao criar peer.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const downloadConf = () => {
    if (!result) return;
    const blob = new Blob([result.clientConfig], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = result.peer.name.toLowerCase().replace(/\s+/g, "-");
    a.download = `mikrogestor-${safeName}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-indigo-600 to-blue-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">
                {result ? "Dispositivo VPN Configurado!" : "Conectar PC ou Celular à VPN"}
              </h2>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {result
                  ? `IP Alocado: ${result.peer.vpnIp} — Pronto para acessar o Winbox`
                  : "Acesse seus MikroTiks remotamente via Winbox de onde estiver"}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {!result ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">
                  Tipo de Dispositivo
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    { id: "windows" as const, label: "Windows PC", icon: Monitor, desc: "Winbox nativo" },
                    { id: "android" as const, label: "Celular Android", icon: Smartphone, desc: "QR Code" },
                    { id: "ios" as const, label: "iPhone / iPad", icon: Smartphone, desc: "QR Code" },
                  ].map((dev) => {
                    const Icon = dev.icon;
                    const selected = deviceType === dev.id;
                    return (
                      <button
                        key={dev.id}
                        type="button"
                        onClick={() => setDeviceType(dev.id)}
                        className={`p-3 rounded-2xl border text-left flex flex-col items-center justify-center text-center transition-all cursor-pointer ${
                          selected
                            ? "bg-blue-50/80 border-blue-500 text-blue-900 shadow-xs ring-2 ring-blue-500/20"
                            : "bg-slate-50/60 border-slate-200 text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        <Icon className={`w-5 h-5 mb-1.5 ${selected ? "text-blue-600" : "text-slate-500"}`} />
                        <span className="text-xs font-black block">{dev.label}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">{dev.desc}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Nome do Dispositivo / Identificação
                </label>
                <input
                  type="text"
                  placeholder={
                    deviceType === "windows"
                      ? "Ex: Notebook Windows Lyncoln"
                      : deviceType === "android"
                      ? "Ex: Samsung Galaxy S23 (Admin)"
                      : "Ex: iPhone 15 Pro (Suporte)"
                  }
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs font-medium text-slate-800 focus:bg-white focus:border-blue-500 transition-colors"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Um nome amigável para identificar este dispositivo na lista de conexões.
                </p>
              </div>

              <div className="bg-blue-50/60 border border-blue-200/80 rounded-2xl p-4 flex items-start gap-3 text-xs text-blue-900">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Split-Tunneling Seguro Ativado</p>
                  <p className="text-blue-700 leading-relaxed text-[11px]">
                    Apenas o tráfego destinado aos MikroTiks e à VPS (<code className="font-mono bg-blue-100/70 px-1 py-0.5 rounded">10.8.0.0/24</code>) passará pela VPN. Sua internet e sites locais continuam rápidos e normais.
                  </p>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-black text-xs uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-blue-500/20 disabled:opacity-50"
                >
                  {loading ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      Gerando Chaves...
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 stroke-[2.5]" />
                      Criar Acesso VPN
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-5 animate-fade-in">
              {/* Top Banner */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-emerald-950 uppercase tracking-wider">
                      {result.peer.name} Cadastrado!
                    </span>
                  </div>
                  <p className="text-xs text-emerald-800 font-medium mt-0.5">
                    IP VPN Alocado: <strong className="font-mono">{result.peer.vpnIp}</strong>
                  </p>
                </div>
                <StatusBadge status="pending" />
              </div>

              {/* Tabs Switcher */}
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab("qr")}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === "qr"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                  <span>📱 QR Code (Celular)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("conf")}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === "conf"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>🪟 Arquivo .conf (Windows)</span>
                </button>
              </div>

              {activeTab === "qr" ? (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-4">
                  <div className="p-3.5 bg-white rounded-2xl shadow-md border border-slate-200">
                    <QRCodeSVG
                      value={result.clientConfig}
                      size={210}
                      level="M"
                      includeMargin
                    />
                  </div>
                  <div className="text-center max-w-sm space-y-1">
                    <p className="text-xs font-black text-slate-800">Como Conectar no Celular:</p>
                    <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
                      1. Instale o app <strong>WireGuard</strong> no Android ou iPhone.<br />
                      2. Toque no <strong>+</strong> e selecione <strong>Digitalizar código QR</strong>.<br />
                      3. Aponte a câmera para a tela e dê um nome (ex: <em>MikroGestor</em>).<br />
                      4. Ative a VPN e abra o Winbox Mobile conectando no IP do seu MikroTik!
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">
                          Configuração para Windows / Mac / Linux
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Baixe o arquivo de túnel para o app oficial do WireGuard.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={downloadConf}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-xs cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Baixar .conf</span>
                        </button>
                        <CopyButton text={result.clientConfig} label="Copiar" />
                      </div>
                    </div>

                    <div className="p-3 bg-white rounded-xl border border-slate-200/80 text-[11px] text-slate-600 font-medium space-y-1">
                      <p className="font-bold text-slate-800">Passo a passo no Windows:</p>
                      <p>1. Se ainda não tiver, baixe o <a href="https://www.wireguard.com/install/" target="_blank" rel="noreferrer" className="text-blue-600 underline font-bold">WireGuard for Windows</a>.</p>
                      <p>2. Clique em <strong>Adicionar Túnel</strong> e selecione o arquivo <strong>.conf</strong> baixado.</p>
                      <p>3. Clique em <strong>Ativar</strong>.</p>
                      <p>4. Abra o <strong>Winbox</strong> e conecte no IP do seu MikroTik (ex: <strong>10.8.0.2</strong>).</p>
                    </div>
                  </div>

                  <div>
                    <span className="block pb-1 text-[11px] font-bold text-slate-500">
                      Conteúdo do Arquivo .conf
                    </span>
                    <pre className="bg-[#0f172a] text-slate-200 p-3.5 rounded-2xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-48 custom-scrollbar border border-slate-800">
                      {result.clientConfig}
                    </pre>
                  </div>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-black text-xs uppercase tracking-wider transition-colors cursor-pointer shadow-sm"
                >
                  Concluído / Fechar
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal de Visualização de QR Code / Config do Peer Existente ───────────

interface ViewPeerQrModalProps {
  peer: VpnPeerClient;
  onClose: () => void;
}

function ViewPeerQrModal({ peer, onClose }: ViewPeerQrModalProps) {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<string>("");
  const [activeTab, setActiveTab] = useState<"qr" | "conf">(
    peer.deviceType === "android" || peer.deviceType === "ios" ? "qr" : "conf"
  );

  useEffect(() => {
    fetch(`/api/vpn/peers/${peer.id}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.clientConfig) setConfig(data.clientConfig);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [peer.id]);

  const downloadConf = () => {
    if (!config) return;
    const blob = new Blob([config], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const safeName = peer.name.toLowerCase().replace(/\s+/g, "-");
    a.download = `mikrogestor-${safeName}.conf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-hidden flex flex-col border border-slate-200">
        <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center">
              <DeviceIcon type={peer.deviceType} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900">{peer.name}</h2>
              <p className="text-xs text-slate-500 font-mono mt-0.5">IP VPN: {peer.vpnIp}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="p-6 overflow-y-auto space-y-5 flex-1 custom-scrollbar">
          {loading ? (
            <div className="p-12 text-center text-slate-500 font-bold text-xs animate-pulse">
              Carregando chaves e QR Code...
            </div>
          ) : !config ? (
            <div className="p-4 text-center text-rose-600 text-xs font-bold">
              Não foi possível carregar a configuração do túnel.
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-2xl text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setActiveTab("qr")}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === "qr"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                  <span>📱 QR Code (Celular)</span>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("conf")}
                  className={`py-2 px-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 ${
                    activeTab === "conf"
                      ? "bg-white text-slate-900 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Download className="w-3.5 h-3.5 text-blue-600" />
                  <span>🪟 Arquivo .conf</span>
                </button>
              </div>

              {activeTab === "qr" ? (
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <div className="p-3 bg-white rounded-2xl shadow-md border border-slate-200">
                    <QRCodeSVG value={config} size={210} level="M" includeMargin />
                  </div>
                  <p className="text-[11px] text-slate-500 text-center font-medium">
                    Aponte a câmera do aplicativo <strong>WireGuard</strong> para este QR Code.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Arquivo de Configuração</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={downloadConf}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-black bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-xs cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Baixar .conf</span>
                      </button>
                      <CopyButton text={config} label="Copiar" />
                    </div>
                  </div>
                  <pre className="bg-[#0f172a] text-slate-200 p-3.5 rounded-2xl text-[11px] font-mono leading-relaxed overflow-x-auto max-h-56 custom-scrollbar border border-slate-800">
                    {config}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Página Principal ─────────────────────────────────────────────────────

export default function VpnPage() {
  const [vpnRouters, setVpnRouters] = useState<VpnRouter[]>([]);
  const [allRouters, setAllRouters] = useState<RouterBasic[]>([]);
  const [peers, setPeers] = useState<VpnPeerClient[]>([]);
  const [loading, setLoading] = useState(true);

  // Modais
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreatePeerModal, setShowCreatePeerModal] = useState(false);
  const [selectedPeerForQr, setSelectedPeerForQr] = useState<VpnPeerClient | null>(null);
  const [selectedForConfig, setSelectedForConfig] = useState<RouterBasic | null>(null);

  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokingPeer, setRevokingPeer] = useState<string | null>(null);
  const [syncingSsl, setSyncingSsl] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const [statusRes, routersRes, peersRes] = await Promise.all([
        fetch("/api/vpn/status"),
        fetch("/api/system/routers").catch(() => null),
        fetch("/api/vpn/peers").catch(() => null),
      ]);

      if (statusRes.ok) {
        const data = await statusRes.json();
        setVpnRouters(data.routers ?? []);
      }
      if (routersRes?.ok) {
        const data = await routersRes.json();
        setAllRouters(data?.routers ?? []);
      }
      if (peersRes?.ok) {
        const data = await peersRes.json();
        setPeers(data?.peers ?? []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let isSubscribed = true;
    const fetchStatus = async () => {
      try {
        const [statusRes, routersRes, peersRes] = await Promise.all([
          fetch("/api/vpn/status"),
          fetch("/api/system/routers").catch(() => null),
          fetch("/api/vpn/peers").catch(() => null),
        ]);

        if (statusRes.ok && isSubscribed) {
          const data = await statusRes.json();
          setVpnRouters(data.routers ?? []);
        }
        if (routersRes?.ok && isSubscribed) {
          const data = await routersRes.json();
          setAllRouters(data?.routers ?? []);
        }
        if (peersRes?.ok && isSubscribed) {
          const data = await peersRes.json();
          setPeers(data?.peers ?? []);
        }
      } catch (err) {
        console.error(err);
      } finally {
        if (isSubscribed) setLoading(false);
      }
    };

    void fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => {
      isSubscribed = false;
      clearInterval(interval);
    };
  }, []);

  const revokeRouter = async (routerId: string, routerName: string) => {
    if (!confirm(`Revogar acesso VPN do roteador '${routerName}'? O MikroTik perderá a conexão com a plataforma.`)) return;
    setRevoking(routerId);
    try {
      await fetch(`/api/vpn/router/${routerId}/revoke`, { method: "DELETE" });
      await loadStatus();
    } finally {
      setRevoking(null);
    }
  };

  const revokePeer = async (peerId: string, peerName: string) => {
    if (!confirm(`Excluir o acesso VPN do dispositivo '${peerName}'? Ele não conseguirá mais conectar aos MikroTiks.`)) return;
    setRevokingPeer(peerId);
    try {
      await fetch(`/api/vpn/peers/${peerId}`, { method: "DELETE" });
      await loadStatus();
    } finally {
      setRevokingPeer(null);
    }
  };

  const syncSsl = async (routerId: string, routerName: string) => {
    setSyncingSsl(routerId);
    try {
      const res = await fetch(`/api/vpn/router/${routerId}/sync-ssl`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(data.message || `Erro ao sincronizar certificado SSL do roteador '${routerName}'.`);
      } else {
        alert(data.message || `SSL do roteador '${routerName}' sincronizado com sucesso!`);
        await loadStatus();
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      alert(`Falha na comunicação ao sincronizar SSL do roteador '${routerName}': ${errorMsg}`);
    } finally {
      setSyncingSsl(null);
    }
  };

  const nonVpnRouters = allRouters.filter((r) => !r.vpnEnabled);
  const connectedRouters = vpnRouters.filter((r) => r.vpnStatus === "connected").length;
  const connectedPeers = peers.filter((p) => p.status === "connected").length;
  const totalConnected = connectedRouters + connectedPeers;

  return (
    <main className="mg-page-container max-w-6xl mx-auto">
      {/* ── Top Header ────────────────────────────────────────────── */}
      <header className="mg-card p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--mg-primary)' }}>
              REMOTE ACCESS // WIREGUARD VPN GATEWAY
            </span>
          </div>
          <h1 className="mg-page-title flex items-center gap-2.5">
            <Shield className="w-6 h-6 text-blue-500" />
            VPN Control
          </h1>
          <p className="mg-page-subtitle mt-0.5">
            Gerenciamento de túneis seguros para MikroTiks, computadores e celulares com acesso direto ao Winbox
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowCreatePeerModal(true)}
            className="mg-btn mg-btn-secondary inline-flex items-center gap-2 text-xs uppercase tracking-wider"
          >
            <Laptop className="w-4 h-4" />
            <span>+ Conectar PC / Celular</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedForConfig(null);
              setShowCreateModal(true);
            }}
            className="mg-btn mg-btn-primary inline-flex items-center gap-2 text-xs uppercase tracking-wider"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>+ Novo MikroTik</span>
          </button>
        </div>
      </header>

      {/* ── Metric Cards ─────────────────────────────────────────── */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total Online na VPN", value: totalConnected, sub: `${connectedRouters} Roteador(es) · ${connectedPeers} Admin(s)`, variant: "mg-stat-teal" },
          { label: "MikroTiks Conectados", value: vpnRouters.length, sub: "Túneis de controle ativos", variant: "mg-stat-blue" },
          { label: "PCs e Celulares Admin", value: peers.length, sub: "Perfis com acesso Winbox", variant: "mg-stat-orange" },
        ].map((s) => (
          <div key={s.label} className={`mg-stat-card ${s.variant} flex items-center justify-between`}>
            <div>
              <span className="text-[11px] font-bold text-white/80 uppercase tracking-wider block">
                {s.label}
              </span>
              <p className="text-3xl font-black mt-1 text-white">{s.value}</p>
              <p className="text-[10px] text-white/70 font-medium mt-0.5">{s.sub}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-white/90 shadow-xs" />
          </div>
        ))}
      </section>

      {/* ── SEÇÃO 1: Roteadores MikroTik ──────────────────────────── */}
      <section className="mg-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--mg-card-border-subtle)]">
          <div>
            <h2 className="text-sm font-extrabold flex items-center gap-2" style={{ color: 'var(--mg-text-heading)' }}>
              <Wifi className="w-4 h-4 text-blue-600" />
              Roteadores MikroTik (Hotspots)
            </h2>
            <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">Túneis privados estabelecidos entre a VPS e as Routerboards</p>
          </div>
          <button
            onClick={loadStatus}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Atualizar
          </button>
        </div>

        {loading ? (
          <div className="p-12 text-center text-slate-500 font-bold text-xs animate-pulse">
            Carregando status dos túneis VPN...
          </div>
        ) : vpnRouters.length === 0 ? (
          <div className="p-8 text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-center mx-auto text-blue-600">
              <Shield className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900">Nenhum MikroTik Conectado</h3>
              <p className="text-xs text-slate-500 font-medium">
                Conecte sua primeira Routerboard via WireGuard para controle remoto sem IP público.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setSelectedForConfig(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Conectar MikroTik</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {vpnRouters.map((r) => (
              <div key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
                    <Wifi className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-black text-slate-900 text-sm">{r.name}</h4>
                      {r.subdomain && (
                        <a
                          href={`https://${r.subdomain}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
                          title="Acessar painel via HTTPS"
                        >
                          <Globe className="w-2.5 h-2.5" />
                          <span>{r.subdomain}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                      {r.sslActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Lock className="w-2.5 h-2.5 text-emerald-600" />
                          SSL Ativo
                        </span>
                      ) : r.subdomain ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          Aguardando SSL
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 font-mono">
                      <span>Winbox:</span>
                      <strong className="text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {r.vpnIp ?? "—"}
                      </strong>
                      {r.vpnIp && (
                        <button
                          onClick={() => navigator.clipboard.writeText(r.vpnIp!)}
                          className="text-[10px] text-blue-600 hover:text-blue-800 font-sans font-bold cursor-pointer"
                          title="Copiar IP do Winbox"
                        >
                          Copiar IP
                        </button>
                      )}
                      {r.user && (
                        <span className="text-slate-600 font-sans text-[11px] font-bold bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          Usuário: <strong className="font-mono text-slate-900">{r.user}</strong>
                        </span>
                      )}
                      {r.active && (
                        <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-blue-100 text-blue-800 border border-blue-200 font-sans">
                          Roteador Ativo
                        </span>
                      )}
                      {r.peer?.endpoint && (
                        <span className="text-slate-400">· {r.peer.endpoint}</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right text-xs text-slate-400 hidden md:block">
                    {r.peer ? (
                      <>
                        <p className="font-semibold text-slate-600">↑ {formatBytes(r.peer.transferTx)} · ↓ {formatBytes(r.peer.transferRx)}</p>
                        <p className="text-[10px] mt-0.5">Visto: {formatLastSeen(r.peer.lastHandshake)}</p>
                      </>
                    ) : (
                      <p className="text-[10px]">Visto: {formatLastSeen(r.vpnLastSeen)}</p>
                    )}
                  </div>

                  <StatusBadge status={r.vpnStatus} />

                  <div className="flex items-center gap-1.5">
                    {r.subdomain && (
                      <button
                        onClick={() => syncSsl(r.id, r.name)}
                        disabled={syncingSsl === r.id}
                        className="p-2 hover:bg-emerald-50 text-emerald-600 hover:text-emerald-700 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-emerald-200 disabled:opacity-40"
                        title="Sincronizar Certificado SSL no MikroTik"
                      >
                        <RefreshCw className={`w-4 h-4 ${syncingSsl === r.id ? "animate-spin" : ""}`} />
                      </button>
                    )}
                    <a
                      href={`/api/vpn/router/${r.id}/script`}
                      download
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                      title="Baixar script .rsc"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => revokeRouter(r.id, r.name)}
                      disabled={revoking === r.id}
                      className="p-2 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200 disabled:opacity-40"
                      title="Revogar acesso VPN"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── SEÇÃO 2: Dispositivos de Acesso Remoto (Windows / Celular) ──── */}
      <section className="mg-card rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--mg-card-border-subtle)] bg-[var(--mg-card-bg-subtle)]">
          <div>
            <h2 className="text-sm font-extrabold flex items-center gap-2" style={{ color: 'var(--mg-text-heading)' }}>
              <Laptop className="w-4 h-4 text-indigo-600" />
              Dispositivos de Acesso Remoto (Windows / Celular)
            </h2>
            <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">
              Conecte seu computador ou smartphone à VPN para abrir o Winbox de qualquer lugar
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowCreatePeerModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Adicionar Dispositivo</span>
          </button>
        </div>

        {peers.length === 0 ? (
          <div className="p-8 text-center space-y-3 max-w-md mx-auto">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center mx-auto text-indigo-600">
              <Laptop className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-black text-slate-900">Nenhum Dispositivo Cadastrado</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Crie um perfil para o seu computador Windows ou celular para conectar via WireGuard e abrir o Winbox dos MikroTiks remotamente.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreatePeerModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs transition-colors cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Conectar Meu Computador ou Celular</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {peers.map((p) => (
              <div key={p.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50/60 transition-colors">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center shrink-0">
                    <DeviceIcon type={p.deviceType} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-black text-slate-900 text-sm">{p.name}</h4>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-600 border border-slate-200">
                        {p.deviceType}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">
                      IP VPN: <strong className="text-slate-800">{p.vpnIp}</strong>
                      {p.endpoint && <span className="text-slate-400 ml-1.5">· {p.endpoint}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center">
                  <div className="text-right text-xs text-slate-400 hidden md:block">
                    <p className="font-semibold text-slate-600">
                      ↑ {formatBytes(p.transferTx)} · ↓ {formatBytes(p.transferRx)}
                    </p>
                    <p className="text-[10px] mt-0.5">Visto: {formatLastSeen(p.lastSeen)}</p>
                  </div>

                  <StatusBadge status={p.status} />

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setSelectedPeerForQr(p)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl transition-colors cursor-pointer border border-indigo-200 text-xs font-bold"
                      title="Ver QR Code para celular"
                    >
                      <QrCode className="w-3.5 h-3.5" />
                      <span>QR Code</span>
                    </button>

                    <a
                      href={`/api/vpn/peers/${p.id}/config`}
                      download
                      className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-blue-200"
                      title="Baixar arquivo de túnel .conf"
                    >
                      <Download className="w-4 h-4" />
                    </a>

                    <button
                      onClick={() => revokePeer(p.id, p.name)}
                      disabled={revokingPeer === p.id}
                      className="p-2 hover:bg-rose-50 text-rose-500 hover:text-rose-700 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-rose-200 disabled:opacity-40"
                      title="Excluir dispositivo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Guia Passo a Passo: Como Acessar via Winbox ────────────── */}
      <section className="bg-gradient-to-br from-slate-900 to-slate-950 rounded-2xl p-6 text-white shadow-md border border-slate-800 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
            <Monitor className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-white">Como Acessar o Winbox Remotamente</h3>
            <p className="text-xs text-slate-400">Instruções para conectar do computador ou do celular</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Card Windows */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-blue-400 font-black">
              <Monitor className="w-4 h-4" />
              <span>No Computador (Windows / Mac / Linux)</span>
            </div>
            <ol className="text-slate-300 space-y-1.5 list-decimal list-inside font-medium leading-relaxed">
              <li>Instale o cliente oficial <a href="https://www.wireguard.com/install/" target="_blank" rel="noreferrer" className="text-blue-400 underline font-bold">WireGuard</a>.</li>
              <li>Clique em <strong>+ Conectar PC / Celular</strong> acima e baixe o arquivo <strong>.conf</strong>.</li>
              <li>No WireGuard, clique em <strong>Adicionar Túnel</strong> e selecione o arquivo. Clique em <strong>Ativar</strong>.</li>
              <li>Abra o <strong>Winbox</strong>, e no campo <em>Connect To</em> digite o IP VPN do MikroTik (ex: <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded font-mono">10.8.0.2</code>).</li>
            </ol>
          </div>

          {/* Card Celular */}
          <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400 font-black">
              <Smartphone className="w-4 h-4" />
              <span>No Smartphone (Android / iPhone)</span>
            </div>
            <ol className="text-slate-300 space-y-1.5 list-decimal list-inside font-medium leading-relaxed">
              <li>Instale o app <strong>WireGuard</strong> na Google Play ou App Store.</li>
              <li>Toque no botão <strong>+</strong> e selecione <strong>Digitalizar código QR</strong>.</li>
              <li>Aponte para o QR Code do seu dispositivo gerado nesta página.</li>
              <li>Ative a chave da VPN e use o app <strong>MikroTik Pro</strong> ou <strong>Winbox Mobile</strong> conectando em <code className="text-emerald-300 bg-black/40 px-1 py-0.5 rounded font-mono">10.8.0.2</code>!</li>
            </ol>
          </div>
        </div>
      </section>

      {/* ── Roteadores Cadastrados sem VPN ────────────────────────── */}
      {nonVpnRouters.length > 0 && (
        <section className="mg-card rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-[var(--mg-card-border-subtle)] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-extrabold" style={{ color: 'var(--mg-text-heading)' }}>Roteadores Cadastrados sem VPN</h2>
              <p className="text-xs text-[var(--mg-text-muted)] mt-0.5">Routerboards locais que ainda não possuem túnel configurado</p>
            </div>
          </div>
          <div className="divide-y divide-[var(--mg-card-border-subtle)]">
            {nonVpnRouters.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-4 px-6 py-3.5 hover:bg-[var(--mg-card-bg-subtle)] transition-colors">
                <div>
                  <p className="font-bold text-xs" style={{ color: 'var(--mg-text-heading)' }}>{r.name}</p>
                  <p className="text-[11px] text-[var(--mg-text-muted)] font-mono mt-0.5">{r.host}</p>
                </div>
                <button
                  onClick={() => {
                    setSelectedForConfig(r);
                    setShowCreateModal(true);
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Configurar VPN</span>
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── Modal de Criação MikroTik ─────────────────────────────── */}
      {showCreateModal && (
        <CreateTunnelModal
          existingRouters={nonVpnRouters}
          selectedRouter={selectedForConfig}
          onClose={() => {
            setShowCreateModal(false);
            setSelectedForConfig(null);
          }}
          onSuccess={loadStatus}
        />
      )}

      {/* ── Modal de Criação Peer (Windows / Celular) ───────────────── */}
      {showCreatePeerModal && (
        <CreatePeerModal
          onClose={() => setShowCreatePeerModal(false)}
          onSuccess={loadStatus}
        />
      )}

      {/* ── Modal de QR Code de Peer Existente ────────────────────── */}
      {selectedPeerForQr && (
        <ViewPeerQrModal
          peer={selectedPeerForQr}
          onClose={() => setSelectedPeerForQr(null)}
        />
      )}
    </main>
  );
}