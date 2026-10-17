const fs = require('fs');
const path = require('path');

const TARGET_DIR = 'C:\\Users\\lynco\\OneDrive\\Documentos\\-Projetos\\CooliFy - MCP';

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

console.log(`[BUILD] Iniciando estruturação de: ${TARGET_DIR}`);
ensureDir(TARGET_DIR);
ensureDir(path.join(TARGET_DIR, 'mcp-server'));
ensureDir(path.join(TARGET_DIR, 'scripts'));
ensureDir(path.join(TARGET_DIR, 'docs'));

// -----------------------------------------------------------------------------
// 1. mcp-server/index.js (O Servidor MCP Standalone e Portátil)
// -----------------------------------------------------------------------------
const mcpServerIndexJs = `#!/usr/bin/env node
/**
 * Coolify & VPS Management MCP Server (v2.0.0)
 * Standalone, portable Model Context Protocol server for complete VPS Linux control,
 * Docker container lifecycle, WireGuard VPN inspection, and Coolify REST API automation.
 */

const fs = require('fs');
const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { CallToolRequestSchema, ListToolsRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { Client } = require('ssh2');

// --- Auto-carregamento de variáveis de ambiente (.env) ---
function loadEnvironment() {
  const candidateDirs = [
    process.cwd(),
    path.resolve(process.cwd(), 'mcp-server'),
    __dirname,
    path.resolve(__dirname, '..')
  ];

  for (const dir of candidateDirs) {
    const envFile = path.join(dir, '.env');
    if (fs.existsSync(envFile)) {
      try {
        if (typeof process.loadEnvFile === 'function') {
          process.loadEnvFile(envFile);
        }
      } catch (_) {}

      try {
        const content = fs.readFileSync(envFile, 'utf8');
        content.split(/\\r?\\n/).forEach(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return;
          const eqIdx = trimmed.indexOf('=');
          if (eqIdx > 0) {
            const key = trimmed.slice(0, eqIdx).trim();
            let val = trimmed.slice(eqIdx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        });
      } catch (_) {}
      break;
    }
  }
}

loadEnvironment();

// --- Configurações do Servidor e VPS ---
const SSH_HOST = process.env.COOLIFY_SERVER_IP || process.env.SSH_HOST || '';
const SSH_PORT = parseInt(process.env.COOLIFY_SSH_PORT || process.env.SSH_PORT || '22', 10);
const SSH_USER = process.env.COOLIFY_SSH_USER || process.env.SSH_USER || 'root';
const SSH_PASSWORD = process.env.COOLIFY_SSH_PASSWORD || process.env.SSH_PASSWORD || '';
const SSH_KEY_PATH = process.env.COOLIFY_SSH_KEY_PATH || process.env.SSH_KEY_PATH || '';
const SSH_PRIVATE_KEY = process.env.COOLIFY_SSH_PRIVATE_KEY || process.env.SSH_PRIVATE_KEY || '';
const SSH_PASSPHRASE = process.env.COOLIFY_SSH_PASSPHRASE || process.env.SSH_PASSPHRASE || '';

const DEFAULT_COOLIFY_URL = SSH_HOST ? \`http://\${SSH_HOST}:8000/api/v1\` : 'http://localhost:8000/api/v1';
const COOLIFY_API_URL = (process.env.COOLIFY_API_URL || DEFAULT_COOLIFY_URL).replace(/\\/+$/, '');
const COOLIFY_API_TOKEN = process.env.COOLIFY_API_TOKEN || '';
const COOLIFY_DEFAULT_APP_UUID = process.env.COOLIFY_DEFAULT_APP_UUID || '';

// --- Validador de Configuração SSH ---
function getSSHConfig() {
  if (!SSH_HOST) {
    throw new Error('COOLIFY_SERVER_IP ou SSH_HOST não configurado no .env.');
  }

  const config = {
    host: SSH_HOST,
    port: SSH_PORT,
    username: SSH_USER,
    readyTimeout: 20000,
    keepaliveInterval: 10000,
  };

  if (SSH_PRIVATE_KEY) {
    config.privateKey = SSH_PRIVATE_KEY;
    if (SSH_PASSPHRASE) config.passphrase = SSH_PASSPHRASE;
  } else if (SSH_KEY_PATH) {
    const resolvedPath = path.resolve(SSH_KEY_PATH.replace(/^~(?=$|\\/|\\\\)/, process.env.HOME || process.env.USERPROFILE || ''));
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(\`Arquivo de chave SSH não encontrado em: \${resolvedPath}\`);
    }
    config.privateKey = fs.readFileSync(resolvedPath);
    if (SSH_PASSPHRASE) config.passphrase = SSH_PASSPHRASE;
  } else if (SSH_PASSWORD) {
    config.password = SSH_PASSWORD;
  } else {
    throw new Error('Nenhuma credencial SSH configurada (informe COOLIFY_SSH_PASSWORD, COOLIFY_SSH_KEY_PATH ou COOLIFY_SSH_PRIVATE_KEY no .env).');
  }

  return config;
}

// --- Helper de Execução SSH Remota ---
function executeSSH(command, timeoutMs = 30000) {
  return new Promise((resolve) => {
    let conn;
    try {
      const sshConfig = getSSHConfig();
      conn = new Client();
      let stdout = '';
      let stderr = '';
      let timedOut = false;

      const timer = setTimeout(() => {
        timedOut = true;
        try { conn.end(); } catch (_) {}
        resolve({
          success: false,
          stdout,
          stderr: (stderr + \`\\n[TIMEOUT] Comando expirou após \${timeoutMs}ms\`).trim(),
          exitCode: 124
        });
      }, timeoutMs);

      conn.on('ready', () => {
        conn.exec(command, (err, stream) => {
          if (err) {
            clearTimeout(timer);
            try { conn.end(); } catch (_) {}
            return resolve({ success: false, stdout: '', stderr: err.message, exitCode: 1 });
          }

          stream.on('data', (d) => { stdout += d.toString(); });
          stream.stderr.on('data', (d) => { stderr += d.toString(); });
          stream.on('close', (code) => {
            clearTimeout(timer);
            try { conn.end(); } catch (_) {}
            if (!timedOut) {
              resolve({
                success: code === 0,
                stdout: stdout.trim(),
                stderr: stderr.trim(),
                exitCode: code ?? 0
              });
            }
          });
        });
      });

      conn.on('error', (err) => {
        clearTimeout(timer);
        resolve({
          success: false,
          stdout: '',
          stderr: \`Erro de conexão SSH com \${SSH_HOST}:\${SSH_PORT} (\${SSH_USER}): \${err.message}\`,
          exitCode: 1
        });
      });

      conn.connect(sshConfig);
    } catch (err) {
      resolve({
        success: false,
        stdout: '',
        stderr: \`Erro de configuração SSH: \${err.message}\`,
        exitCode: 1
      });
    }
  });
}

// --- Helper da API REST do Coolify ---
async function coolifyApiRequest(method, endpoint, body = null, query = null) {
  if (!COOLIFY_API_TOKEN) {
    return {
      status: 401,
      ok: false,
      error: 'COOLIFY_API_TOKEN não está configurado no .env. Gere um Bearer token em Coolify > Keys & Tokens > API Tokens.'
    };
  }

  let url = COOLIFY_API_URL + (endpoint.startsWith('/') ? endpoint : '/' + endpoint);
  if (query && Object.keys(query).length > 0) {
    const params = new URLSearchParams(query);
    url += '?' + params.toString();
  }

  const headers = {
    'Authorization': 'Bearer ' + COOLIFY_API_TOKEN,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };

  const options = {
    method,
    headers,
    signal: AbortSignal.timeout(30000)
  };

  if (body && method !== 'GET' && method !== 'HEAD') {
    options.body = typeof body === 'string' ? body : JSON.stringify(body);
  }

  try {
    const res = await fetch(url, options);
    const contentType = res.headers.get('content-type') || '';
    let data;
    if (contentType.includes('application/json')) {
      data = await res.json();
    } else {
      data = await res.text();
    }
    return { status: res.status, ok: res.ok, data };
  } catch (err) {
    return {
      status: 500,
      ok: false,
      error: \`Erro ao conectar com a API do Coolify em \${url}: \${err.message}\`
    };
  }
}

// --- Definição do MCP Server ---
const server = new Server(
  {
    name: 'coolify-mcp',
    version: '2.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// --- Registro das Ferramentas MCP ---
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'ssh_exec',
        description: 'Executa qualquer comando bash diretamente no host da VPS via SSH (com permissões de root/sudo).',
        inputSchema: {
          type: 'object',
          properties: {
            command: { type: 'string', description: 'O comando bash completo a ser executado no host da VPS' },
            timeout: { type: 'number', description: 'Timeout em milissegundos (padrão: 30000ms)' }
          },
          required: ['command']
        }
      },
      {
        name: 'docker_exec',
        description: 'Executa um comando dentro de um container Docker específico rodando na VPS.',
        inputSchema: {
          type: 'object',
          properties: {
            container: { type: 'string', description: 'Nome ou ID do container Docker' },
            command: { type: 'string', description: 'Comando bash a ser executado dentro do container' }
          },
          required: ['container', 'command']
        }
      },
      {
        name: 'docker_ps',
        description: 'Lista os containers Docker em execução na VPS com ID, Nome, Status, Imagem e Portas.',
        inputSchema: {
          type: 'object',
          properties: {
            all: { type: 'boolean', description: 'Se true, inclui containers parados (padrão: false)' }
          }
        }
      },
      {
        name: 'docker_logs',
        description: 'Retorna as últimas linhas de log de um container Docker específico na VPS.',
        inputSchema: {
          type: 'object',
          properties: {
            container: { type: 'string', description: 'Nome ou ID do container Docker' },
            tail: { type: 'number', description: 'Número de linhas de log a retornar (padrão: 100)' }
          },
          required: ['container']
        }
      },
      {
        name: 'wireguard_status',
        description: 'Verifica o status operacional do WireGuard na VPS (wg show, interface wg0, peers ativos e arquivo de configuração).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'vps_info',
        description: 'Retorna resumo diagnóstico completo da VPS (OS, Kernel, CPU, Memória RAM, Espaço em Disco, Uptime e status do Docker).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'coolify_api',
        description: 'Executa qualquer chamada arbitrária à API REST v1 do Coolify (GET, POST, PATCH, DELETE).',
        inputSchema: {
          type: 'object',
          properties: {
            method: { type: 'string', enum: ['GET', 'POST', 'PATCH', 'DELETE'], description: 'Método HTTP' },
            endpoint: { type: 'string', description: 'Caminho do endpoint (ex: /servers, /applications, /deploy)' },
            body: { type: 'object', description: 'Payload JSON opcional' },
            query: { type: 'object', description: 'Parâmetros de query string opcionais' }
          },
          required: ['method', 'endpoint']
        }
      },
      {
        name: 'coolify_list_servers',
        description: 'Lista todos os servidores registrados e gerenciados na instância do Coolify.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'coolify_list_projects',
        description: 'Lista todos os projetos e ambientes (environments) criados no Coolify.',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'coolify_list_applications',
        description: 'Lista todas as aplicações implantadas no Coolify (UUID, nome, status, domínios e repositório).',
        inputSchema: {
          type: 'object',
          properties: {}
        }
      },
      {
        name: 'coolify_get_application',
        description: 'Obtém detalhes completos, status e variáveis de ambiente de uma aplicação específica no Coolify pelo UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'UUID da aplicação no Coolify' }
          },
          required: ['uuid']
        }
      },
      {
        name: 'coolify_deploy_application',
        description: 'Dispara deploy ou redeploy de uma aplicação gerenciada pelo Coolify via API.',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'UUID da aplicação no Coolify (se omitido, utiliza COOLIFY_DEFAULT_APP_UUID)' },
            force: { type: 'boolean', description: 'Forçar rebuild sem cache (padrão: false)' }
          }
        }
      },
      {
        name: 'coolify_restart_application',
        description: 'Reinicia o container de uma aplicação no Coolify pelo UUID.',
        inputSchema: {
          type: 'object',
          properties: {
            uuid: { type: 'string', description: 'UUID da aplicação no Coolify' }
          },
          required: ['uuid']
        }
      }
    ]
  };
});

// --- Roteamento e Execução de Ferramentas ---
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'ssh_exec': {
        const res = await executeSSH(args.command, args.timeout);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(res, null, 2)
            }
          ]
        };
      }

      case 'docker_exec': {
        const cmd = \`docker exec \${args.container} \${args.command}\`;
        const res = await executeSSH(cmd);
        return {
          content: [{ type: 'text', text: res.stdout || res.stderr || (res.success ? 'Comando executado com sucesso.' : 'Erro na execução.') }]
        };
      }

      case 'docker_ps': {
        const flag = args?.all ? '-a' : '';
        const cmd = \`docker ps \${flag} --format "table {{.ID}}\\\\t{{.Names}}\\\\t{{.Status}}\\\\t{{.Ports}}"\`;
        const res = await executeSSH(cmd);
        return {
          content: [{ type: 'text', text: res.stdout || res.stderr || 'Nenhum container encontrado.' }]
        };
      }

      case 'docker_logs': {
        const tail = args?.tail || 100;
        const cmd = \`docker logs --tail \${tail} \${args.container}\`;
        const res = await executeSSH(cmd);
        return {
          content: [{ type: 'text', text: res.stdout || res.stderr || '(Nenhum log retornado)' }]
        };
      }

      case 'wireguard_status': {
        const cmd = 'wg show 2>&1; echo "\\\\n=== ARQUIVO /etc/wireguard/wg0.conf ==="; cat /etc/wireguard/wg0.conf 2>/dev/null || echo "(Arquivo wg0.conf não acessível)"';
        const res = await executeSSH(cmd);
        return {
          content: [{ type: 'text', text: res.stdout || res.stderr }]
        };
      }

      case 'vps_info': {
        const cmd = \`echo "=== SISTEMA & KERNEL ==="
uname -a
lsb_release -d 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME
echo -e "\\\\n=== UPTIME & CARGA ==="
uptime
echo -e "\\\\n=== MEMÓRIA RAM ==="
free -h
echo -e "\\\\n=== ESPAÇO EM DISCO ==="
df -h -x tmpfs -x devtmpfs -x overlay
echo -e "\\\\n=== STATUS DO DOCKER ==="
systemctl is-active docker 2>/dev/null || docker info 2>/dev/null | head -n 5
\`;
        const res = await executeSSH(cmd);
        return {
          content: [{ type: 'text', text: res.stdout || res.stderr }]
        };
      }

      case 'coolify_api': {
        const res = await coolifyApiRequest(args.method, args.endpoint, args.body, args.query);
        return {
          content: [{ type: 'text', text: JSON.stringify(res, null, 2) }]
        };
      }

      case 'coolify_list_servers': {
        const res = await coolifyApiRequest('GET', '/servers');
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data || res, null, 2) }]
        };
      }

      case 'coolify_list_projects': {
        const res = await coolifyApiRequest('GET', '/projects');
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data || res, null, 2) }]
        };
      }

      case 'coolify_list_applications': {
        const res = await coolifyApiRequest('GET', '/applications');
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data || res, null, 2) }]
        };
      }

      case 'coolify_get_application': {
        const res = await coolifyApiRequest('GET', \`/applications/\${args.uuid}\`);
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data || res, null, 2) }]
        };
      }

      case 'coolify_deploy_application': {
        const uuid = args?.uuid || COOLIFY_DEFAULT_APP_UUID;
        if (!uuid) {
          throw new Error('UUID da aplicação não especificado e COOLIFY_DEFAULT_APP_UUID não configurado no .env.');
        }
        const query = args?.force ? { force: 'true' } : null;
        const res = await coolifyApiRequest('POST', \`/deploy?uuid=\${uuid}\`, null, query);
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data || res, null, 2) }]
        };
      }

      case 'coolify_restart_application': {
        const res = await coolifyApiRequest('POST', \`/applications/\${args.uuid}/restart\`);
        return {
          content: [{ type: 'text', text: JSON.stringify(res.data || res, null, 2) }]
        };
      }

      default:
        throw new Error(\`Ferramenta desconhecida: \${name}\`);
    }
  } catch (error) {
    return {
      isError: true,
      content: [{ type: 'text', text: 'Erro ao executar ferramenta: ' + error.message }]
    };
  }
});

// --- Inicialização do Servidor Stdio ---
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[Coolify MCP v2.0.0] Servidor conectado via stdio e pronto para operações.');
}

main().catch((err) => {
  console.error('[Coolify MCP] Erro fatal na inicialização:', err);
  process.exit(1);
});
`;

fs.writeFileSync(path.join(TARGET_DIR, 'mcp-server', 'index.js'), mcpServerIndexJs, 'utf8');
console.log('[OK] Criado mcp-server/index.js');

// -----------------------------------------------------------------------------
// 2. package.json na Raiz do CooliFy - MCP
// -----------------------------------------------------------------------------
const rootPackageJson = {
  name: "coolify-mcp",
  version: "2.0.0",
  description: "Servidor MCP portátil para controle total de VPS Linux, Docker, WireGuard e Coolify REST API",
  main: "mcp-server/index.js",
  bin: {
    "coolify-mcp": "mcp-server/index.js"
  },
  scripts: {
    "start": "node mcp-server/index.js",
    "setup": "node scripts/setup.js",
    "test": "node scripts/test-connection.js",
    "check": "node scripts/test-connection.js"
  },
  keywords: [
    "mcp",
    "coolify",
    "vps",
    "docker",
    "wireguard",
    "devops",
    "agentic"
  ],
  author: "",
  license: "MIT",
  dependencies: {
    "@modelcontextprotocol/sdk": "^1.30.0",
    "dotenv": "^16.4.7",
    "ssh2": "^1.17.0"
  }
};

fs.writeFileSync(path.join(TARGET_DIR, 'package.json'), JSON.stringify(rootPackageJson, null, 2), 'utf8');
console.log('[OK] Criado package.json raiz');

// -----------------------------------------------------------------------------
// 3. .env.example e .env
// -----------------------------------------------------------------------------
const envExampleContent = `# ==============================================================================
# CONFIGURAÇÃO DE CONEXÃO VPS & COOLIFY MCP (v2.0.0)
# ==============================================================================
# Copie este arquivo para .env e preencha com os dados da sua VPS.
# Pode ser configurado automaticamente executando: npm run setup

# IP público ou domínio DNS da sua VPS
COOLIFY_SERVER_IP=2.25.168.82

# Porta SSH do host (padrão: 22)
COOLIFY_SSH_PORT=22

# Usuário SSH com permissão de root ou sudo sem senha (padrão: root)
COOLIFY_SSH_USER=root

# Opção A: Autenticação SSH por Senha
COOLIFY_SSH_PASSWORD=Lyncoln1985@

# Opção B: Autenticação SSH por Chave Privada (Recomendado para produção)
# COOLIFY_SSH_KEY_PATH=~/.ssh/id_ed25519
# COOLIFY_SSH_PASSPHRASE=
# COOLIFY_SSH_PRIVATE_KEY=

# ==============================================================================
# API REST DO COOLIFY (Gerenciamento de Aplicações, Bancos e Deploys)
# ==============================================================================

# URL base da API REST do Coolify (padrão: http://<IP>:8000/api/v1 ou domínio com HTTPS)
COOLIFY_API_URL=http://2.25.168.82:8000/api/v1

# Bearer Token da API (gerado em: Coolify UI > Keys & Tokens > API Tokens)
COOLIFY_API_TOKEN=1|plahDHthpFs9JStO2953AjsfsjZKGnd9B9gTgKfx3c95a991

# UUID da aplicação padrão no Coolify para deploy rápido com 1 clique (opcional)
COOLIFY_DEFAULT_APP_UUID=qtf1dw3ysntukjd7czu46msr
`;

fs.writeFileSync(path.join(TARGET_DIR, '.env.example'), envExampleContent, 'utf8');
fs.writeFileSync(path.join(TARGET_DIR, '.env'), envExampleContent, 'utf8');
console.log('[OK] Criados .env.example e .env');

// -----------------------------------------------------------------------------
// 4. scripts/test-connection.js (Diagnóstico Completo com 1 Comando)
// -----------------------------------------------------------------------------
const testConnectionJs = `#!/usr/bin/env node
/**
 * Test Connection & Diagnostics Script
 * Valida conectividade SSH, Docker, Coolify API e WireGuard na VPS.
 */

const fs = require('fs');
const path = require('path');

// Suporte a módulos no root ou no mcp-server
module.paths.push(path.resolve(__dirname, '../mcp-server/node_modules'));
module.paths.push(path.resolve(__dirname, '../node_modules'));

const { Client } = require('ssh2');

// Carregar variáveis
function loadEnv() {
  const candidateDirs = [process.cwd(), path.resolve(__dirname, '..'), path.resolve(__dirname, '../mcp-server')];
  for (const dir of candidateDirs) {
    const p = path.join(dir, '.env');
    if (fs.existsSync(p)) {
      if (typeof process.loadEnvFile === 'function') {
        try { process.loadEnvFile(p); } catch (_) {}
      }
      try {
        const lines = fs.readFileSync(p, 'utf8').split(/\\r?\\n/);
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) continue;
          const idx = trimmed.indexOf('=');
          if (idx > 0) {
            const key = trimmed.slice(0, idx).trim();
            let val = trimmed.slice(idx + 1).trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.slice(1, -1);
            }
            if (process.env[key] === undefined) process.env[key] = val;
          }
        }
      } catch (_) {}
      break;
    }
  }
}
loadEnv();

const IP = process.env.COOLIFY_SERVER_IP || process.env.SSH_HOST;
const PORT = parseInt(process.env.COOLIFY_SSH_PORT || '22', 10);
const USER = process.env.COOLIFY_SSH_USER || 'root';
const PASSWORD = process.env.COOLIFY_SSH_PASSWORD;
const KEY_PATH = process.env.COOLIFY_SSH_KEY_PATH;
const API_URL = (process.env.COOLIFY_API_URL || \`http://\${IP}:8000/api/v1\`).replace(/\\/+$/, '');
const API_TOKEN = process.env.COOLIFY_API_TOKEN;

console.log('\\n===============================================================');
console.log('   DIAGNÓSTICO DE INTEGRAÇÃO VPS & COOLIFY MCP v2.0.0');
console.log('===============================================================');
console.log(\`Target VPS: \${USER}@\${IP}:\${PORT}\`);
console.log(\`Coolify API: \${API_URL}\`);
console.log('---------------------------------------------------------------\\n');

if (!IP) {
  console.error('❌ ERRO: COOLIFY_SERVER_IP não definido no .env!');
  process.exit(1);
}

function runSSH(cmd) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    const cfg = { host: IP, port: PORT, username: USER, readyTimeout: 10000 };
    if (KEY_PATH && fs.existsSync(KEY_PATH)) {
      cfg.privateKey = fs.readFileSync(KEY_PATH);
    } else if (PASSWORD) {
      cfg.password = PASSWORD;
    } else {
      return reject(new Error('Nenhuma credencial SSH configurada no .env.'));
    }

    conn.on('ready', () => {
      conn.exec(cmd, (err, stream) => {
        if (err) { conn.end(); return reject(err); }
        let stdout = '';
        let stderr = '';
        stream.on('data', d => stdout += d.toString());
        stream.stderr.on('data', d => stderr += d.toString());
        stream.on('close', code => {
          conn.end();
          resolve({ code, stdout: stdout.trim(), stderr: stderr.trim() });
        });
      });
    });
    conn.on('error', err => reject(err));
    conn.connect(cfg);
  });
}

async function runDiagnostics() {
  let hasErrors = false;

  // 1. Teste de SSH & Host
  process.stdout.write('1. Conexão SSH & Sistema Operacional... ');
  try {
    const t0 = Date.now();
    const res = await runSSH('uname -srm; lsb_release -d 2>/dev/null || cat /etc/os-release | grep PRETTY_NAME');
    const latency = Date.now() - t0;
    if (res.code === 0) {
      console.log(\`✅ OK (\${latency}ms)\`);
      console.log(\`   OS: \${res.stdout.split('\\n').join(' | ')}\`);
    } else {
      console.log('⚠️ AVISO: ' + res.stderr);
    }
  } catch (err) {
    console.log('❌ FALHA!');
    console.error('   Motivo: ' + err.message);
    hasErrors = true;
  }

  // 2. Teste de Privilégios Root/Sudo
  process.stdout.write('\\n2. Verificação de Privilégios Root/Sudo... ');
  try {
    const res = await runSSH('id -u; whoami');
    if (res.code === 0) {
      const isRoot = res.stdout.startsWith('0');
      console.log(isRoot ? '✅ OK (Root Total)' : \`⚠️ Usuário: \${res.stdout.split('\\n')[1]} (Verifique permissão sudo sem senha)\`);
    }
  } catch (err) {
    console.log('❌ FALHA!');
    hasErrors = true;
  }

  // 3. Teste do Daemon Docker
  process.stdout.write('\\n3. Daemon Docker na VPS... ');
  try {
    const res = await runSSH('docker info --format "{{.ServerVersion}} (Containers: {{.ContainersRunning}} running / {{.Containers}} total)"');
    if (res.code === 0) {
      console.log('✅ OK');
      console.log(\`   Docker Version: \${res.stdout}\`);
    } else {
      console.log('❌ FALHA: Docker não está rodando ou usuário sem permissão.');
      console.log('   Stderr: ' + res.stderr);
      hasErrors = true;
    }
  } catch (err) {
    console.log('❌ FALHA: ' + err.message);
    hasErrors = true;
  }

  // 4. Teste da API REST do Coolify
  process.stdout.write('\\n4. Autenticação na API REST do Coolify... ');
  if (!API_TOKEN) {
    console.log('⚠️ PULADO (COOLIFY_API_TOKEN não configurado no .env)');
  } else {
    try {
      const res = await fetch(\`\${API_URL}/servers\`, {
        headers: {
          'Authorization': \`Bearer \${API_TOKEN}\`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(10000)
      });
      if (res.ok) {
        const data = await res.json();
        const count = Array.isArray(data) ? data.length : (data.data ? data.data.length : 1);
        console.log(\`✅ OK (HTTP \${res.status} - \${count} servidor(es) registrado(s))\`);
      } else {
        console.log(\`❌ ERRO HTTP \${res.status} (Verifique se o token tem permissões no Coolify)\`);
        hasErrors = true;
      }
    } catch (err) {
      console.log('❌ FALHA: ' + err.message);
      hasErrors = true;
    }
  }

  // 5. Teste de WireGuard (Opcional)
  process.stdout.write('\\n5. Módulo WireGuard (Kernel/Interface)... ');
  try {
    const res = await runSSH('which wg >/dev/null && wg show wg0 2>/dev/null | head -n 2 || echo "Not configured"');
    if (res.stdout && !res.stdout.includes('Not configured')) {
      console.log('✅ Ativo');
      console.log(\`   Interface: \${res.stdout.split('\\n')[0]}\`);
    } else {
      console.log('ℹ️  Disponível / Não iniciado como wg0');
    }
  } catch (_) {
    console.log('ℹ️  Não inspecionado');
  }

  console.log('\\n---------------------------------------------------------------');
  if (hasErrors) {
    console.log('❌ Foram detectados problemas na integração.');
    console.log('   Consulte docs/GUIA_INTEGRACAO_NOVA_VPS.md para corrigir.');
  } else {
    console.log('🎉 SUCESSO TOTAL! O Coolify MCP tem PODER COMPLETO sobre a VPS.');
    console.log('   O servidor MCP está pronto para ser consumido por seus assistentes de IA.');
  }
  console.log('===============================================================\\n');
}

runDiagnostics();
`;

fs.writeFileSync(path.join(TARGET_DIR, 'scripts', 'test-connection.js'), testConnectionJs, 'utf8');
console.log('[OK] Criado scripts/test-connection.js');

// -----------------------------------------------------------------------------
// 5. scripts/setup.js (Setup Interativo / 1-Comando de Integração)
// -----------------------------------------------------------------------------
const setupJs = `#!/usr/bin/env node
/**
 * Setup Wizard - Coolify MCP Server
 * Configura o MCP Server para qualquer VPS nova ou existente com 1 comando.
 * Gera .env, testa conexões e imprime blocos JSON prontos para Antigravity, Claude, Cursor, Windsurf e VS Code.
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT_DIR, '.env');
const SERVER_INDEX = path.join(ROOT_DIR, 'mcp-server', 'index.js');

console.log('\\n==================================================================');
console.log('   ASSISTENTE DE CONFIGURAÇÃO - COOLIFY MCP (NOVA VPS)');
console.log('==================================================================\\n');

// Leitura de parâmetros de linha de comando
const args = process.argv.slice(2);
const getArg = (name) => {
  const idx = args.indexOf(name);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
};
const isAuto = args.includes('--auto') || args.includes('-y');

// Carregar variáveis existentes se houver
let currentConfig = {
  COOLIFY_SERVER_IP: '2.25.168.82',
  COOLIFY_SSH_PORT: '22',
  COOLIFY_SSH_USER: 'root',
  COOLIFY_SSH_PASSWORD: 'Lyncoln1985@',
  COOLIFY_SSH_KEY_PATH: '',
  COOLIFY_API_URL: 'http://2.25.168.82:8000/api/v1',
  COOLIFY_API_TOKEN: '1|plahDHthpFs9JStO2953AjsfsjZKGnd9B9gTgKfx3c95a991',
  COOLIFY_DEFAULT_APP_UUID: 'qtf1dw3ysntukjd7czu46msr'
};

if (fs.existsSync(ENV_PATH)) {
  try {
    const lines = fs.readFileSync(ENV_PATH, 'utf8').split(/\\r?\\n/);
    lines.forEach(l => {
      const trimmed = l.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const eq = trimmed.indexOf('=');
      if (eq > 0) {
        const k = trimmed.slice(0, eq).trim();
        let v = trimmed.slice(eq + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (v) currentConfig[k] = v;
      }
    });
  } catch (_) {}
}

// Sobrescrever com flags de CLI se fornecidas
if (getArg('--ip')) currentConfig.COOLIFY_SERVER_IP = getArg('--ip');
if (getArg('--port')) currentConfig.COOLIFY_SSH_PORT = getArg('--port');
if (getArg('--user')) currentConfig.COOLIFY_SSH_USER = getArg('--user');
if (getArg('--password')) currentConfig.COOLIFY_SSH_PASSWORD = getArg('--password');
if (getArg('--key')) currentConfig.COOLIFY_SSH_KEY_PATH = getArg('--key');
if (getArg('--token')) currentConfig.COOLIFY_API_TOKEN = getArg('--token');
if (getArg('--apiUrl')) currentConfig.COOLIFY_API_URL = getArg('--apiUrl');

async function promptUser() {
  if (isAuto) return currentConfig;

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q, def) => new Promise(res => {
    rl.question(\`\${q} [\${def}]: \`, ans => res(ans.trim() || def));
  });

  console.log('Pressione ENTER para aceitar o valor padrão indicado entre colchetes.\\n');
  currentConfig.COOLIFY_SERVER_IP = await ask('IP ou Domínio da VPS', currentConfig.COOLIFY_SERVER_IP);
  currentConfig.COOLIFY_SSH_PORT = await ask('Porta SSH', currentConfig.COOLIFY_SSH_PORT);
  currentConfig.COOLIFY_SSH_USER = await ask('Usuário SSH', currentConfig.COOLIFY_SSH_USER);
  
  const authType = await ask('Tipo de autenticação SSH (1 = Senha, 2 = Chave Privada)', currentConfig.COOLIFY_SSH_KEY_PATH ? '2' : '1');
  if (authType === '2') {
    currentConfig.COOLIFY_SSH_KEY_PATH = await ask('Caminho da Chave SSH Privada', currentConfig.COOLIFY_SSH_KEY_PATH || '~/.ssh/id_rsa');
    currentConfig.COOLIFY_SSH_PASSWORD = '';
  } else {
    currentConfig.COOLIFY_SSH_PASSWORD = await ask('Senha SSH do usuário', currentConfig.COOLIFY_SSH_PASSWORD);
    currentConfig.COOLIFY_SSH_KEY_PATH = '';
  }

  const defaultApiUrl = \`http://\${currentConfig.COOLIFY_SERVER_IP}:8000/api/v1\`;
  currentConfig.COOLIFY_API_URL = await ask('URL da API REST do Coolify', currentConfig.COOLIFY_API_URL || defaultApiUrl);
  currentConfig.COOLIFY_API_TOKEN = await ask('Bearer Token da API do Coolify', currentConfig.COOLIFY_API_TOKEN);
  currentConfig.COOLIFY_DEFAULT_APP_UUID = await ask('UUID Padrão de Aplicação (Opcional)', currentConfig.COOLIFY_DEFAULT_APP_UUID);

  rl.close();
  return currentConfig;
}

async function main() {
  const config = await promptUser();

  // Salvar novo .env
  const newEnvContent = \`# ==============================================================================
# CONFIGURAÇÃO DE CONEXÃO VPS & COOLIFY MCP (Gerado por npm run setup)
# ==============================================================================
COOLIFY_SERVER_IP=\${config.COOLIFY_SERVER_IP}
COOLIFY_SSH_PORT=\${config.COOLIFY_SSH_PORT}
COOLIFY_SSH_USER=\${config.COOLIFY_SSH_USER}
\${config.COOLIFY_SSH_PASSWORD ? \`COOLIFY_SSH_PASSWORD=\${config.COOLIFY_SSH_PASSWORD}\` : '# COOLIFY_SSH_PASSWORD='}
\${config.COOLIFY_SSH_KEY_PATH ? \`COOLIFY_SSH_KEY_PATH=\${config.COOLIFY_SSH_KEY_PATH}\` : '# COOLIFY_SSH_KEY_PATH='}

# ==============================================================================
# API REST DO COOLIFY
# ==============================================================================
COOLIFY_API_URL=\${config.COOLIFY_API_URL}
COOLIFY_API_TOKEN=\${config.COOLIFY_API_TOKEN}
COOLIFY_DEFAULT_APP_UUID=\${config.COOLIFY_DEFAULT_APP_UUID}
\`;

  fs.writeFileSync(ENV_PATH, newEnvContent, 'utf8');
  console.log('\\n[OK] Arquivo .env atualizado com sucesso em: ' + ENV_PATH);

  // Executar teste de diagnóstico
  console.log('\\n[TESTE] Executando diagnóstico de conexão agora...');
  spawnSync('node', [path.join(ROOT_DIR, 'scripts', 'test-connection.js')], { stdio: 'inherit' });

  // Exibir blocos de integração para IDEs
  const escapedServerIndex = SERVER_INDEX.replace(/\\\\/g, '\\\\\\\\');
  
  console.log('\\n==================================================================');
  console.log('   CONFIGURAÇÕES PRONTAS PARA COLAR NA SUA IDE / CLIENTE MCP');
  console.log('==================================================================\\n');

  console.log('📁 1. PARA ANTIGRAVITY IDE (C:\\\\Users\\\\<usuario>\\\\.gemini\\\\config\\\\mcp_config.json):');
  console.log(JSON.stringify({
    mcpServers: {
      coolify: {
        command: "node",
        args: [SERVER_INDEX],
        env: {
          COOLIFY_SERVER_IP: config.COOLIFY_SERVER_IP,
          COOLIFY_SSH_PORT: config.COOLIFY_SSH_PORT,
          COOLIFY_SSH_USER: config.COOLIFY_SSH_USER,
          ...(config.COOLIFY_SSH_PASSWORD ? { COOLIFY_SSH_PASSWORD: config.COOLIFY_SSH_PASSWORD } : {}),
          ...(config.COOLIFY_SSH_KEY_PATH ? { COOLIFY_SSH_KEY_PATH: config.COOLIFY_SSH_KEY_PATH } : {}),
          COOLIFY_API_URL: config.COOLIFY_API_URL,
          COOLIFY_API_TOKEN: config.COOLIFY_API_TOKEN
        }
      }
    }
  }, null, 2));

  console.log('\\n📁 2. PARA CLAUDE DESKTOP (%APPDATA%\\\\Claude\\\\claude_desktop_config.json):');
  console.log(JSON.stringify({
    mcpServers: {
      coolify: {
        command: "node",
        args: [SERVER_INDEX]
      }
    }
  }, null, 2));

  console.log('\\n📁 3. PARA CURSOR (.cursor/mcp.json):');
  console.log(JSON.stringify({
    mcpServers: {
      coolify: {
        command: "node",
        args: [SERVER_INDEX]
      }
    }
  }, null, 2));

  console.log('\\n==================================================================');
  console.log('   CONFIGURAÇÃO CONCLUÍDA! O MCP ESTÁ TOTALMENTE OPERACIONAL.');
  console.log('==================================================================\\n');
}

main().catch(err => {
  console.error('Erro no assistente:', err);
  process.exit(1);
});
`;

fs.writeFileSync(path.join(TARGET_DIR, 'scripts', 'setup.js'), setupJs, 'utf8');
console.log('[OK] Criado scripts/setup.js');

// -----------------------------------------------------------------------------
// 6. README.md na Raiz do CooliFy - MCP
// -----------------------------------------------------------------------------
const readmeMd = `# 🚀 CooliFy - MCP (Model Context Protocol)

> Servidor MCP autônomo e portátil para gerenciamento completo de **VPS Linux**, **Docker**, **WireGuard VPN** e **Coolify REST API**.

Projetado para dar superpoderes a assistentes de Inteligência Artificial (**Antigravity IDE**, **Claude Desktop**, **Cursor**, **Windsurf**, **VS Code Cline/Roo Code**), permitindo executar diagnósticos, controlar containers Docker, ler logs em tempo real, aplicar correções no sistema operacional e gerenciar deploys com total segurança.

---

## ⚡ Início Rápido com Apenas 1 Comando

Se você clonou ou copiou esta pasta para qualquer local ou máquina, basta rodar:

\`\`\`bash
npm run setup
\`\`\`

O assistente interativo irá:
1. Solicitar os dados da sua VPS (ou usar as variáveis do \`.env\`).
2. Testar a conexão SSH remota.
3. Testar o acesso ao daemon Docker (\`docker ps\`).
4. Testar a autenticação na API do Coolify.
5. Gerar os blocos de configuração JSON prontos para colar na sua IDE.

---

## 🎯 Portabilidade Total: Usando em uma Nova VPS

Este projeto é **100% independente**. Para conectar a uma VPS completamente nova:

1. Copie a pasta \`CooliFy - MCP\` para onde desejar.
2. Certifique-se de que a nova VPS tem SSH acessível e o Coolify instalado (consulte o [Guia de Integração em Nova VPS](docs/GUIA_INTEGRACAO_NOVA_VPS.md)).
3. Execute:
   \`\`\`bash
   npm run setup
   \`\`\`
   Ou configure manualmente o arquivo \`.env\`:
   \`\`\`env
   COOLIFY_SERVER_IP=seu_novo_ip
   COOLIFY_SSH_USER=root
   COOLIFY_SSH_PASSWORD=sua_senha
   COOLIFY_API_URL=http://seu_novo_ip:8000/api/v1
   COOLIFY_API_TOKEN=seu_bearer_token
   \`\`\`
4. Rode o teste de validação:
   \`\`\`bash
   npm test
   \`\`\`

---

## 🛠️ Ferramentas Disponíveis no MCP

O servidor disponibiliza 13 ferramentas prontas para uso por agentes de IA:

| Ferramenta | Descrição |
|---|---|
| \`ssh_exec\` | Executa qualquer comando bash diretamente no host da VPS com privilégios de root/sudo. |
| \`vps_info\` | Retorna diagnóstico geral (OS, Kernel, CPU, Memória, Disco e status Docker). |
| \`docker_ps\` | Lista os containers Docker (ID, Nome, Status, Portas). |
| \`docker_exec\` | Executa comandos diretamente dentro de um container Docker. |
| \`docker_logs\` | Lê os logs mais recentes de qualquer container. |
| \`wireguard_status\` | Mostra status da interface wg0, peers ativos e arquivo \`/etc/wireguard/wg0.conf\`. |
| \`coolify_api\` | Faz qualquer chamada HTTP (GET, POST, PATCH, DELETE) na API do Coolify. |
| \`coolify_list_servers\` | Lista servidores gerenciados no Coolify. |
| \`coolify_list_projects\` | Lista projetos e ambientes. |
| \`coolify_list_applications\` | Lista aplicações implantadas com status e UUIDs. |
| \`coolify_get_application\` | Detalha variáveis de ambiente e status de um app pelo UUID. |
| \`coolify_deploy_application\` | Dispara deploy/redeploy (com opção de forçar sem cache). |
| \`coolify_restart_application\` | Reinicia o container de uma aplicação no Coolify. |

Para documentação detalhada de cada ferramenta com schemas e exemplos, leia [docs/FERRAMENTAS_MCP.md](docs/FERRAMENTAS_MCP.md).

---

## 📚 Documentação Completa

- [Guia de Integração em Nova VPS (Passo a Passo do Zero ao Poder Total)](docs/GUIA_INTEGRACAO_NOVA_VPS.md)
- [Catálogo Detalhado de Ferramentas MCP](docs/FERRAMENTAS_MCP.md)
- [Configuração em IDEs (Antigravity, Claude, Cursor, Windsurf)](docs/CONFIGURACAO_IDE.md)

---

## 🔒 Segurança

- Suporte completo a autenticação por **Chave Privada SSH** (\`COOLIFY_SSH_KEY_PATH\` ou \`COOLIFY_SSH_PRIVATE_KEY\`).
- Timeout configurável para evitar comandos travados.
- Sem dependências pesadas: roda de forma leve e instantânea via stdio transport.
`;

fs.writeFileSync(path.join(TARGET_DIR, 'README.md'), readmeMd, 'utf8');
console.log('[OK] Criado README.md');

// -----------------------------------------------------------------------------
// 7. docs/GUIA_INTEGRACAO_NOVA_VPS.md
// -----------------------------------------------------------------------------
const guiaIntegracaoMd = `# 📘 Guia de Integração em Nova VPS: Poder Total para o Coolify MCP

Este documento é o guia definitivo passo a passo para configurar **qualquer nova VPS** (Ubuntu 22.04 / 24.04 LTS ou Debian 12) para que o **CooliFy - MCP** tenha controle completo, seguro e automatizado.

---

## 📋 Sumário
1. [Requisitos Mínimos da VPS](#1-requisitos-mínimos-da-vps)
2. [Passo 1: Preparação do Sistema Operacional & Root](#passo-1-preparação-do-sistema-operacional--root)
3. [Passo 2: Configuração de Acesso SSH (Senha ou Chave SSH)](#passo-2-configuração-de-acesso-ssh-senha-ou-chave-ssh)
4. [Passo 3: Instalação do Docker & Coolify Oficial](#passo-3-instalação-do-docker--coolify-oficial)
5. [Passo 4: Criação do Bearer Token da API do Coolify](#passo-4-criação-do-bearer-token-da-api-do-coolify)
6. [Passo 5: Configuração de Firewall (UFW)](#passo-5-configuração-de-firewall-ufw)
7. [Passo 6: Conexão do MCP com 1 Comando](#passo-6-conexão-do-mcp-com-1-comando)
8. [Passo 7: Validação e Diagnóstico](#passo-7-validação-e-diagnóstico)

---

## 1. Requisitos Mínimos da VPS

- **Sistema Operacional**: Ubuntu 22.04 LTS, Ubuntu 24.04 LTS ou Debian 12 (64-bit).
- **Recursos recomendados**:
  - Mínimo: 2 vCPU, 2 GB RAM (com Swap de 2 GB) e 20 GB SSD.
  - Recomendado: 4 vCPU, 4 GB a 8 GB RAM e 50 GB NVMe.
- **Portas externas necessárias**:
  - \`22/tcp\`: Acesso SSH administrativo (ou porta customizada).
  - \`80/tcp\` e \`443/tcp\`: Tráfego Web / HTTPS com Let's Encrypt (Traefik).
  - \`8000/tcp\`: Painel Web do Coolify e API REST.
  - \`51820/udp\`: Túnel VPN WireGuard (se for utilizar VPN).

---

## Passo 1: Preparação do Sistema Operacional & Root

Conecte-se à VPS pela primeira vez via terminal:
\`\`\`bash
ssh root@<IP_DA_SUA_VPS>
\`\`\`

Atualize todos os pacotes do sistema:
\`\`\`bash
apt update && apt upgrade -y
apt install -y curl wget git ufw htop net-tools ca-certificates gnupg lsb-release
\`\`\`

Crie uma partição de Swap de 2 GB (fundamental para evitar Out of Memory em compilações):
\`\`\`bash
if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile
    echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
\`\`\`

---

## Passo 2: Configuração de Acesso SSH (Senha ou Chave SSH)

### Opção A: Acesso por Senha (Mais Rápido)
Certifique-se de que o SSH permite login por senha:
\`\`\`bash
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication no/PasswordAuthentication yes/' /etc/ssh/sshd_config
sed -i 's/#PermitRootLogin prohibit-password/PermitRootLogin yes/' /etc/ssh/sshd_config
systemctl restart ssh || systemctl restart sshd
\`\`\`

### Opção B: Acesso por Chave SSH Privada (Mais Seguro)
No seu computador pessoal:
\`\`\`bash
ssh-keygen -t ed25519 -C "coolify-mcp"
ssh-copy-id -i ~/.ssh/id_ed25519.pub root@<IP_DA_SUA_VPS>
\`\`\`
No \`.env\` do MCP, configure \`COOLIFY_SSH_KEY_PATH=~/.ssh/id_ed25519\`.

---

## Passo 3: Instalação do Docker & Coolify Oficial

O Coolify possui um instalador oficial de linha única que já instala o Docker Engine, Docker Compose, Traefik proxy e todas as dependências automaticamente:

\`\`\`bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
\`\`\`

Aguarde cerca de 2 a 3 minutos até que todos os containers subam. Você pode verificar com:
\`\`\`bash
docker ps
\`\`\`

---

## Passo 4: Criação do Bearer Token da API do Coolify

1. Acesse o painel web no seu navegador: \`http://<IP_DA_SUA_VPS>:8000\`.
2. Crie a conta de Administrador no primeiro acesso.
3. No menu lateral esquerdo, clique em **Keys & Tokens** (Chaves e Tokens).
4. Clique na aba **API Tokens**.
5. Clique no botão **Add New Token** (+ Adicionar Novo Token).
6. Dê um nome (ex: \`mcp-agent\`) e selecione as permissões (Recomendado: **Root** ou todas as permissões de leitura/escrita).
7. Copie o token gerado (ex: \`1|abcdef123456...\`).

---

## Passo 5: Configuração de Firewall (UFW)

Para garantir segurança sem bloquear o Coolify e o MCP:

\`\`\`bash
# Permitir conexões essenciais
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP Traefik'
ufw allow 443/tcp comment 'HTTPS Traefik'
ufw allow 8000/tcp comment 'Coolify UI & API'
ufw allow 51820/udp comment 'WireGuard VPN'

# Se o Docker precisar comunicar internamente
ufw allow from 172.16.0.0/12 to any

# Ativar o firewall
ufw --force enable
ufw status
\`\`\`

---

## Passo 6: Conexão do MCP com 1 Comando

No seu computador pessoal, dentro da pasta \`CooliFy - MCP\`:

\`\`\`bash
npm run setup
\`\`\`

O assistente solicitará:
- **IP da VPS**: \`<IP_DA_SUA_VPS>\`
- **Usuário SSH**: \`root\`
- **Senha ou Chave**: sua credencial
- **URL da API**: \`http://<IP_DA_SUA_VPS>:8000/api/v1\`
- **API Token**: o token gerado no Passo 4

---

## Passo 7: Validação e Diagnóstico

Para confirmar que o MCP tem poder total sobre a VPS:

\`\`\`bash
npm test
\`\`\`

Se todas as etapas exibirem \`✅ OK\`, sua IA já pode gerenciar 100% da nova VPS!
`;

fs.writeFileSync(path.join(TARGET_DIR, 'docs', 'GUIA_INTEGRACAO_NOVA_VPS.md'), guiaIntegracaoMd, 'utf8');
console.log('[OK] Criado docs/GUIA_INTEGRACAO_NOVA_VPS.md');

// -----------------------------------------------------------------------------
// 8. docs/FERRAMENTAS_MCP.md
// -----------------------------------------------------------------------------
const ferramentasMd = `# 🛠️ Catálogo Completo das Ferramentas do Coolify MCP (v2.0.0)

O servidor MCP expõe 13 ferramentas projetadas para cobrir todas as necessidades de administração remota, orquestração de containers, depuração de rede e automação de deploys.

---

### 1. \`ssh_exec\`
Executa comandos bash diretamente no host da VPS com privilégios de root.
- **Parâmetros**:
  - \`command\` (string, obrigatório): O comando bash completo.
  - \`timeout\` (número, opcional): Limite em ms (padrão: 30000ms).
- **Exemplo de uso**:
  \`\`\`json
  { "command": "ufw status verbose" }
  \`\`\`
- **Resposta**: Retorna objeto com \`success\`, \`stdout\`, \`stderr\` e \`exitCode\`.

---

### 2. \`vps_info\`
Retorna um relatório executivo do estado da VPS em uma única chamada.
- **Parâmetros**: Nenhum.
- **Conteúdo retornado**:
  - Sistema operacional e versão do Kernel Linux.
  - Uptime e carga média (Load Average).
  - Uso de Memória RAM (Total, Usada, Livre).
  - Espaço em Disco nas partições raiz e montadas.
  - Status operacional do serviço Docker.

---

### 3. \`docker_ps\`
Lista todos os containers ativos ou totais com formatação limpa.
- **Parâmetros**:
  - \`all\` (boolean, opcional): Se \`true\`, inclui containers parados (padrão: \`false\`).
- **Exemplo de resposta**:
  \`\`\`text
  CONTAINER ID   NAMES               STATUS         PORTS
  8533b45b2cfd   mikrogestor-app     Up 3 hours     0.0.0.0:80->80/tcp
  4a8b1c2d3e4f   coolify-proxy       Up 5 days      0.0.0.0:80->80/tcp, 0.0.0.0:443->443/tcp
  \`\`\`

---

### 4. \`docker_exec\`
Executa qualquer comando dentro de um container Docker específico.
- **Parâmetros**:
  - \`container\` (string, obrigatório): Nome ou ID do container.
  - \`command\` (string, obrigatório): Comando a executar dentro do container.
- **Exemplo de uso**:
  \`\`\`json
  { "container": "mikrogestor-app", "command": "npx prisma status" }
  \`\`\`

---

### 5. \`docker_logs\`
Lê as últimas linhas de log de um container Docker para resolução de problemas em tempo real.
- **Parâmetros**:
  - \`container\` (string, obrigatório): Nome ou ID do container.
  - \`tail\` (número, opcional): Número de linhas de log (padrão: 100).

---

### 6. \`wireguard_status\`
Retorna o status completo da VPN WireGuard na VPS.
- **Parâmetros**: Nenhum.
- **Conteúdo retornado**:
  - Execução de \`wg show\` (interface, chave pública, porta de escuta, peers conectados, tráfego e handshake).
  - Conteúdo do arquivo de configuração \`/etc/wireguard/wg0.conf\`.

---

### 7. \`coolify_api\`
Canivete suíço para qualquer endpoint da API REST v1 do Coolify.
- **Parâmetros**:
  - \`method\` (enum: "GET", "POST", "PATCH", "DELETE", obrigatório).
  - \`endpoint\` (string, obrigatório): Ex: \`/servers\`, \`/applications\`, \`/deploy\`.
  - \`body\` (object, opcional): Payload JSON.
  - \`query\` (object, opcional): Parâmetros de consulta URL.

---

### 8. \`coolify_list_servers\`
Lista todos os servidores registrados e gerenciados no Coolify.
- **Parâmetros**: Nenhum.

---

### 9. \`coolify_list_projects\`
Lista todos os projetos e seus respectivos ambientes (production, staging).
- **Parâmetros**: Nenhum.

---

### 10. \`coolify_list_applications\`
Lista todas as aplicações implantadas na instância do Coolify.
- **Retorno**: UUID, nome, status atual, repositório Git vinculado e domínios FQDN configurados.

---

### 11. \`coolify_get_application\`
Obtém detalhes completos de uma aplicação específica no Coolify.
- **Parâmetros**:
  - \`uuid\` (string, obrigatório): UUID da aplicação.
- **Retorno**: Configuração de portas, variáveis de ambiente, volumes persistentes e status de build.

---

### 12. \`coolify_deploy_application\`
Dispara o build e deploy automatizado de uma aplicação gerenciada.
- **Parâmetros**:
  - \`uuid\` (string, opcional se configurado \`COOLIFY_DEFAULT_APP_UUID\`).
  - \`force\` (boolean, opcional): Se \`true\`, reconstrói imagens Docker sem usar cache de build.

---

### 13. \`coolify_restart_application\`
Reinicia imediatamente os containers de uma aplicação no Coolify.
- **Parâmetros**:
  - \`uuid\` (string, obrigatório): UUID da aplicação.
`;

fs.writeFileSync(path.join(TARGET_DIR, 'docs', 'FERRAMENTAS_MCP.md'), ferramentasMd, 'utf8');
console.log('[OK] Criado docs/FERRAMENTAS_MCP.md');

// -----------------------------------------------------------------------------
// 9. docs/CONFIGURACAO_IDE.md
// -----------------------------------------------------------------------------
const configuracaoIdeMd = `# 💻 Configuração do Coolify MCP nas Principais IDEs e Clientes MCP

Copie e cole o bloco correspondente ao seu ambiente de desenvolvimento.

---

## 1. Antigravity IDE
Arquivo: \`C:\\Users\\<seu_usuario>\\.gemini\\config\\mcp_config.json\`

\`\`\`json
{
  "mcpServers": {
    "coolify": {
      "command": "node",
      "args": [
        "${TARGET_DIR.replace(/\\/g, '\\\\\\\\')}\\\\mcp-server\\\\index.js"
      ]
    }
  }
}
\`\`\`

*(Nota: Como o servidor carrega o \`.env\` automaticamente, você não precisa duplicar as senhas no arquivo \`mcp_config.json\`!)*

---

## 2. Claude Desktop
- **Windows**: \`%APPDATA%\\Claude\\claude_desktop_config.json\`
- **macOS**: \`~/Library/Application Support/Claude/claude_desktop_config.json\`

\`\`\`json
{
  "mcpServers": {
    "coolify": {
      "command": "node",
      "args": [
        "${TARGET_DIR.replace(/\\/g, '\\\\\\\\')}\\\\mcp-server\\\\index.js"
      ]
    }
  }
}
\`\`\`

---

## 3. Cursor IDE
No seu projeto ou globalmente em \`~/.cursor/mcp.json\` ou na raiz do workspace em \`.cursor/mcp.json\`:

\`\`\`json
{
  "mcpServers": {
    "coolify": {
      "command": "node",
      "args": [
        "${TARGET_DIR.replace(/\\/g, '\\\\\\\\')}\\\\mcp-server\\\\index.js"
      ]
    }
  }
}
\`\`\`

---

## 4. Windsurf / Codeium
Arquivo: \`~/.codeium/windsurf/mcp_config.json\`

\`\`\`json
{
  "mcpServers": {
    "coolify": {
      "command": "node",
      "args": [
        "${TARGET_DIR.replace(/\\/g, '\\\\\\\\')}\\\\mcp-server\\\\index.js"
      ]
    }
  }
}
\`\`\`

---

## 5. VS Code (Cline / Roo Code / Claude Dev)
Nas configurações da extensão (Settings > MCP Servers):
- **Name**: \`coolify\`
- **Command**: \`node\`
- **Args**: \`["${TARGET_DIR.replace(/\\/g, '\\\\\\\\')}\\\\mcp-server\\\\index.js"]\`
`;

fs.writeFileSync(path.join(TARGET_DIR, 'docs', 'CONFIGURACAO_IDE.md'), configuracaoIdeMd, 'utf8');
console.log('[OK] Criado docs/CONFIGURACAO_IDE.md');

console.log('\\n[CONCLUÍDO] CooliFy - MCP totalmente estruturado, documentado e preparado!');
