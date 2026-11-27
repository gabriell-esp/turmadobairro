import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let dir = "";
beforeAll(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), "tb-uploads-"));
  process.env.UPLOAD_DIR = dir;
});
afterAll(async () => { await rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }).catch(() => {}); });

describe("foto do abadá (upload)", () => {
  it("converte para WebP com nome aleatório e limita a largura", async () => {
    const { saveImage } = await import("@/lib/uploads");
    const png = await sharp({ create: { width: 3000, height: 2000, channels: 3, background: "#1c8b3c" } }).png().toBuffer();
    const url = await saveImage(new File([new Uint8Array(png)], "abada.png", { type: "image/png" }), 1200);
    expect(url).toMatch(/^\/uploads\/[a-f0-9]{24}\.webp$/);
    const files = await readdir(dir);
    expect(files).toHaveLength(1);
    const meta = await sharp(await readFile(path.join(dir, files[0]))).metadata();
    expect(meta.format).toBe("webp");
    expect(meta.width).toBe(1200);
  });

  it("rejeita arquivo que não é imagem (mesmo com tipo de imagem)", async () => {
    const { saveImage } = await import("@/lib/uploads");
    await expect(saveImage(new File([new TextEncoder().encode("<script>alert(1)</script>")], "x.png", { type: "image/png" }))).rejects.toThrow(/inválido/i);
  });

  it("rejeita imagem acima de 6 MB", async () => {
    const { saveImage } = await import("@/lib/uploads");
    await expect(saveImage(new File([new Uint8Array(6 * 1024 * 1024 + 1)], "grande.jpg", { type: "image/jpeg" }))).rejects.toThrow(/muito grande/i);
  });
});
