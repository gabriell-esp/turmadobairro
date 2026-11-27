import { db } from "@/lib/db";
import { getCurrentEvent } from "@/lib/event";

export const dynamic = "force-dynamic";

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

export async function GET() {
  const event = await getCurrentEvent();
  const items = event
    ? await db.scheduleItem.findMany({ where: { eventId: event.id, published: true }, orderBy: { startsAt: "asc" } })
    : [];
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Turma do Bairro//Programacao//PT-BR",
    "CALSCALE:GREGORIAN",
    `X-WR-CALNAME:${esc(event?.name ?? "Turma do Bairro")}`,
  ];
  for (const it of items) {
    const end = it.endsAt ?? new Date(it.startsAt.getTime() + 60 * 60_000);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${it.id}@turmadobairro`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(it.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(it.title)}`,
      ...(it.location ? [`LOCATION:${esc(it.location)}`] : []),
      ...(it.description ? [`DESCRIPTION:${esc(it.description)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n"), {
    headers: { "Content-Type": "text/calendar; charset=utf-8", "Content-Disposition": 'attachment; filename="turma-do-bairro.ics"' },
  });
}
