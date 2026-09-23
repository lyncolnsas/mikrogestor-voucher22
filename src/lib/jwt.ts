import { SignJWT, jwtVerify, CompactEncrypt, compactDecrypt } from 'jose';

const getJwtSecretKey = () => {
  const secret = process.env.JWT_SECRET;
  // [SECURITY FIX MED-01] Falha rápida se JWT_SECRET não estiver configurado corretamente
  if (!secret || secret.length < 32) {
    const msg = '[FATAL] JWT_SECRET não definido ou muito curto (mínimo 32 caracteres). Configure a variável de ambiente antes de iniciar o servidor.';
    console.error(msg);
    throw new Error(msg);
  }
  return secret;
};


// Derivação criptograficamente uniforme de 32 bytes para JWE A256GCM usando Web Crypto (Edge + Node)
const getJweSecretKey = async (): Promise<Uint8Array> => {
  const secretStr = getJwtSecretKey();
  const data = new TextEncoder().encode(secretStr);
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
  return new Uint8Array(hashBuffer);
};

// Chave legada para descriptografia de sessões existentes (migração suave)
const getLegacyJweSecretKey = (): Uint8Array => {
  const secretStr = getJwtSecretKey();
  return new TextEncoder().encode(secretStr.padEnd(32, '0').slice(0, 32));
};


// --- Autenticação Local Administrativa (Assinatura) ---

export const signJwt = async (payload: { username: string; name: string; role?: string }) => {
  const secret = new TextEncoder().encode(getJwtSecretKey());
  const alg = 'HS256';

  return new SignJWT({ ...payload, type: 'admin' })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(secret);
};

export const verifyJwt = async (token: string) => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(getJwtSecretKey());
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as { username: string; name: string; role?: string; exp: number };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (process.env.NODE_ENV !== 'production' || process.env.DEBUG_AUTH === 'true') {
      console.warn(`[JWT VERIFY WARNING] Token inválido ou expirado: ${message}`);
    }
    return null;
  }
};

// --- Sessão do Cliente no Portal Hotspot (Assinatura Criptografada) ---

export interface CustomerSessionPayload {
  leadId: string;
  phone?: string | null;
  hotspotUser?: string | null;
}

export const signCustomerJwt = async (payload: CustomerSessionPayload): Promise<string> => {
  const secret = new TextEncoder().encode(getJwtSecretKey());
  const alg = 'HS256';

  return new SignJWT({ ...payload, type: 'customer' })
    .setProtectedHeader({ alg })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
};

export const verifyCustomerJwt = async (
  token: string
): Promise<CustomerSessionPayload | null> => {
  if (!token || typeof token !== 'string') {
    return null;
  }

  try {
    const secret = new TextEncoder().encode(getJwtSecretKey());
    const { payload } = await jwtVerify(token, secret);
    
    if (payload.type !== 'customer' || !payload.leadId) {
      return null;
    }

    return {
      leadId: String(payload.leadId),
      phone: payload.phone ? String(payload.phone) : null,
      hotspotUser: payload.hotspotUser ? String(payload.hotspotUser) : null,
    };
  } catch {
    return null;
  }
};

// --- Sessão do MikroTik (Criptografia Forte JWE A256GCM) ---

export const encryptData = async (payload: object) => {
  const secretKey = await getJweSecretKey();
  const text = JSON.stringify(payload);
  
  const jwe = await new CompactEncrypt(new TextEncoder().encode(text))
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .encrypt(secretKey);

  return jwe;
};

export const decryptData = async (jwe: string) => {
  if (!jwe || typeof jwe !== 'string') {
    return null;
  }

  // Tenta com a chave segura derivada por SHA-256
  try {
    const secretKey = await getJweSecretKey();
    const { plaintext } = await compactDecrypt(jwe, secretKey);

    const text = new TextDecoder().decode(plaintext);
    return JSON.parse(text);
  } catch {
    // Fallback para chave legada (padEnd) para não derrubar sessões ativas
    try {
      const legacyKey = getLegacyJweSecretKey();
      const { plaintext } = await compactDecrypt(jwe, legacyKey);
      const text = new TextDecoder().decode(plaintext);
      return JSON.parse(text);
    } catch (fallbackError) {
      const message = fallbackError instanceof Error ? fallbackError.message : String(fallbackError);
      console.warn(`[JWE DECRYPT WARNING] Falha ao descriptografar sessão MikroTik: ${message}`);
      return null;
    }
  }
};

