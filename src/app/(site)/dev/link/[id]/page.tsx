import { notFound } from "next/navigation";
import { isMpSimulated } from "@/lib/mercadopago";

export default async function DevLink() {
  if (!(await isMpSimulated())) notFound();
  return (
    <section className="container-page max-w-lg py-16">
      <div className="card p-8">
        <p className="badge badge-yellow">Ambiente de desenvolvimento</p>
        <h1 className="h-display mt-2 text-3xl text-navy">Link de pagamento simulado</h1>
        <p className="mt-2 text-sm text-muted">Em produção este link abre o checkout do Mercado Pago.</p>
      </div>
    </section>
  );
}
