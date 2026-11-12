"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export const NAV = [
  ["/map", "The Map"],
  ["/join", "The Banners"],
  ["/ranking", "The Ranking"],
  ["/archive", "The Chronicles"],
  ["/rules", "The Rules"],
  ["/me", "My Shield"],
] as const;

const active = (path: string, href: string) => path === href || path.startsWith(`${href}/`);

/** Inline links on large screens; a menu button below. The current page is marked. */
export function SiteNav() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  return (
    <>
      <nav aria-label="Site" className="hidden gap-5 whitespace-nowrap text-sm text-parchment/70 lg:flex">
        {NAV.map(([href, label]) => (
          <Link
            key={href}
            href={href}
            aria-current={active(path, href) ? "page" : undefined}
            className="hover:text-parchment aria-[current=page]:text-gold"
          >
            {label}
          </Link>
        ))}
      </nav>
      <div className="lg:hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="site-menu"
          aria-label="Menu"
          className="grid h-9 w-9 place-items-center rounded-md border border-gold/30 text-parchment/80 hover:border-gold/60"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            {open ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
        {open && (
          <nav
            id="site-menu"
            aria-label="Site"
            className="absolute inset-x-0 top-14 z-40 border-b border-gold/40 bg-[#191613] px-4 py-2 shadow-[0_10px_24px_rgba(0,0,0,0.6)]"
          >
            {NAV.map(([href, label]) => (
              <Link
                key={href}
                href={href}
                aria-current={active(path, href) ? "page" : undefined}
                className="block border-b border-white/5 py-3 font-display text-sm tracking-[0.14em] text-parchment/85 last:border-0 aria-[current=page]:text-gold"
              >
                {label.toUpperCase()}
              </Link>
            ))}
          </nav>
        )}
      </div>
    </>
  );
}
