const fs = require('fs');

const script = `#!/usr/bin/env python3
import http.server, json, subprocess, os, sys, logging, hmac, base64, urllib.parse

logging.basicConfig(level=logging.INFO, format='%(asctime)s [WG-MGR] %(levelname)s %(message)s')
log = logging.getLogger(__name__)

WG_INTERFACE = os.environ.get('WG_INTERFACE', 'wg0')
BIND_HOST    = '0.0.0.0'
BIND_PORT    = int(os.environ.get('WG_MANAGER_PORT', '51821'))
SECRET_FILE  = '/etc/mikrogestor-wg.secret'

def load_secret():
    try:
        with open(SECRET_FILE) as f:
            return f.read().strip()
    except Exception as e:
        log.error(f'Cannot read secret: {e}')
        sys.exit(1)

SECRET = load_secret()

def run(cmd):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    return result.stdout.strip(), result.stderr.strip(), result.returncode

def verify_secret(headers):
    auth = headers.get('X-WG-Secret', '')
    return hmac.compare_digest(auth, SECRET)

class WGHandler(http.server.BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        log.info(f'{self.client_address[0]} - {format % args}')

    def send_json(self, code, data):
        body = json.dumps(data).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', len(body))
        self.end_headers()
        self.wfile.write(body)

    def read_body(self):
        length = int(self.headers.get('Content-Length', 0))
        return json.loads(self.rfile.read(length)) if length else {}

    def do_GET(self):
        if not verify_secret(self.headers):
            return self.send_json(401, {'error': 'Unauthorized'})
        if self.path == '/health':
            return self.send_json(200, {'ok': True})
        if self.path == '/status':
            stdout, stderr, rc = run(f'wg show {WG_INTERFACE} dump')
            if rc != 0:
                return self.send_json(500, {'error': stderr})
            lines = [l for l in stdout.splitlines() if l.strip()]
            peers = []
            for line in lines[1:]:
                parts = line.split('\t')
                if len(parts) < 8:
                    continue
                pub_key, _, endpoint, allowed_ips, last_hs, rx, tx, _ = parts[:8]
                peers.append({
                    'publicKey': pub_key,
                    'endpoint': endpoint if endpoint != '(none)' else None,
                    'allowedIps': allowed_ips,
                    'lastHandshake': int(last_hs),
                    'transferRx': int(rx),
                    'transferTx': int(tx),
                })
            return self.send_json(200, {'interface': WG_INTERFACE, 'peers': peers})
        if self.path.startswith('/cert/extract'):
            query = urllib.parse.urlparse(self.path).query
            params = urllib.parse.parse_qs(query)
            target_domain = params.get('domain', [''])[0].strip()
            if not target_domain:
                return self.send_json(400, {'error': 'domain query parameter required'})
            acme_path = '/data/coolify/proxy/acme.json'
            if not os.path.exists(acme_path):
                return self.send_json(404, {'error': 'acme.json not found'})
            try:
                with open(acme_path, 'r', encoding='utf-8') as f:
                    acme_data = json.load(f)
                certs = acme_data.get('letsencrypt', {}).get('Certificates', [])
                for c in certs:
                    d_main = c.get('domain', {}).get('main', '')
                    d_sans = c.get('domain', {}).get('sans', []) or []
                    if d_main == target_domain or target_domain in d_sans:
                        cert_b64 = c.get('certificate', '')
                        key_b64 = c.get('key', '')
                        cert_str = base64.b64decode(cert_b64).decode('utf-8', errors='ignore')
                        key_str = base64.b64decode(key_b64).decode('utf-8', errors='ignore')
                        return self.send_json(200, {
                            'ok': True,
                            'domain': target_domain,
                            'certificate': cert_str,
                            'privateKey': key_str
                        })
                return self.send_json(404, {'error': f'Certificate for {target_domain} not found in acme.json'})
            except Exception as e:
                return self.send_json(500, {'error': str(e)})
        return self.send_json(404, {'error': 'Not found'})

    def do_POST(self):
        if not verify_secret(self.headers):
            return self.send_json(401, {'error': 'Unauthorized'})
        body = self.read_body()
        if self.path == '/peer/add':
            pub_key = body.get('publicKey', '').strip()
            vpn_ip  = body.get('vpnIp', '').strip()
            if not pub_key or not vpn_ip:
                return self.send_json(400, {'error': 'publicKey and vpnIp required'})
            _, err, rc = run(f'wg set {WG_INTERFACE} peer "{pub_key}" allowed-ips {vpn_ip}/32')
            if rc != 0:
                return self.send_json(500, {'error': err})
            run(f'wg-quick save {WG_INTERFACE}')
            return self.send_json(200, {'ok': True, 'vpnIp': vpn_ip})
        if self.path == '/peer/remove':
            pub_key = body.get('publicKey', '').strip()
            if not pub_key:
                return self.send_json(400, {'error': 'publicKey required'})
            run(f'wg set {WG_INTERFACE} peer "{pub_key}" remove')
            run(f'wg-quick save {WG_INTERFACE}')
            return self.send_json(200, {'ok': True})
        if self.path == '/traefik/subdomain/add':
            subdomain = body.get('subdomain', '').strip()
            vpn_ip    = body.get('vpnIp', '').strip()
            slug      = body.get('slug', '').strip()
            if not subdomain or not vpn_ip or not slug:
                return self.send_json(400, {'error': 'subdomain, vpnIp, and slug required'})
            dynamic_dir = '/data/coolify/proxy/dynamic'
            os.makedirs(dynamic_dir, exist_ok=True)
            yaml_content = f"""# Auto-generated by MikroGestor for router {slug}
http:
  routers:
    router-{slug}:
      entryPoints:
        - https
      rule: Host(\`{subdomain}\`)
      service: service-{slug}
      tls:
        certResolver: letsencrypt
    router-{slug}-http:
      entryPoints:
        - http
      rule: Host(\`{subdomain}\`)
      service: service-{slug}
  services:
    service-{slug}:
      loadBalancer:
        servers:
          - url: "http://{vpn_ip}:80"
"""
            file_path = os.path.join(dynamic_dir, f'router-{slug}.yaml')
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(yaml_content)
            log.info(f'Traefik dynamic proxy created: {file_path} ({subdomain} -> {vpn_ip}:80)')
            return self.send_json(200, {'ok': True, 'file': file_path, 'subdomain': subdomain})
        if self.path == '/traefik/subdomain/remove':
            slug = body.get('slug', '').strip()
            if not slug:
                return self.send_json(400, {'error': 'slug required'})
            file_path = os.path.join('/data/coolify/proxy/dynamic', f'router-{slug}.yaml')
            if os.path.exists(file_path):
                os.remove(file_path)
                log.info(f'Traefik dynamic proxy removed: {file_path}')
            return self.send_json(200, {'ok': True})
        return self.send_json(404, {'error': 'Not found'})

if __name__ == '__main__':
    # Garante NAT Masquerade e forwarding para clientes WireGuard com Full Tunnel (navegação protegida pela VPS)
    try:
        run(f'iptables -t nat -C POSTROUTING -s 10.8.0.0/24 ! -o {WG_INTERFACE} -j MASQUERADE 2>/dev/null || iptables -t nat -A POSTROUTING -s 10.8.0.0/24 ! -o {WG_INTERFACE} -j MASQUERADE')
        run(f'iptables -C FORWARD -i {WG_INTERFACE} -j ACCEPT 2>/dev/null || iptables -A FORWARD -i {WG_INTERFACE} -j ACCEPT')
        run(f'iptables -C FORWARD -o {WG_INTERFACE} -j ACCEPT 2>/dev/null || iptables -A FORWARD -o {WG_INTERFACE} -j ACCEPT')
        run('sysctl -w net.ipv4.ip_forward=1')
    except Exception as e:
        log.warning(f'Could not configure NAT masquerade for full tunnel: {e}')

    server = http.server.HTTPServer((BIND_HOST, BIND_PORT), WGHandler)
    log.info(f'WG Manager listening on {BIND_HOST}:{BIND_PORT}')
    server.serve_forever()
`;

const b64 = Buffer.from(script).toString('base64');
console.log('BASE64 LENGTH:', b64.length);

// Atualiza o vpn/setup-vps.sh automaticamente
const setupVpsPath = 'vpn/setup-vps.sh';
if (fs.existsSync(setupVpsPath)) {
  let setupContent = fs.readFileSync(setupVpsPath, 'utf8');
  setupContent = setupContent.replace(
    /cat << 'EOF' \| base64 -d > "\$WG_MANAGER_DIR\/wg-manager\.py"[\s\S]*?EOF/,
    `cat << 'EOF' | base64 -d > "$WG_MANAGER_DIR/wg-manager.py"\n${b64}\nEOF`
  );
  fs.writeFileSync(setupVpsPath, setupContent, 'utf8');
  console.log('vpn/setup-vps.sh atualizado com sucesso com o novo daemon!');
}
