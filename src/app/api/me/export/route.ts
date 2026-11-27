import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { orderCode } from "@/lib/format";

export const dynamic = "force-dynamic";

/** Portabilidade/acesso (LGPD art. 18, II e V): cópia dos dados do próprio titular em JSON. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const [orders, consents, requests] = await Promise.all([
    db.order.findMany({ where: { userId: user.id }, include: { items: { include: { product: true } } }, orderBy: { createdAt: "asc" } }),
    db.consentLog.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
    db.dataRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }),
  ]);

  const data = {
    geradoEm: new Date().toISOString(),
    titular: {
      nome: user.name,
      email: user.email,
      telefone: user.phone,
      cpf: user.cpfEnc ? decrypt(user.cpfEnc) : null,
      dataNascimento: user.birthDate?.toISOString().slice(0, 10) ?? null,
      cidade: user.city,
      apelido: user.nickname,
      participaDesde: user.memberSinceYear,
      aceitaNovidades: user.marketingOptIn,
      criadoEm: user.createdAt,
    },
    pedidos: orders.map((o) => ({
      codigo: orderCode(o.number),
      status: o.status,
      total: o.totalCents / 100,
      criadoEm: o.createdAt,
      pagoEm: o.paidAt,
      itens: o.items.map((i) => ({
        produto: i.product.name,
        donoDoAbada: i.ownerName,
        cpfDono: decrypt(i.ownerCpfEnc),
        nascimentoDono: i.ownerBirthDate.toISOString().slice(0, 10),
        tamanho: i.size,
        babyLook: i.babyLook,
        responsavelLegal: i.guardianName,
      })),
    })),
    consentimentos: consents.map((c) => ({ tipo: c.type, versao: c.version, concedido: c.granted, data: c.createdAt })),
    solicitacoes: requests.map((r) => ({ tipo: r.type, status: r.status, data: r.createdAt })),
  };

  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": 'attachment; filename="meus-dados-turma-do-bairro.json"',
      "Cache-Control": "no-store",
    },
  });
}
