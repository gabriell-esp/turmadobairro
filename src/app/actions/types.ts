export type FormState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Valores devolvidos para repreencher o formulário após erro */
  values?: Record<string, string>;
  redirectTo?: string;
} | null;
