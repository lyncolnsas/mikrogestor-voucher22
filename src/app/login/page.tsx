import { redirect } from 'next/navigation';

/**
 * Rota /login — Redirecionamento para o Captive Portal do MikroTik
 *
 * Garante que qualquer acesso à rota /login no servidor Next.js
 * redirecione imediatamente para o MikroTik Hotspot local (192.168.88.1/login).
 */
interface LoginPageProps {
  searchParams: Promise<{ dst?: string; username?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const dst = params.dst || '';

  // Redireciona diretamente para o gateway Hotspot do MikroTik
  const targetUrl = dst
    ? `http://192.168.88.1/login?dst=${encodeURIComponent(dst)}`
    : 'http://192.168.88.1/login';

  redirect(targetUrl);
}
