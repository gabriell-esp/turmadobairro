import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { OrderError, createExternalPaidOrder, createOrder, expireStaleOrders, markOrderPaid, releaseOrder, type ItemInput } from "@/lib/orders";
import { rateLimit } from "@/lib/rate-limit";

const CPFS = ["52998224725", "11144477735", "39053344705", "15350946056", "86288366757", "71428793860", "03904893640", "45317828791", "62648716506", "10683693506", "27613957330", "91375526704"];
let eventId = "", productId = "";

const item = (i: number, extra: Partial<ItemInput> = {}): ItemInput => ({
  productId, ownerName: `Pessoa Numero${"abcdefghijklmnop"[i]}`, ownerCpf: CPFS[i], ownerBirthDate: new Date("1990-01-01T00:00:00Z"), size: "M", babyLook: false, ...extra,
});
const buyer = { name: "Comprador Teste", phone: "5549999991234" };
const make = (items: ItemInput[], extra: object = {}) => createOrder({ eventId, buyer, source: "ONLINE", items, ...extra });

beforeAll(async () => {
  await db.$queryRaw`SELECT 1`;
});

beforeEach(async () => {
  await db.orderItem.deleteMany(); await db.paymentEvent.deleteMany(); await db.order.deleteMany();
  await db.product.deleteMany(); await db.event.deleteMany(); await db.rateLimit.deleteMany(); await db.setting.deleteMany();
  const ev = await db.event.create({ data: { slug: "t", name: "Teste", year: 2027, startsAt: new Date(Date.now() + 1e9), endsAt: new Date(Date.now() + 2e9) } });
  eventId = ev.id;
  productId = (await db.product.create({ data: { eventId, slug: "p", name: "Abadá", priceCents: 10000, stock: 3, sizes: ["P", "M", "G"], allowBabyLook: true } })).id;
});

describe("criação de pedido", () => {
  it("cria pedido, soma o total e guarda o CPF criptografado", async () => {
    const o = await make([item(0), item(1)]);
    expect(o.totalCents).toBe(20000);
    const rows = await db.orderItem.findMany({ where: { orderId: o.id } });
    expect(rows).toHaveLength(2);
    expect(rows[0].ownerCpfEnc).not.toContain(CPFS[0]);
    expect(rows[0].ownerCpfHash).toMatch(/^[0-9a-f]{64}$/);
  });


  it("venda do painel não exige dados do comprador e guarda a forma de pagamento", async () => {
    const o = await createOrder({ eventId, buyer: { name: "Pessoa Numeroa", phone: null, email: null }, source: "SELLER", items: [item(0)], payMethods: "PIX" });
    expect(o.buyerPhone).toBeNull();
    expect(o.buyerEmail).toBeNull();
    expect(o.payMethods).toBe("PIX");
    const padrao = await make([item(1)]);
    expect(padrao.payMethods).toBe("ALL");
  });

  it("bloqueia CPF repetido em outro pedido (ativo)", async () => {
    await make([item(0)]);
    await expect(make([item(0, { ownerName: "Outro Nome Completo" })])).rejects.toMatchObject({ details: [{ field: "cpf" }] });
  });

  it("bloqueia nome repetido (mesmo com acento/caixa diferente) e permite homônimo liberado", async () => {
    await make([item(0, { ownerName: "João da Silva" })]);
    await expect(make([item(1, { ownerName: "JOAO DA SILVA" })])).rejects.toMatchObject({ details: [{ field: "name" }] });
    const ok = await make([item(1, { ownerName: "JOAO DA SILVA", allowDuplicateName: true })]);
    expect(ok.id).toBeTruthy();
    await expect(make([item(1, { ownerName: "Fulano Qualquer", allowDuplicateName: true })])).rejects.toBeInstanceOf(OrderError); // CPF continua único
  });

  it("bloqueia repetição dentro do mesmo pedido", async () => {
    await expect(make([item(0), item(0, { ownerName: "Maria Souza Lima" })])).rejects.toBeInstanceOf(OrderError);
  });

  it("exige responsável para menores e valida tamanho / baby look", async () => {
    const minor = new Date(Date.now() - 10 * 365 * 86400_000);
    await expect(make([item(0, { ownerBirthDate: minor })])).rejects.toMatchObject({ details: [{ field: "guardian" }] });
    expect((await make([item(0, { ownerBirthDate: minor, guardianName: "Responsável Legal" })])).id).toBeTruthy();
    await expect(make([item(1, { size: "XG" })])).rejects.toMatchObject({ details: [{ field: "size" }] });
    await expect(make([item(2, { size: "G", babyLook: true })])).resolves.toBeTruthy();
  });
});

describe("concorrência", () => {
  it("10 compras simultâneas do mesmo CPF: só uma passa", async () => {
    const results = await Promise.allSettled(Array.from({ length: 10 }, (_, k) => make([item(0, { ownerName: `Pessoa Concorrente${"abcdefghij"[k]}` })])));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.orderItem.count({ where: { active: true } })).toBe(1);
  });

  it("estoque 3 com 8 compradores diferentes: vendem exatamente 3", async () => {
    const results = await Promise.allSettled(Array.from({ length: 8 }, (_, k) => make([item(k)])));
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
    expect(await db.orderItem.count({ where: { active: true } })).toBe(3);
  });
});

describe("ciclo de vida", () => {
  it("cancelar libera CPF e estoque", async () => {
    const o = await make([item(0)]);
    await releaseOrder(o.id, "CANCELLED");
    await expect(make([item(0)])).resolves.toBeTruthy();
  });

  it("pedido vencido expira e libera os dados", async () => {
    const o = await make([item(0)]);
    await db.order.update({ where: { id: o.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await expireStaleOrders()).toBe(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("EXPIRED");
    await expect(make([item(0)])).resolves.toBeTruthy();
  });

  it("pagamento é idempotente (confirmação dispara uma vez)", async () => {
    const o = await make([item(0)]);
    const results = await Promise.all([1, 2, 3, 4].map(() => markOrderPaid(o.id, { paymentId: "1", status: "approved", amountCents: 10000 })));
    expect(results.filter((r) => r.changed)).toHaveLength(1);
    expect((await db.order.findUniqueOrThrow({ where: { id: o.id } })).status).toBe("PAID");
  });

  it("valor pago menor que o total não confirma e sinaliza atenção", async () => {
    const o = await make([item(0)]);
    const r = await markOrderPaid(o.id, { paymentId: "2", status: "approved", amountCents: 100 });
    expect(r).toMatchObject({ changed: false, reason: "mismatch" });
    const fresh = await db.order.findUniqueOrThrow({ where: { id: o.id } });
    expect(fresh.status).toBe("PENDING"); expect(fresh.needsAttention).toBe(true);
  });

  it("pagamento tardio reativa os itens; se já vendidos a outro, sinaliza conflito", async () => {
    const a = await make([item(0)]);
    await db.order.update({ where: { id: a.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expireStaleOrders();
    const late = await markOrderPaid(a.id, { paymentId: "3", status: "approved", amountCents: 10000 });
    expect(late.changed).toBe(true); // ninguém tinha pegado o CPF

    const b = await make([item(1)]);
    await db.order.update({ where: { id: b.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expireStaleOrders();
    await make([item(1, { ownerName: "Outra Pessoa Nova" })]); // outro comprador ficou com o CPF
    const conflict = await markOrderPaid(b.id, { paymentId: "4", status: "approved", amountCents: 10000 });
    expect(conflict).toMatchObject({ changed: false, reason: "conflict" });
    expect((await db.order.findUniqueOrThrow({ where: { id: b.id } })).needsAttention).toBe(true);
  });
});

describe("rate limit", () => {
  it("bloqueia após o limite", async () => {
    const r = [];
    for (let i = 0; i < 5; i++) r.push((await rateLimit("t:key", 3, 60)).ok);
    expect(r).toEqual([true, true, true, false, false]);
  });
});

describe("congelar vendas", () => {
  const freeze = (open: boolean) => db.setting.upsert({ where: { key: "sales_open" }, update: { value: String(open) }, create: { key: "sales_open", value: String(open) } });

  it("com as vendas congeladas, bloqueia loja online e vendedor", async () => {
    await freeze(false);
    await expect(make([item(0)])).rejects.toThrow(/congeladas/);
    await expect(createOrder({ eventId, buyer, source: "SELLER", items: [item(1)] })).rejects.toThrow(/congeladas/);
    expect(await db.order.count()).toBe(0);
  });

  it("gestor (bypassFreeze) consegue vender mesmo congelado", async () => {
    await freeze(false);
    const o = await createOrder({ eventId, buyer, source: "SELLER", items: [item(0)], bypassFreeze: true });
    expect(o.status).toBe("PENDING");
  });

  it("ao liberar, a loja volta a vender", async () => {
    await freeze(false);
    await freeze(true);
    await expect(make([item(0)])).resolves.toBeTruthy();
  });
});

describe("preço editado na venda manual", () => {
  const seller = (items: ItemInput[], extra: object = {}) => createOrder({ eventId, buyer, source: "SELLER", items, allowPriceOverride: true, ...extra });

  it("usa o preço combinado no total e no item, e registra o motivo no pedido", async () => {
    const o = await seller([item(0, { priceCents: 8000 }), item(1)], { priceReason: "desconto da organização" });
    expect(o.totalCents).toBe(8000 + 10000);
    const rows = await db.orderItem.findMany({ where: { orderId: o.id }, orderBy: { createdAt: "asc" } });
    expect(rows.map((r) => r.priceCents).sort((a, b) => a - b)).toEqual([8000, 10000]);
    expect(o.notes).toMatch(/Preço alterado/);
    expect(o.notes).toMatch(/desconto da organização/);
  });

  it("exige o motivo quando o preço difere da tabela", async () => {
    await expect(seller([item(0, { priceCents: 5000 })])).rejects.toThrow(/motivo/i);
    expect(await db.order.count()).toBe(0);
  });

  it("preço igual ao da tabela não exige motivo nem gera nota", async () => {
    const o = await seller([item(0, { priceCents: 10000 })]);
    expect(o.totalCents).toBe(10000);
    expect(o.notes ?? "").not.toMatch(/Preço alterado/);
  });

  it("a loja online nunca aceita preço de fora", async () => {
    await expect(make([item(0, { priceCents: 100 })])).rejects.toMatchObject({ details: [{ field: "price" }] });
  });

  it("limita o preço entre R$ 1,00 e R$ 100.000,00", async () => {
    await expect(seller([item(0, { priceCents: 50 })], { priceReason: "teste" })).rejects.toMatchObject({ details: [{ field: "price" }] });
    await expect(seller([item(0, { priceCents: 20_000_000 })], { priceReason: "teste" })).rejects.toMatchObject({ details: [{ field: "price" }] });
  });
});

describe("venda lançada por fora", () => {
  const ext = (items: ItemInput[], extra: object = {}) =>
    createExternalPaidOrder({ eventId, buyer: { name: "Pessoa Numeroa", phone: null, email: null }, source: "SELLER", items, externalMethod: "CASH", recordedBy: "Vendedor Teste", ...extra });

  it("cria o pedido já PAGO, sem link e sem telefone, com o meio e quem lançou", async () => {
    const o = await ext([item(0), item(1)]);
    expect(o.status).toBe("PAID");
    expect(o.paidAt).toBeTruthy();
    expect(o.mpInitPoint).toBeNull();
    expect(o.buyerPhone).toBeNull();
    expect(o.paymentMethod).toBe("Dinheiro (por fora)");
    expect(o.mpPaymentId).toMatch(/^EXT-/);
    expect(o.notes).toMatch(/lançada por fora/i);
    expect(o.notes).toMatch(/Vendedor Teste/);
    const rows = await db.orderItem.findMany({ where: { orderId: o.id } });
    expect(rows.every((r) => r.active)).toBe(true);
  });

  it("continua bloqueando CPF repetido (também contra vendas por fora)", async () => {
    await ext([item(0)]);
    await expect(ext([item(0, { ownerName: "Outro Nome Completo" })])).rejects.toMatchObject({ details: [{ field: "cpf" }] });
    expect(await db.order.count()).toBe(1);
  });

  it("respeita o estoque", async () => {
    await expect(ext([item(0), item(1), item(2), item(3)])).rejects.toThrow(/Restam apenas 3/);
    expect(await db.order.count()).toBe(0);
  });

  it("com as vendas congeladas, só passa com bypassFreeze (gestor)", async () => {
    await db.setting.upsert({ where: { key: "sales_open" }, update: { value: "false" }, create: { key: "sales_open", value: "false" } });
    await expect(ext([item(0)])).rejects.toThrow(/congeladas/);
    const o = await ext([item(0)], { bypassFreeze: true });
    expect(o.status).toBe("PAID");
  });
});
