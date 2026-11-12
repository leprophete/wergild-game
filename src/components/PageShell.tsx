import Link from "next/link";
import { ConnectButton } from "@/components/wallet/ConnectButton";
import { SiteNav } from "@/components/SiteNav";

/** Header + frame for the pages around the map (/join, /me…). */
export default function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-charcoal text-parchment">
      <header className="relative z-30 flex h-14 items-center gap-3 border-b border-gold/40 px-4 md:px-6">
        <div className="pointer-events-none absolute inset-x-0 bottom-[3px] h-px bg-gold/20" />
        <Link href="/" className="font-display text-lg font-bold tracking-[0.12em] text-gold md:text-xl">
          $WERGILD
        </Link>
        <SiteNav />
        <ConnectButton className="ml-auto shrink-0 whitespace-nowrap" />
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 md:px-6">{children}</main>
    </div>
  );
}
