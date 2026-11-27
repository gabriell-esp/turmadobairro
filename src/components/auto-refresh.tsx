"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Atualiza a página a cada `seconds` por no máximo `maxSeconds` (ex.: aguardando confirmação do pagamento). */
export function AutoRefresh({ seconds = 5, maxSeconds = 180 }: { seconds?: number; maxSeconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const start = Date.now();
    const t = setInterval(() => {
      if (Date.now() - start > maxSeconds * 1000) return clearInterval(t);
      router.refresh();
    }, seconds * 1000);
    return () => clearInterval(t);
  }, [router, seconds, maxSeconds]);
  return null;
}
