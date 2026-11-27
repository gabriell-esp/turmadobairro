import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/page-shell";
import { getSettings } from "@/lib/settings";
import { POLICY_VERSION } from "@/lib/consent";

export const metadata: Metadata = { title: "Política de Privacidade" };
export const dynamic = "force-dynamic";

export default async function PrivacidadePage() {
  const s = await getSettings();
  return (
    <LegalPage title="Política de Privacidade" updated={POLICY_VERSION}>
      <p>
        Esta Política explica como a <strong>Turma do Bairro</strong> (“bloco”, “nós”) trata dados pessoais no site e na loja de abadás, em
        conformidade com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018 – LGPD).
      </p>

      <h2>1. Quem é o controlador</h2>
      <p>
        O controlador dos dados é a organização do bloco Turma do Bairro (Ipira/SC). Encarregado/canal de privacidade: <strong>{s.dpo_name}</strong>.
        Contato: {s.contact_email ? <a href={`mailto:${s.contact_email}`}>{s.contact_email}</a> : s.privacy_contact} Você também pode usar o{" "}
        <Link href="/contato#lgpd">formulário de direitos do titular</Link>.
      </p>

      <h2>2. Quais dados coletamos e para quê</h2>
      <table>
        <thead>
          <tr><th>Dado</th><th>Finalidade</th><th>Base legal (art. 7º)</th></tr>
        </thead>
        <tbody>
          <tr><td>Nome, e-mail, senha (criptografada), telefone/WhatsApp</td><td>Criar e manter sua conta; enviar a confirmação do pedido e avisos da compra por WhatsApp</td><td>Execução de contrato / procedimentos preliminares (V)</td></tr>
          <tr><td>CPF e data de nascimento (do comprador e de cada dono de abadá)</td><td>Identificar o dono do abadá, impedir duplicidade e revenda indevida, conferir maioridade e prevenir fraudes</td><td>Execução de contrato (V), legítimo interesse (IX) e prevenção à fraude (art. 11, II, “g”, quando aplicável)</td></tr>
          <tr><td>Cidade e “há quantos anos participa do bloco”</td><td>Conhecer a comunidade e organizar o bloco (campos opcionais)</td><td>Legítimo interesse (IX)</td></tr>
          <tr><td>Tamanho da camisa e Baby Look</td><td>Separar e entregar o abadá correto</td><td>Execução de contrato (V)</td></tr>
          <tr><td>Dados do pedido e do pagamento (status, valor, meio de pagamento)</td><td>Registrar a compra, conciliar pagamentos, atender reclamações e cumprir obrigações fiscais/contábeis</td><td>Execução de contrato (V) e obrigação legal (II)</td></tr>
          <tr><td>IP, navegador, data/hora de acesso e de aceite</td><td>Segurança da conta, prevenção a abusos e prova do consentimento/aceite</td><td>Legítimo interesse (IX) e exercício regular de direitos (VI)</td></tr>
          <tr><td>Receber novidades do bloco (opcional)</td><td>Comunicações sobre o próximo Kerb e promoções</td><td>Consentimento (I) — você pode revogar a qualquer momento</td></tr>
        </tbody>
      </table>
      <p>
        <strong>Não coletamos dados do seu cartão.</strong> O pagamento é feito no ambiente do Mercado Pago, que é o responsável por esses dados.
      </p>

      <h2>3. Dados de terceiros (donos dos abadás)</h2>
      <p>
        Ao comprar abadás para outras pessoas (familiares, amigos), você informa os dados delas. Declare que tem autorização para isso e que as
        informações são verdadeiras. Para <strong>menores de 18 anos</strong>, exigimos a indicação de um responsável legal, que consente com o
        tratamento dos dados do menor no melhor interesse dele (art. 14 da LGPD).
      </p>

      <h2>4. Com quem compartilhamos</h2>
      <ul>
        <li><strong>Mercado Pago</strong> (processamento de pagamentos): recebe nome, e-mail e dados do pedido necessários para cobrar.</li>
        <li><strong>WhatsApp / servidor de mensagens</strong>: usamos uma integração para enviar a confirmação e avisos da sua compra ao número que você informou.</li>
        <li><strong>Provedores de hospedagem e banco de dados</strong>, que armazenam os dados sob nossas instruções.</li>
        <li><strong>Autoridades</strong>, quando houver obrigação legal ou ordem judicial.</li>
      </ul>
      <p>Não vendemos nem cedemos seus dados para publicidade de terceiros.</p>

      <h2>5. Segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais: CPF criptografado em repouso (AES-256-GCM) e exibido de forma mascarada; senhas com hash
        (scrypt); conexão HTTPS; controle de acesso por perfil (organizadores e vendedores veem somente o necessário); registro de auditoria das
        ações no painel; limites contra tentativas de abuso. Nenhum sistema é 100% imune; havendo incidente que traga risco relevante,
        comunicaremos os titulares e a ANPD conforme a lei.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <ul>
        <li><strong>Conta e perfil:</strong> enquanto você mantiver a conta. Ao excluí-la, seus dados de perfil são anonimizados.</li>
        <li><strong>Pedidos e pagamentos:</strong> até 5 anos após a compra, para fins fiscais, contábeis e de defesa em processos (art. 16, I e art. 7º, VI).</li>
        <li><strong>Registros de acesso e de consentimento:</strong> mínimo de 6 meses (Marco Civil da Internet) e pelo tempo necessário para comprovar o aceite.</li>
        <li><strong>Mensagens de WhatsApp enviadas pelo sistema:</strong> enquanto necessárias para suporte e comprovação de entrega.</li>
      </ul>

      <h2>7. Seus direitos (art. 18)</h2>
      <p>Você pode, a qualquer momento: confirmar que tratamos seus dados; acessá-los; corrigi-los; pedir anonimização, bloqueio ou eliminação de dados desnecessários; solicitar portabilidade; saber com quem compartilhamos; revogar consentimentos; e se opor a tratamentos. Em <Link href="/minha-conta/privacidade">Minha conta › Privacidade e dados</Link> você pode baixar uma cópia dos seus dados, corrigi-los, gerenciar consentimentos e excluir a conta. Outras solicitações: <Link href="/contato#lgpd">formulário de direitos do titular</Link>. Respondemos em até 15 dias. Você também pode reclamar à ANPD (gov.br/anpd).</p>

      <h2>8. Cookies</h2>
      <p>Usamos somente cookies essenciais. Veja a <Link href="/cookies">Política de Cookies</Link>.</p>

      <h2>9. Alterações</h2>
      <p>Podemos atualizar esta Política. A versão vigente e sua data aparecem no topo desta página; mudanças relevantes serão avisadas.</p>
      <p className="text-sm text-muted">Texto-base elaborado para a operação do site; recomenda-se revisão por assessoria jurídica antes da publicação definitiva.</p>
    </LegalPage>
  );
}
