import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { can, getCurrentUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";
import { getCurrentEvent } from "@/lib/event";
import { toCsv } from "@/lib/csv";
import { audit } from "@/lib/audit";
import { fmtBirth, fmtDateTime, orderCode } from "@/lib/format";
import { formatCpf, formatPhone } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || !can(user, "dashboard.full")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const tipo = new URL(req.url).searchParams.get("tipo");
  const actor = { id: user.id, name: user.name };
  const event = await getCurrentEvent();
  let header: string[]; let rows: unknown[][]; let name: string;

  if (tipo === "membros") {
    if (!can(user, "members.view")) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const users = await db.user.findMany({ where: { role: "MEMBER", deletedAt: null }, orderBy: { name: "asc" } });
    header = ["Nome", "E-mail", "WhatsApp", "Cidade", "Apelido", "Participa desde", "Aceita novidades", "Cadastro"];
    rows = users.map((u) => [u.name, u.email, formatPhone(u.phone), u.city, u.nickname, u.memberSinceYear, u.marketingOptIn ? "sim" : "não", fmtDateTime(u.createdAt)]);
    name = "membros";
  } else if (tipo === "producao" || tipo === "completo") {
    const items = await db.orderItem.findMany({
      where: { eventId: event?.id, active: true, order: { status: "PAID" } },
      include: { order: true, product: true },
      orderBy: [{ ownerName: "asc" }],
    });
    const withCpf = tipo === "completo";
    header = ["Pedido", "Dono do abadá", ...(withCpf ? ["CPF", "Nascimento"] : []), "Modelo", "Tamanho", "Baby Look", "Comprador", "WhatsApp comprador", "Entregue em"];
    rows = items.map((i) => [
      orderCode(i.order.number), i.ownerName, ...(withCpf ? [formatCpf(decrypt(i.ownerCpfEnc)), fmtBirth(i.ownerBirthDate)] : []),
      i.product.name, i.size, i.babyLook ? "sim" : "não", i.order.buyerName, formatPhone(i.order.buyerPhone), i.deliveredAt ? fmtDateTime(i.deliveredAt) : "",
    ]);
    name = withCpf ? "abadas-completo" : "abadas-producao";
  } else {
    return NextResponse.json({ error: "tipo inválido" }, { status: 400 });
  }

  await audit(actor, "export.csv", "Report", undefined, { tipo, rows: rows.length });
  return new NextResponse(toCsv(header, rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
