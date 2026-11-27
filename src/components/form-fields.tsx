import { FieldError } from "./client";

type Errors = Record<string, string> | undefined;
type Values = Record<string, string> | undefined;

export function Field({
  label,
  name,
  type = "text",
  errors,
  values,
  hint,
  required = true,
  autoComplete,
  maxLength,
  children,
  defaultValue,
  placeholder,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  errors?: Errors;
  values?: Values;
  hint?: string;
  required?: boolean;
  autoComplete?: string;
  maxLength?: number;
  children?: React.ReactNode;
  defaultValue?: string;
  placeholder?: string;
  inputMode?: "numeric" | "text" | "email" | "tel";
}) {
  const id = `f-${name}`;
  const invalid = !!errors?.[name];
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {!required && <span className="ml-1 font-normal text-muted">(opcional)</span>}
      </label>
      {children ?? (
        <input
          id={id}
          name={name}
          type={type}
          required={required}
          autoComplete={autoComplete}
          maxLength={maxLength}
          placeholder={placeholder}
          inputMode={inputMode}
          defaultValue={values?.[name] ?? defaultValue ?? ""}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className="input"
        />
      )}
      {hint && !invalid && (
        <p id={`${id}-hint`} className="hint">
          {hint}
        </p>
      )}
      <div id={`${id}-err`}>
        <FieldError errors={errors} name={name} />
      </div>
    </div>
  );
}

export function yearOptions(from = 2008) {
  const now = new Date().getFullYear();
  const out: number[] = [];
  for (let y = now; y >= from; y--) out.push(y);
  return out;
}
