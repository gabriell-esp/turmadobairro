import Link from "next/link";

export const metadata = { title: "Página não encontrada", robots: { index: false } };

export default function NotFound() {
  return (
    <section className="container-page max-w-lg py-20 text-center">
      <p className="h-display text-7xl text-red">404</p>
      <h1 className="h-display mt-2 text-3xl text-navy">Página não encontrada</h1>
      <p className="mt-3 text-muted">O endereço não existe ou foi movido.</p>
      <Link href="/" className="btn btn-red mt-6 inline-flex">Voltar para o início</Link>
    </section>
  );
}
