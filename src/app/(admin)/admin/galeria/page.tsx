import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/auth";
import { galleryItemAction, uploadGalleryAction } from "@/app/actions/admin-content";
import { ConfirmSubmit } from "@/components/client";
import { AdminTitle, Empty, Panel } from "@/components/admin-ui";

export const metadata: Metadata = { title: "Galeria" };
export const dynamic = "force-dynamic";

export default async function GaleriaAdmin({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  await requirePermission("gallery.manage");
  const sp = await searchParams;
  const images = await db.galleryImage.findMany({ orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }] });
  return (
    <>
      <AdminTitle title="Galeria">Fotos exibidas na página inicial. Só publique imagens com autorização de quem aparece (LGPD — imagem é dado pessoal).</AdminTitle>
      {sp.msg && <div role="status" className="alert alert-ok mb-4">{sp.msg}</div>}
      {sp.err && <div role="alert" className="alert alert-error mb-4">{sp.err}</div>}
      <Panel title="Enviar fotos" className="mb-6">
        <form action={uploadGalleryAction} className="grid gap-4 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
          <div className="field"><label htmlFor="images">Imagens (até 4 por envio, 6 MB cada, JPG/PNG/WebP)</label><input id="images" type="file" name="images" accept="image/png,image/jpeg,image/webp" multiple required className="input" /></div>
          <div className="field"><label htmlFor="caption">Legenda (opcional)</label><input id="caption" name="caption" maxLength={140} className="input" /></div>
          <button className="btn btn-red">Enviar</button>
        </form>
        <p className="hint mt-2">Os metadados (EXIF/localização) são removidos automaticamente.</p>
      </Panel>
      {images.length === 0 ? <Empty>Nenhuma foto enviada.</Empty> : (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {images.map((g) => (
            <li key={g.id} className="card-flat overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.url} alt={g.caption ?? ""} className={`aspect-square w-full object-cover ${g.published ? "" : "opacity-40"}`} />
              <div className="flex items-center justify-between gap-2 p-2">
                <form action={galleryItemAction}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="op" value="toggle" /><button className="btn btn-sm btn-white">{g.published ? "Ocultar" : "Publicar"}</button></form>
                <form action={galleryItemAction}><input type="hidden" name="id" value={g.id} /><input type="hidden" name="op" value="delete" /><ConfirmSubmit message="Excluir esta foto?" className="btn btn-sm btn-ghost !text-red-dark">Excluir</ConfirmSubmit></form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
