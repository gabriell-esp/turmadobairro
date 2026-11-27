import type { Metadata } from "next";
import { LegalPage } from "@/components/page-shell";
import { POLICY_VERSION } from "@/lib/consent";

export const metadata: Metadata = { title: "Política de Cookies" };

export default function CookiesPage() {
  return (
    <LegalPage title="Política de Cookies" updated={POLICY_VERSION}>
      <p>Cookies são pequenos arquivos que o navegador guarda para o site funcionar. O site da Turma do Bairro usa <strong>apenas cookies estritamente necessários</strong>.</p>
      <table>
        <thead><tr><th>Nome</th><th>Finalidade</th><th>Duração</th></tr></thead>
        <tbody>
          <tr><td>tb_session</td><td>Mantém você conectado e protege sua sessão (cookie HttpOnly)</td><td>Até 14 dias ou até você sair</td></tr>
          <tr><td>Armazenamento local “tb_cookie_ack”</td><td>Lembra que você já viu o aviso de cookies</td><td>Até você limpar os dados do navegador</td></tr>
        </tbody>
      </table>
      <p>
        <strong>Não usamos</strong> cookies de publicidade, de análise de comportamento nem pixels de rastreamento. Ao pagar, você é redirecionado ao Mercado Pago, que
        possui sua própria política de cookies.
      </p>
      <p>Você pode apagar ou bloquear cookies nas configurações do navegador, mas sem o cookie de sessão não é possível entrar na conta nem comprar.</p>
    </LegalPage>
  );
}
