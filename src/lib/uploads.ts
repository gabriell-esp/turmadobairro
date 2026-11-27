import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? "./storage/uploads");
const MAX_BYTES = 6 * 1024 * 1024;

/**
 * O `sharp` só é carregado quando alguém envia uma foto. Assim o site (e o build) sobe mesmo em
 * servidores com CPU virtual antiga, onde o sharp não funciona; só o envio de fotos fica indisponível.
 */
async function loadSharp() {
  try {
    return (await import("sharp")).default;
  } catch (e) {
    console.error("[uploads] não foi possível carregar o sharp (CPU do servidor sem suporte?)", e);
    throw new Error("O servidor não consegue processar imagens (CPU sem suporte). Avise quem cuida do servidor.");
  }
}

/**
 * Salva uma imagem enviada pelo painel. Não confia no tipo informado: decodifica com sharp
 * (rejeita arquivos que não são imagem), remove metadados/EXIF (privacidade), limita o tamanho
 * e converte para WebP com nome aleatório.
 */
export async function saveImage(file: File, maxWidth = 1600): Promise<string> {
  if (!file || file.size === 0) throw new Error("Selecione uma imagem.");
  if (file.size > MAX_BYTES) throw new Error("Imagem muito grande (máx. 6 MB).");
  const input = Buffer.from(await file.arrayBuffer());
  const sharp = await loadSharp();
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
