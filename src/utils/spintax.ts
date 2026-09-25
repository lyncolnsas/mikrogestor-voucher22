/**
 * Utilitário de Spintax Anti-Ban para Mensagens do WhatsApp
 * Converte blocos de variação {opção1|opção2|opção3} em uma opção sorteada aleatoriamente.
 * Preserva tags de template do sistema que não contêm o separador pipe (ex: {cliente}, {usuario}).
 */

export function spinText(text: string): string {
  if (!text || typeof text !== 'string') return text || '';

  // Exige que o conteúdo entre chaves contenha pelo menos um caractere '|'
  // Evita colidir com tags do sistema como {cliente}, {usuario}, {senha}
  const spintaxRegex = /\{([^{}]*\|[^{}]*)\}/g;
  let spinned = text;
  let iterations = 0;
  const maxIterations = 20; // Proteção contra loops infinitos em spintax malformado

  while (spintaxRegex.test(spinned) && iterations < maxIterations) {
    iterations++;
    spinned = spinned.replace(spintaxRegex, (_match, p1) => {
      const options = p1.split('|');
      const chosen = options[Math.floor(Math.random() * options.length)];
      return chosen !== undefined ? chosen : '';
    });
  }

  return spinned;
}

export function hasSpintax(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /\{[^{}]*\|[^{}]*\}/.test(text);
}
