import { redirect } from 'next/navigation';

/**
 * Rota /login — Ponte para o Captive Portal do MikroTik Hotspot
 *
 * O MikroTik redireciona os clientes não autenticados para:
 *   https://<subdomain>/login?dst=<url-original>
 *
 * Esta página captura o parâmetro `dst` e redireciona para o portal
 * de cadastro/planos do MikroGestor, mantendo a URL de destino original.
 */
interface LoginPageProps {
  searchParams: Promise<{ dst?: string; username?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const dst = params.dst || '';

  // Redireciona para o portal de planos passando o dst original
  const portalUrl = dst
    ? `/portal/planos?dst=${encodeURIComponent(dst)}`
    : '/portal/planos';

  redirect(portalUrl);
}
