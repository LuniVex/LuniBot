import { Container } from "./Container";

/** Label in the left 3 columns, content in the right 9 (L3). Sections are divided by 1px rules (L4). */
export function Section({ id, label, aside, children }: { id?: string; label: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={id ? `${id}-h` : undefined} className="scroll-mt-16 border-b border-rule py-12 last:border-b-0 md:py-16">
      <Container className="grid gap-x-6 gap-y-4 md:grid-cols-12">
        <div className="md:col-span-3">
          <h2 id={id ? `${id}-h` : undefined} className="font-display text-xl font-semibold">{label}</h2>
          {aside && <div className="mt-2 text-sm text-muted">{aside}</div>}
        </div>
        <div className="min-w-0 md:col-span-9">{children}</div>
      </Container>
    </section>
  );
}
