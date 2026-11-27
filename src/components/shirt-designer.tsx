"use client";

import { useEffect, useState } from "react";
import { DEFAULT_SHIRT, DEFAULT_STRIPE, ShirtArt } from "./shirt-art";

const PALETTE = [
  { name: "Azul", hex: "#1478d6" },
  { name: "Azul-marinho", hex: "#0b2a5b" },
  { name: "Vermelho", hex: "#e11d2a" },
  { name: "Dourado", hex: "#f2b705" },
  { name: "Verde", hex: "#1c8b3c" },
  { name: "Laranja", hex: "#f07a12" },
  { name: "Rosa", hex: "#e0489b" },
  { name: "Roxo", hex: "#6b3fb5" },
  { name: "Preto", hex: "#1b1b1b" },
  { name: "Branco", hex: "#f5f5f5" },
];

/**
 * Editor do visual do abadá: foto (opcional) OU ilustração com a cor escolhida, com prévia ao vivo.
 * Campos enviados no formulário: image (arquivo), removeImage, shirtColor, stripeColor.
 */
export function ShirtDesigner({ currentImageUrl, color, stripe }: { currentImageUrl?: string | null; color?: string | null; stripe?: string | null }) {
  const [main, setMain] = useState(color || DEFAULT_SHIRT);
  const [band, setBand] = useState(stripe || DEFAULT_STRIPE);
  const [preview, setPreview] = useState<string | null>(null);
  const [remove, setRemove] = useState(false);
  const [fileError, setFileError] = useState("");

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const photo = preview ?? (currentImageUrl && !remove ? currentImageUrl : null);

  return (
    <fieldset className="sm:col-span-2 lg:col-span-3 rounded-xl border-2 border-ink/15 p-4">
      <legend className="label px-1">Visual do abadá na loja</legend>
      <div className="grid gap-5 md:grid-cols-[14rem_minmax(0,1fr)]">
        <div className="bg-rauten grid min-h-48 place-items-center rounded-xl border-2 border-ink p-4" aria-live="polite">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="Prévia da foto do abadá" className="h-40 w-auto max-w-full object-contain drop-shadow-lg" />
          ) : (
            <ShirtArt color={main} stripe={band} className="h-40 w-auto drop-shadow-[0_6px_0_rgba(0,0,0,.25)]" />
          )}
        </div>

        <div className="space-y-4">
          <div className="field">
            <label htmlFor="image">Foto do abadá (opcional)</label>
            <input
              id="image"
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              className="input"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFileError("");
                if (preview) URL.revokeObjectURL(preview);
                if (!f) return setPreview(null);
                if (f.size > 6 * 1024 * 1024) {
                  e.target.value = "";
                  setPreview(null);
                  return setFileError("Imagem muito grande (máx. 6 MB).");
                }
                setPreview(URL.createObjectURL(f));
                setRemove(false);
              }}
            />
            <p className="hint">Se houver foto, ela aparece no lugar da ilustração. JPG, PNG ou WebP, até 6 MB.</p>
            {fileError && <p className="error-text">{fileError}</p>}
            {currentImageUrl && (
              <label className="mt-1 flex items-center gap-2 text-sm font-bold">
                <input type="checkbox" name="removeImage" checked={remove} onChange={(e) => { setRemove(e.target.checked); if (e.target.checked) setPreview(null); }} className="h-4 w-4 accent-red" />
                Remover a foto atual e usar a ilustração
              </label>
            )}
          </div>

          <div className={photo ? "opacity-60" : ""}>
            <ColorPick label="Cor da camisa" name="shirtColor" value={main} onChange={setMain} />
            <div className="mt-3" />
            <ColorPick label="Cor da faixa" name="stripeColor" value={band} onChange={setBand} />
            {photo && <p className="hint mt-2">As cores valem para a ilustração (quando não houver foto).</p>}
          </div>
        </div>
      </div>
    </fieldset>
  );
}

function ColorPick({ label, name, value, onChange }: { label: string; name: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <p className="label">{label}</p>
      <input type="hidden" name={name} value={value} />
      <div className="flex flex-wrap items-center gap-2">
        {PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            title={c.name}
            aria-label={`${label}: ${c.name}`}
            aria-pressed={value.toLowerCase() === c.hex}
            onClick={() => onChange(c.hex)}
            className={`h-8 w-8 rounded-full border-2 ${value.toLowerCase() === c.hex ? "border-ink ring-2 ring-gold" : "border-ink/40"}`}
            style={{ background: c.hex }}
          />
        ))}
        <label className="ml-1 flex items-center gap-1.5 text-sm font-bold">
          Outra
          <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label={`${label}: escolher outra cor`} className="h-8 w-10 cursor-pointer rounded border-2 border-ink/40 bg-white p-0.5" />
        </label>
      </div>
    </div>
  );
}
