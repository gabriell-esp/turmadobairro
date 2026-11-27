import { Logo } from "./ui";

export function AuthShell({ title, subtitle, children, wide }: { title: string; subtitle?: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className="bg-rauten border-b-4 border-ink py-10 sm:py-16">
      <div className={`container-page ${wide ? "max-w-3xl" : "max-w-md"}`}>
        <div className="card p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-4">
            <Logo size={72} className="h-auto w-16 shrink-0" />
            <div>
              <h1 className="h-display text-4xl text-navy">{title}</h1>
              {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
            </div>
          </div>
          {children}
        </div>
      </div>
    </section>
  );
}
