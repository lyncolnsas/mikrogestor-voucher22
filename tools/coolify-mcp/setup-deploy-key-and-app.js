const crypto = require('crypto');
const fs = require('fs');

(async () => {
  try {
    const coolifyToken = '1|ZsWs6Y7VLoibnEqyj9rFLZn0AemzrW8ptvRbyVFB53e7c8e9';
    const coolifyBase = 'http://2.25.168.82:8000/api/v1';
    const ghToken = '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';
    const repo = 'lyncolnsas/mikrogestor-voucher22';

    console.log('1. Generating Ed25519 Deploy Key Pair...');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ed25519', {
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
    });

    // We can use ssh-keygen via ssh on the host to generate exact OpenSSH formats
    const { execSync } = require('child_process');
    // Or generate OpenSSH key directly on the VPS host:
    const sshExec = require('./ssh-exec-promise');
    const sshGen = await sshExec('ssh-keygen -t ed25519 -N "" -C "Coolify-MikroGestor" -f /tmp/id_deploy_tmp <<< y >/dev/null 2>&1 && cat /tmp/id_deploy_tmp.pub && echo "---KEY-SEP---" && cat /tmp/id_deploy_tmp && rm -f /tmp/id_deploy_tmp*');
    
    const [pubKeyOpenSSH, privKeyOpenSSH] = sshGen.stdout.split('---KEY-SEP---').map(s => s.trim());
    console.log('Public Key (OpenSSH):', pubKeyOpenSSH);

    console.log('\n2. Registering Deploy Key in GitHub repository (' + repo + ')...');
    const ghRes = await fetch(`https://api.github.com/repos/${repo}/keys`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ghToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json',
        'User-Agent': 'MikroGestor-Deploy'
      },
      body: JSON.stringify({
        title: `Coolify-Deploy-Key-${Date.now()}`,
        key: pubKeyOpenSSH,
        read_only: true
      })
    });
    console.log('GitHub API Status:', ghRes.status);
    const ghData = await ghRes.json();
    if (!ghRes.ok) {
      console.error('GitHub error:', ghData);
      process.exit(1);
    }
    console.log('GitHub Deploy Key ID:', ghData.id);

    console.log('\n3. Registering Private Key in Coolify...');
    const coolifyKeyRes = await fetch(`${coolifyBase}/security/keys`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + coolifyToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        name: 'GitHub-MikroGestor-Deploy-Key',
        description: 'Chave SSH de deploy para o repositorio privado do MikroGestor',
        private_key: privKeyOpenSSH
      })
    });
    console.log('Coolify Key Status:', coolifyKeyRes.status);
    const coolifyKeyData = await coolifyKeyRes.json();
    const privateKeyUuid = coolifyKeyData.uuid;
    console.log('Coolify Private Key UUID:', privateKeyUuid);

    console.log('\n4. Deleting old application (kfwuxbgcssbowditdaajzk2j)...');
    await fetch(`${coolifyBase}/applications/kfwuxbgcssbowditdaajzk2j`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + coolifyToken }
    });

    console.log('\n5. Creating new Application with private-deploy-key...');
    const appPayload = {
      project_uuid: 'kz9qzyegfr7oxgq8h5bnkeu4',
      server_uuid: 'uedsvmjdtfytmnvfdkoyxgh5',
      environment_name: 'production',
      destination_uuid: 'ycothdgjef9q9t6jcrbvxlxy',
      private_key_uuid: privateKeyUuid,
      git_repository: 'git@github.com:lyncolnsas/mikrogestor-voucher22.git',
      git_branch: 'main',
      build_pack: 'nixpacks',
      ports_exposes: '80',
      name: 'MikroGestor',
      description: 'MikroGestor Hotspot e Voucher System',
      domains: 'https://mikrogestor.com, https://www.mikrogestor.com'
    };

    const newAppRes = await fetch(`${coolifyBase}/applications/private-deploy-key`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + coolifyToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(appPayload)
    });
    console.log('New App Status:', newAppRes.status);
    const newAppData = await newAppRes.json();
    const newAppUuid = newAppData.uuid;
    console.log('New App UUID:', newAppUuid);

    console.log('\n6. Configuring custom_docker_run_options and HTTPS...');
    await fetch(`${coolifyBase}/applications/${newAppUuid}`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + coolifyToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        custom_docker_run_options: '-v /data/mikrogestor/prisma:/app/prisma',
        ports_exposes: '80',
        domains: 'https://mikrogestor.com, https://www.mikrogestor.com',
        is_force_https_enabled: true
      })
    });

    console.log('\n7. Setting Environment Variables...');
    // JWT_SECRET e NEXTAUTH_SECRET devem ser gerados aleatoriamente a cada instalação
    // para garantir segurança máxima. JWT_SECRET DEVE ser incluído para que sessões
    // não expirem em cada restart do container (BUG CORRIGIDO).
    const jwtSecret = require('crypto').randomBytes(32).toString('hex');
    const nextauthSecret = require('crypto').randomBytes(32).toString('hex');

    // Lê WG_MANAGER_SECRET e VPS_WG_PUBLIC_KEY da VPS via SSH
    const sshReadWg = await sshExec('cat /etc/mikrogestor-wg.secret && echo "---KEY-SEP---" && cat /etc/wireguard/public.key');
    const [wgManagerSecret, vpsWgPublicKey] = sshReadWg.stdout.split('---KEY-SEP---').map(s => s.trim());
    console.log('WG_MANAGER_SECRET:', wgManagerSecret ? '[lido da VPS]' : '[FALHOU]');
    console.log('VPS_WG_PUBLIC_KEY:', vpsWgPublicKey ? vpsWgPublicKey : '[FALHOU]');

    // Detecta o IP público da VPS e o gateway Docker da rede coolify
    const sshNetInfo = await sshExec('curl -s4 --max-time 3 https://api.ipify.org; echo "---IP-SEP---"; ip -4 addr show eth0 2>/dev/null | grep -oP "(?<=inet\\s)\\d+(\\.\\d+){3}" | head -n1');
    const [vpsPublicIp] = sshNetInfo.stdout.split('---IP-SEP---').map(s => s.trim());
    console.log('VPS_PUBLIC_IP:', vpsPublicIp);

    // Gateway da rede 'coolify' no Coolify é sempre 172.16.1.1
    const wgManagerUrl = 'http://172.16.1.1:51821';

    const envVars = [
      { key: 'DATABASE_URL', value: 'file:/app/prisma/dev.db' },
      { key: 'JWT_SECRET', value: jwtSecret },
      { key: 'NEXTAUTH_SECRET', value: nextauthSecret },
      { key: 'NEXTAUTH_URL', value: 'https://mikrogestor.com' },
      { key: 'PORT', value: '80' },
      { key: 'VPS_PUBLIC_IP', value: vpsPublicIp || '2.25.168.82' },
      { key: 'VPS_WG_PUBLIC_KEY', value: vpsWgPublicKey || '' },
      { key: 'WG_MANAGER_SECRET', value: wgManagerSecret || '' },
      { key: 'WG_MANAGER_URL', value: wgManagerUrl },
      { key: 'DEPLOYMENT_MODE', value: 'vps' },
      { key: 'PORTAL_PUBLIC_DOMAIN', value: 'mikrogestor.com' }
    ];

    const envRes = await fetch(`${coolifyBase}/applications/${newAppUuid}/envs/bulk`, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + coolifyToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        data: envVars.map(e => ({
          key: e.key,
          value: e.value,
          is_buildtime: false,
          is_runtime: true,
          is_literal: true
        }))
      })
    });
    console.log('Envs Status:', envRes.status);

    console.log('\n8. Triggering Deployment for UUID:', newAppUuid);
    const deployRes = await fetch(`${coolifyBase}/deploy`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + coolifyToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({ uuid: newAppUuid })
    });
    console.log('Deploy Status:', deployRes.status);
    const deployData = await deployRes.json();
    console.log('Deployment Result:', JSON.stringify(deployData, null, 2));

    // Save app UUID
    fs.writeFileSync(__dirname + '/last-app-uuid.txt', newAppUuid);
    console.log('\n✅ PROCESSO DE CONFIGURAÇÃO CONCLUÍDO COM SUCESSO!');
  } catch (err) {
    console.error('Fatal Error:', err);
  }
})();
