import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage } from "@/components/page-shell";
import { POLICY_VERSION } from "@/lib/consent";
import { HOLD_MINUTES } from "@/lib/orders";

export const metadata: Metadata = { title: "Termos de Uso e Venda" };

export default function TermosPage() {
  return (
    <LegalPage title="Termos de Uso e Venda" updated={POLICY_VERSION}>
      <p>Ao criar uma conta ou comprar no site da Turma do Bairro, você concorda com estes termos.</p>

      <h2>1. Cadastro</h2>
      <ul>
        <li>Para comprar, é necessário ter 18 anos ou mais e criar uma conta com dados verdadeiros e atualizados.</li>
        <li>Você é responsável pela guarda da sua senha e por toda atividade realizada na sua conta.</li>
      </ul>

      <h2>2. Compra de abadás</h2>
      <ul>
        <li>Cada abadá é pessoal e vinculado a um dono, identificado por nome completo, CPF e data de nascimento.</li>
        <li>Não é permitido mais de um abadá por CPF ou por nome no mesmo Kerb. A organização pode recusar ou cancelar pedidos com dados repetidos ou inconsistentes.</li>
        <li>Ao comprar para terceiros, você declara ter autorização para informar os dados deles. Para menores de 18 anos, é obrigatório indicar o responsável legal.</li>
        <li>Tamanhos e Baby Look devem ser escolhidos com atenção no momento da compra. Alterações ficam sujeitas à disponibilidade e à análise da organização.</li>
        <li>Os preços, lotes, prazos e estoque são os exibidos na loja no momento da compra e podem ser alterados sem aviso prévio para compras futuras.</li>
      </ul>

      <h2>3. Pagamento e reserva</h2>
      <ul>
        <li>O pagamento é processado pelo <strong>Mercado Pago</strong> (Pix e cartão, conforme disponibilidade).</li>
        <li>Ao finalizar, os itens ficam reservados por <strong>{HOLD_MINUTES} minutos</strong>. Sem pagamento nesse prazo, o pedido expira e os itens voltam ao estoque.</li>
        <li>O pedido só é confirmado após a aprovação do pagamento. Enviaremos a confirmação por WhatsApp para o número informado — mantenha-o correto.</li>
      </ul>

      <h2>4. Cancelamento, troca e reembolso</h2>
      <p>
        Pedidos de cancelamento, troca ou reembolso devem ser feitos pelo canal de atendimento da organização informado em <Link href="/contato">Contato</Link>,
        com o número do pedido. Serão analisados conforme o Código de Defesa do Consumidor e as condições de produção do abadá (itens
        personalizados ou já produzidos). Reembolsos aprovados são feitos pelo mesmo meio de pagamento.
      </p>

      <h2>5. Retirada</h2>
      <p>A retirada do abadá é feita pela organização, nos dias, locais e horários divulgados por WhatsApp e no site, mediante documento com foto e número do pedido.</p>

      <h2>6. Conduta e bebida alcoólica</h2>
      <p>A venda e o consumo de bebida alcoólica são proibidos para menores de 18 anos. Os participantes devem respeitar as regras do bloco e do evento, as autoridades e as demais pessoas. A organização pode impedir a participação de quem descumprir essas regras.</p>

      <h2>7. Privacidade</h2>
      <p>O tratamento de dados pessoais segue a nossa <Link href="/privacidade">Política de Privacidade</Link>.</p>

      <h2>8. Alterações e foro</h2>
      <p>Estes termos podem ser atualizados; a versão vigente fica sempre nesta página. Fica eleito o foro da comarca do domicílio do consumidor, conforme a lei.</p>
      <p className="text-sm text-muted">Texto-base para a operação do site; recomenda-se revisão por assessoria jurídica antes da publicação definitiva.</p>
    </LegalPage>
  );
}
