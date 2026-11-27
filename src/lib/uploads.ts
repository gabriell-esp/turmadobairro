import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * Salva uma imagem enviada pelo painel. Não confia no tipo informado: decodifica com sharp
 * (rejeita arquivos que não são imagem), remove metadados/EXIF (privacidade), limita o tamanho
 * e converte para WebP com nome aleatório.
 */
export async function saveImage(file: File, maxWidth = 1600): Promise<string> {
  if (!file || file.size === 0) throw new Error("Selecione uma imagem.");
  if (file.size > MAX_BYTES) throw new Error("Imagem muito grande (máx. 6 MB).");
  const input = Buffer.from(await file.arrayBuffer());
  let out: Buffer;
  try {
    out = await sharp(input, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: maxWidth, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new Error("Arquivo inválido: envie uma imagem JPG, PNG ou WebP.");
  }
  const name = `${randomBytes(12).toString("hex")}.webp`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), out);
  return `/uploads/${name}`;
}
