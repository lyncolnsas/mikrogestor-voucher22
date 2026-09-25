import React from 'react';
import Link from 'next/link';

export default function TermosPagoPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-4xl mx-auto bg-slate-800 shadow-2xl rounded-2xl overflow-hidden border border-slate-700">

        {/* Cabeçalho */}
        <div className="px-6 py-8 border-b border-slate-700 bg-gradient-to-r from-indigo-900/40 to-slate-800">
          <div className="flex items-center justify-center mb-3">
            <span className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-indigo-500/20 text-indigo-400 text-2xl">🔒</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white text-center">Contrato de Prestação de Serviço</h1>
          <p className="mt-2 text-center text-slate-400 text-sm">Planos de Acesso Premium à Internet Wi-Fi · Versão 2.0</p>
          <p className="mt-1 text-center text-slate-500 text-xs">Vigência: a partir de setembro/2024 · Regulado pelo CDC, LGPD e Marco Civil da Internet</p>
        </div>

        <div className="px-6 py-8 space-y-8 text-slate-300 text-base leading-relaxed">

          {/* Banner de Segurança do Pagamento */}
          <div className="bg-green-900/30 border border-green-500/40 rounded-xl p-5">
            <div className="flex items-start gap-3">
              <span className="text-2xl mt-0.5">🔐</span>
              <div>
                <h3 className="text-lg font-bold text-green-300 mb-1">Seu pagamento é 100% seguro</h3>
                <p className="text-sm text-green-200 leading-relaxed">
                  O pagamento via <strong>PIX é processado exclusivamente pelo aplicativo do seu próprio banco</strong>, 
                  em um ambiente criptografado e certificado pelo Banco Central do Brasil. 
                  Nenhum dado financeiro ou bancário trafega pela rede Wi-Fi do estabelecimento. 
                  Você simplesmente lê o QR Code com o app do seu banco e confirma a transação com segurança total.
                </p>
              </div>
            </div>
          </div>

          {/* 1 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mr-3 text-sm font-bold">1</span>
              O Serviço Contratado
            </h2>
            <p>
              Ao adquirir um plano de acesso premium, o usuário contrata o direito de uso de largura de banda da 
              rede Wi-Fi do estabelecimento pelo período e limites definidos no plano escolhido. O acesso é 
              ativado automaticamente após a confirmação do pagamento via PIX pelo sistema bancário.
            </p>
            <p className="mt-2 text-sm text-slate-400 italic">
              Base legal: <strong className="text-slate-300">CDC — Lei 8.078/1990</strong>, art. 30 (oferta vinculante) e art. 31 (informações claras e precisas sobre o serviço).
            </p>
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mr-3 text-sm font-bold">2</span>
              Qualidade do Serviço e Compromissos
            </h2>
            <p>
              O provedor compromete-se a disponibilizar a rede com velocidade mínima adequada ao plano 
              adquirido, em regime de melhor esforço, observadas as condições de infraestrutura local. 
              O serviço é interrompido caso detectadas violações dos presentes termos (ex.: compartilhamento 
              não autorizado), sem prejuízo das medidas legais cabíveis.
            </p>
            <p className="mt-2 text-sm text-slate-400 italic">
              Base legal: <strong className="text-slate-300">CDC — Lei 8.078/1990</strong>, art. 18-20 (qualidade e adequação dos serviços); 
              <strong className="text-slate-300"> ANATEL — Resolução 632/2014</strong> (regulamento geral de qualidade dos serviços de telecomunicações).
            </p>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center mr-3 text-sm font-bold">3</span>
              Como se Reconectar (Informação Técnica Importante)
            </h2>
            <div className="space-y-4">
              <p>
                O sistema de autenticação Hotspot utiliza Cookie de Sessão para reconhecer seu dispositivo 
                automaticamente. Na maioria dos casos, ao voltar à área de cobertura, seu aparelho se 
                reconecta sem qualquer ação. Em algumas situações (Wi-Fi desligado por economia de bateria 
                ou troca de rede), pode ser necessário reabrir o portal manualmente:
              </p>
              <div className="bg-slate-900 p-5 rounded-lg border border-slate-600">
                <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
                  <span>📱</span> Passo a passo para reconectar:
                </h4>
                <ol className="list-decimal list-inside space-y-2 ml-2 text-sm">
                  <li>Confirme que o ícone Wi-Fi está conectado na rede do estabelecimento.</li>
                  <li>Abra o navegador (Chrome, Safari, Firefox).</li>
                  <li>Acesse <strong className="text-white">http://neverssl.com</strong> — isso forçará a abertura da tela de login do Hotspot.</li>
                  <li>Caso seja solicitado, clique em <strong className="text-white">&quot;Conectar&quot;</strong> ou insira seu telefone cadastrado.</li>
                </ol>
              </div>
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mr-3 text-sm font-bold">4</span>
              Política de Reembolso e Disponibilidade de Vagas
            </h2>
            <p>
              A rede possui capacidade máxima de dispositivos simultâneos definida pela infraestrutura 
              do estabelecimento. O usuário adquire o direito ao <strong>tempo de acesso</strong> pelo período 
              do plano contratado — não a uma vaga permanentemente reservada. Em caso de desconexão por 
              inatividade prolongada, a vaga pode ser realocada para outro usuário.
            </p>
            <div className="mt-3 p-4 bg-slate-900 border border-slate-600 rounded-lg text-sm">
              <strong className="text-white block mb-2">Sobre reembolsos:</strong>
              <p>
                Não são realizados reembolsos após a ativação do acesso, exceto nas hipóteses previstas no 
                art. 49 do CDC (compras realizadas fora do estabelecimento físico — canal digital puro), 
                quando aplicável, dentro do prazo de 7 (sete) dias corridos a contar da data de contratação, 
                desde que o serviço não tenha sido utilizado.
              </p>
            </div>
            <p className="mt-2 text-sm text-slate-400 italic">
              Base legal: <strong className="text-slate-300">CDC — Lei 8.078/1990</strong>, art. 49 (direito de arrependimento nas compras realizadas fora do estabelecimento físico).
            </p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mr-3 text-sm font-bold">5</span>
              Proteção de Dados e Privacidade
            </h2>
            <p>
              Os dados pessoais fornecidos no cadastro são tratados em conformidade com a LGPD. 
              Utilizamos seus dados exclusivamente para: autenticação no serviço, envio de notificações 
              de acesso via WhatsApp (quando autorizado) e cumprimento de obrigações legais de 
              registro de conexão. Seus dados não são vendidos, cedidos ou compartilhados com terceiros 
              para fins comerciais.
            </p>
            <p className="mt-2 text-sm text-slate-400 italic">
              Base legal: <strong className="text-slate-300">LGPD — Lei 13.709/2018</strong>, art. 7°, inciso V (execução de contrato) e art. 9° (transparência no tratamento); 
              <strong className="text-slate-300"> Marco Civil da Internet — Lei 12.965/2014</strong>, art. 10 e 13 (sigilo e guarda de registros).
            </p>
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center mr-3 text-sm font-bold">6</span>
              Proibição de Compartilhamento (Anti-Tethering)
            </h2>
            <p>
              O acesso é <strong>estritamente pessoal e intransferível</strong>. O plano contratado é vinculado 
              ao CPF e dispositivo do titular. Tentativas de compartilhar a conexão via Ponto de Acesso 
              Pessoal, Bluetooth ou USB são detectadas e bloqueadas ativamente pelo sistema, podendo resultar 
              no encerramento imediato da sessão sem reembolso, configurando violação contratual nos 
              termos do art. 395 do Código Civil Brasileiro.
            </p>
            <p className="mt-2 text-sm text-slate-400 italic">
              Base legal: <strong className="text-slate-300">Código Civil — Lei 10.406/2002</strong>, art. 395 (inadimplemento das obrigações contratuais).
            </p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mr-3 text-sm font-bold">7</span>
              Limitação de Responsabilidade do Provedor
            </h2>
            <p>O provedor não se responsabiliza por:</p>
            <ul className="list-disc list-inside mt-2 space-y-1 ml-4 text-sm">
              <li>Lentidão decorrente de picos extremos de uso simultâneo por outros usuários.</li>
              <li>Incompatibilidades causadas por configurações específicas do dispositivo do usuário (ex.: endereço MAC aleatório, proxies internos, firewalls pessoais).</li>
              <li>Interrupções causadas por queda de energia no estabelecimento ou falhas na operadora de telecomunicações que provê o link de fibra óptica — eventos caracterizados como força maior (CC, art. 393).</li>
            </ul>
            <p className="mt-2 text-sm text-slate-400 italic">
              Base legal: <strong className="text-slate-300">Código Civil — Lei 10.406/2002</strong>, art. 393 (caso fortuito e força maior).
            </p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mr-3 text-sm font-bold">8</span>
              Aceitação e Concordância
            </h2>
            <p>
              A conclusão do cadastro e a realização do pagamento constituem <strong>aceitação expressa e 
              irrevogável</strong> de todos os termos e condições descritos neste contrato, conforme 
              previsto no art. 434 do Código Civil Brasileiro para contratos eletrônicos.
            </p>
            <p className="mt-2 text-sm text-slate-400 italic">
              Base legal: <strong className="text-slate-300">Código Civil — Lei 10.406/2002</strong>, art. 434 (formação do contrato entre ausentes);
              <strong className="text-slate-300"> Marco Civil da Internet — Lei 12.965/2014</strong>, art. 7°, XIII (consentimento expresso e informado).
            </p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-bold text-white mb-3 flex items-center">
              <span className="w-8 h-8 rounded-full bg-slate-500/30 text-slate-300 flex items-center justify-center mr-3 text-sm font-bold">9</span>
              Foro e Legislação Aplicável
            </h2>
            <p>
              Estes termos são regidos pela legislação da República Federativa do Brasil. 
              Quaisquer litígios serão submetidos ao Juizado Especial Cível competente (Lei 9.099/95) 
              ou ao foro da comarca de sede do estabelecimento, com renúncia a qualquer outro, 
              salvo disposição legal em contrário.
            </p>
          </section>

        </div>

        <div className="bg-slate-900/50 px-6 py-6 border-t border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-slate-500">Regulado por: CDC · LGPD · Marco Civil da Internet · Código Civil Brasileiro</p>
          <Link 
            href="/portal/register" 
            className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg transition-colors duration-200 text-sm"
          >
            ✅ Li e concordo — Voltar ao Cadastro
          </Link>
        </div>
      </div>
    </div>
  );
}
