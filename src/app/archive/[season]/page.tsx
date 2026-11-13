import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import PageShell from "@/components/PageShell";
import { ChronicleSeason } from "@/components/chronicle/ChronicleSeason";
import { FACTION_BY_ID } from "@/lib/factions";
import { loadArchive } from "@/lib/game/archive";
import { getServerReadSupabase } from "@/lib/supabase/client";
import { roman } from "@/lib/roman";

export const revalidate = 3600; // a sealed season never changes

type Props = { params: Promise<{ season: string }> };

async function read(season: string) {
  if (!/^\d{1,6}$/.test(season)) return null;
  const sb = getServerReadSupabase();
  return sb ? loadArchive(sb, Number(season)) : null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const a = await read((await params).season).catch(() => null);
  if (!a) return { title: "The Chronicles — $WERGILD" };
  const win = a.winner ? FACTION_BY_ID[a.winner] : null;
  const title = `Season ${roman(a.number)} · ${a.name} — The Chronicles of $WERGILD`;
  const description = win ? `${win.name} carried the season with ${(a.scores[win.id] ?? 0).toLocaleString("en-US")} points.` : "A sealed season of the war.";
  // the share image is opengraph-image.tsx, next to this page
  return { title, description, openGraph: { title, description }, twitter: { card: "summary_large_image", title, description } };
}

/** The page shared for one season: its scroll, already unrolled. */
export default async function ArchiveSeasonPage({ params }: Props) {
  const a = await read((await params).season);
  if (!a) notFound();
  return (
    <PageShell>
      <div className="mx-auto max-w-4xl">
        <Link href="/archive" className="text-sm text-gold/80 hover:text-gold hover:underline">
          ← The Chronicles
        </Link>
        <div className="mt-6">
          <ChronicleSeason s={a} initial={a} />
        </div>
      </div>
    </PageShell>
  );
}
