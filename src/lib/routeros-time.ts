/**
 * Utilitários para conversão e soma de tempos no formato RouterOS v7 (MikroTik).
 * Suporta formatos como: '1h', '01:00:00', '15m', '1d 02:00:00', '45s', etc.
 */

export function parseRouterOSTime(timeStr: string | null | undefined): number {
  if (!timeStr || timeStr === 'none' || timeStr === 'unlimited') return 0;

  const clean = timeStr.trim().toLowerCase();
  let totalSeconds = 0;

  // Extrair dias: ex '2d' ou '2d 04:00:00'
  const dayMatch = clean.match(/(\d+)d/);
  if (dayMatch) {
    totalSeconds += parseInt(dayMatch[1], 10) * 86400;
  }

  // Extrair horas se vier como '1h'
  const hourMatch = clean.match(/(\d+)h/);
  if (hourMatch) {
    totalSeconds += parseInt(hourMatch[1], 10) * 3600;
  }

  // Extrair minutos se vier como '30m'
  const minMatch = clean.match(/(\d+)m(?!s)/);
  if (minMatch) {
    totalSeconds += parseInt(minMatch[1], 10) * 60;
  }

  // Extrair segundos se vier como '45s'
  const secMatch = clean.match(/(\d+)s/);
  if (secMatch) {
    totalSeconds += parseInt(secMatch[1], 10);
  }

  // Se contiver formato de relógio HH:MM:SS ou MM:SS
  const clockMatch = clean.match(/(?:(\d+):)?(\d+):(\d+)/);
  if (clockMatch) {
    const hours = clockMatch[1] ? parseInt(clockMatch[1], 10) : 0;
    const minutes = parseInt(clockMatch[2], 10);
    const seconds = parseInt(clockMatch[3], 10);
    totalSeconds += hours * 3600 + minutes * 60 + seconds;
  }

  return totalSeconds;
}

export function formatRouterOSTime(seconds: number): string {
  if (seconds <= 0) return '00:00:00';

  const days = Math.floor(seconds / 86400);
  const remainder = seconds % 86400;
  const hours = Math.floor(remainder / 3600);
  const minutes = Math.floor((remainder % 3600) / 60);
  const secs = remainder % 60;

  const hh = hours.toString().padStart(2, '0');
  const mm = minutes.toString().padStart(2, '0');
  const ss = secs.toString().padStart(2, '0');

  if (days > 0) {
    return `${days}d ${hh}:${mm}:${ss}`;
  }
  return `${hh}:${mm}:${ss}`;
}

export function addRouterOSTimes(timeA: string | null | undefined, timeB: string | null | undefined): string {
  const secA = parseRouterOSTime(timeA);
  const secB = parseRouterOSTime(timeB);
  return formatRouterOSTime(secA + secB);
}
