import Link from "next/link";
import { HOLD_MINUTES } from "./orders";

export const STEPS = [
  { n: 1, title: "Crie seu cadastro", text: "Seus dados ficam protegidos (LGPD). Leva menos de 2 minutos e vale para todos os Kerbs." },
  { n: 2, title: "Escolha o abadá", text: "Selecione o modelo e coloque na sacola quantos abadás precisar — um para cada pessoa." },
  { n: 3, title: "Informe o dono de cada abadá", text: "Nome completo, CPF, data de nascimento, tamanho e se é Baby Look. Cada pessoa só pode ter um abadá." },
  { n: 4, title: "Pague com segurança", text: "Pix ou cartão pelo Mercado Pago. Seu pedido fica reservado enquanto você paga." },
  { n: 5, title: "Receba a confirmação", text: "Assim que o pagamento é aprovado, você recebe a confirmação no WhatsApp e vê o pedido na sua conta." },
  { n: 6, title: "Retire e curta", text: "Retire seu abadá com a organização, vista a camisa e vem pra rua com a Turma. Prost! 🍻" },
];

export const FAQ_ITEMS: { q: string; a: React.ReactNode }[] = [
  {
    q: "Como compro meu abadá?",
    a: (
      <>
        Crie sua conta, escolha o abadá na <Link className="font-bold text-blue underline" href="/loja">loja</Link>, preencha os dados do dono de cada
        abadá e pague pelo Mercado Pago (Pix ou cartão). A confirmação chega por WhatsApp.
      </>
    ),
  },
  {
    q: "Posso comprar mais de um abadá?",
    a: "Sim. Na sacola você adiciona quantos precisar, mas precisa preencher os dados do dono de cada um (nome, CPF, data de nascimento, tamanho e Baby Look). Um mesmo CPF ou nome não pode ter dois abadás no mesmo Kerb.",
  },
  {
    q: "Por que pedem CPF e data de nascimento?",
    a: "Para identificar o dono do abadá, evitar duplicidade/revenda indevida e confirmar a maioridade (há distribuição de chope). Os dados são usados só para isso, ficam criptografados e seguem a nossa Política de Privacidade (LGPD).",
  },
  {
    q: "Menores de 18 anos podem ter abadá?",
    a: "Podem, desde que um responsável legal seja informado na compra. A venda e o consumo de bebida alcoólica são proibidos para menores de 18 anos.",
  },
  {
    q: "Quanto tempo tenho para pagar?",
    a: `Ao finalizar, os abadás ficam reservados por ${HOLD_MINUTES} minutos. Passado esse prazo sem pagamento, o pedido expira e os itens voltam para a venda.`,
  },
  {
    q: "O pagamento é seguro?",
    a: "Sim. O pagamento acontece no ambiente do Mercado Pago. Nós não vemos nem guardamos os dados do seu cartão.",
  },
  {
    q: "Paguei e não recebi a confirmação no WhatsApp. E agora?",
    a: "Veja o status do pedido em Minha conta › Meus pedidos. Se estiver como “Pago” mas a mensagem não chegou, confira se o seu celular está correto no cadastro e fale com a organização.",
  },
  {
    q: "Como e onde retiro o abadá?",
    a: "A organização informa o local, os dias e os horários de retirada por WhatsApp e aqui no site. Leve um documento com foto e o número do pedido.",
  },
];

export const ABOUT_TEXT = {
  lead: "Há 18 anos, o bloco “Turma do Bairro” tem sido a alma pulsante do Kerb de Ipira, enchendo as ruas com a energia contagiante das festas alemãs.",
  paragraphs: [
    "Desde o seu humilde início, tornou-se o mais venerado e tradicional bloco da festa, desempenhando um papel vital no Kerb.",
    "Com uma família de aproximadamente 600 membros, a “Turma do Bairro” não é apenas um bloco, mas uma comunidade vibrante que celebra o Kerb com paixão e devoção. Cada membro é uma peça essencial do quebra-cabeça, contribuindo para a atmosfera única que faz desta festa uma experiência inesquecível.",
    "A verdadeira magia da “Turma do Bairro” reside nas festividades animadas que marcam cada participação. Seja dançando ao som de músicas tradicionais alemãs ou desfilando com enorme alegria e animação, os participantes incorporam a alegria contagiante que define o Kerb de Ipira. As festas, regadas a chope, tornam-se o cenário perfeito para diversões infindáveis.",
    "Ao longo dos anos, a “Turma do Bairro” construiu uma tradição de celebração que transcende o comum. Este bloco não é apenas parte do Kerb, é parte da tradição centenária do Kerb de Ipira.",
  ],
  closing:
    "Junte-se a nós nesta jornada festiva enquanto continuamos a escrever, ano após ano, um capítulo vibrante na história do Kerb de Ipira. A “Turma do Bairro” convida a todos a celebrar conosco e se perder na alegria contagiante de uma festa que é muito mais do que um evento — é uma tradição que transcende o tempo e une comunidades. Prost! 🍻",
};

export const CATEGORY_LABEL: Record<string, string> = {
  festa: "Festa",
  desfile: "Desfile",
  abertura: "Abertura",
  retirada: "Retirada de abadá",
  musica: "Música",
  outro: "Outro",
};
