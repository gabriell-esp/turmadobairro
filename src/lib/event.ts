import { cache } from "react";
import { db } from "./db";

/** Evento "atual": o marcado como atual; senão o próximo; senão o mais recente. */
export const getCurrentEvent = cache(async () => {
  const flagged = await db.event.findFirst({ where: { isCurrent: true, published: true } });
  if (flagged) return flagged;
  const upcoming = await db.event.findFirst({
    where: { published: true, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
  });
  if (upcoming) return upcoming;
  return db.event.findFirst({ where: { published: true }, orderBy: { startsAt: "desc" } });
});
