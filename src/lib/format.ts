const TZ = "America/Sao_Paulo";

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export const fmtDate = (d: Date | string, opts?: Intl.DateTimeFormatOptions) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ, ...(opts ?? { day: "2-digit", month: "2-digit", year: "numeric" }) });

export const fmtTime = (d: Date | string) =>
  new Date(d).toLocaleTimeString("pt-BR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

export const fmtDateTime = (d: Date | string) => `${fmtDate(d)} ${fmtTime(d)}`;

/** Campos "date" do banco são UTC meia-noite; exibe sem deslocar de fuso. */
export const fmtBirth = (d: Date | string) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });

export const toDateInput = (d: Date | string) => new Date(d).toISOString().slice(0, 10);

/** Valor para <input type="datetime-local"> no fuso de Brasília. */
export function toLocalInput(d: Date | string): string {
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
  return parts.replace(" ", "T");
}

/** Converte "YYYY-MM-DDTHH:mm" (horário de Brasília, UTC-3 sem DST) em Date. */
export function fromLocalInput(v: string): Date {
  return new Date(`${v}:00-03:00`);
}

export const orderCode = (n: number) => `TB-${String(n).padStart(5, "0")}`;

export const weekdayLong = (d: Date | string) =>
  new Date(d).toLocaleDateString("pt-BR", { timeZone: TZ, weekday: "long", day: "2-digit", month: "long" });

export function slugify(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
