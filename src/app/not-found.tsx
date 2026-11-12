import Link from "next/link";
import PageShell from "@/components/PageShell";
import { Lore } from "@/components/Ornaments";

/** Any unknown page (or a season that is not in the Chronicles). */
export default function NotFound() {
  return (
    <PageShell>
      <div className="mx-auto max-w-md text-center">
        <p className="font-display text-xs tracking-[0.35em] text-gold/70">404</p>
        <h1 className="mt-2 font-display text-2xl tracking-[0.2em] text-gold">LOST IN THE FOG</h1>
        <Lore className="mt-4">This page is on no map. Perhaps the scroll was never written, or the Plague took it.</Lore>
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/map" className="rounded-md bg-gold px-5 py-2 text-sm font-semibold text-charcoal hover:brightness-110">
            To the map
          </Link>
          <Link href="/archive" className="rounded-md border border-gold/50 px-5 py-2 text-sm font-semibold text-gold hover:bg-gold/10">
            The Chronicles
          </Link>
        </div>
      </div>
    </PageShell>
  );
}
