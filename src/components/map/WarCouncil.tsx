"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { CHAT_MAX, CHAT_POLL_MS, type ChatMessage, type Grade } from "@/lib/chat";

/**
 * The War Council: the private chat of the player's Banner, on a parchment that folds away.
 * Only shown to a signed-in, sworn player; /api/chat decides on its own who may read it.
 * New messages come by polling every 4 s with ?since= (no public Realtime channel).
 */
const OPEN_KEY = "wg_council_open";
const KEEP = 200;

const GRADE_STYLE: Record<Grade, string> = {
  Warlord: "border-[#8a5a12] bg-[#c9a24b]/45 text-[#3d2508]",
  Captain: "border-[#6b3d1c] bg-[#a8683a]/25 text-[#4a2610]",
  Sergeant: "border-ink/45 bg-ink/10 text-ink/85",
  Soldier: "border-ink/30 text-ink/70",
  Recruit: "border-ink/20 text-ink/55",
};

const hhmm = (t: number) => new Date(t).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

export function WarCouncil({ faction }: { faction: FactionId }) {
  const f = FACTION_BY_ID[faction];
  const [open, setOpen] = useState(true);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [mutedUntil, setMutedUntil] = useState<number | null>(null);
  const [reported, setReported] = useState<Set<number>>(new Set());
  const lastId = useRef(0);
  const list = useRef<HTMLOListElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    const saved = localStorage.getItem(OPEN_KEY);
    if (saved !== null) setOpen(saved === "1");
  }, []);
  const toggle = () =>
    setOpen((o) => {
      localStorage.setItem(OPEN_KEY, o ? "0" : "1");
      return !o;
    });

  // a new Banner, a new council
  useEffect(() => {
    lastId.current = 0;
    setMessages([]);
    setLoaded(false);
  }, [faction]);

  const poll = useCallback(async () => {
    try {
      const r = await fetch(`/api/chat?since=${lastId.current}`, { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status !== 429) setError(j.message ?? "The council cannot be reached.");
        return;
      }
      setMutedUntil(j.mutedUntil ?? null);
      const fresh: ChatMessage[] = j.messages ?? [];
      if (fresh.length) {
        lastId.current = fresh[fresh.length - 1].id;
        setMessages((m) => [...m, ...fresh.filter((x) => !m.some((y) => y.id === x.id))].slice(-KEEP));
      }
      setLoaded(true);
    } catch {
      /* offline: the next tick tries again */
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void poll();
    const t = setInterval(() => {
      if (document.visibilityState === "visible") void poll();
    }, CHAT_POLL_MS);
    return () => clearInterval(t);
  }, [open, poll, faction]);

  // follow the conversation, unless the reader scrolled up
  useEffect(() => {
    const el = list.current;
    if (el && stick.current) el.scrollTop = el.scrollHeight;
  }, [messages, open]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: body }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(j.message ?? "The message was not sent.");
        if (j.mutedUntil) setMutedUntil(j.mutedUntil);
        return;
      }
      setText("");
      stick.current = true;
      await poll();
    } finally {
      setSending(false);
    }
  };

  const report = async (id: number) => {
    setReported((s) => new Set(s).add(id));
    const r = await fetch("/api/chat/report", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ id }) });
    if (!r.ok) setError((await r.json().catch(() => ({}))).message ?? "The report was not sent.");
  };

  const muted = mutedUntil !== null && mutedUntil > Date.now();
  const left = CHAT_MAX - [...text].length;

  return (
    <section aria-label="War Council" className="mt-6">
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-controls="war-council"
        className="flex w-full items-center gap-2 border-y border-gold/30 py-2 text-left"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={f.crest} alt="" className="h-7 w-auto" />
        <span className="flex-1">
          <span className="block font-display text-xs tracking-[0.2em] text-gold">WAR COUNCIL</span>
          <span className="block text-[11px] text-parchment/50">{f.name} only · sealed from the other Banners</span>
        </span>
        <span className={`text-parchment/60 transition ${open ? "rotate-180" : ""}`} aria-hidden>
          ⌃
        </span>
      </button>

      {open && (
        <div
          id="war-council"
          className="mt-3 rounded-[3px] bg-[#c69d63] bg-[linear-gradient(rgba(222,192,140,0.5),rgba(222,192,140,0.5)),url(/ornaments/web/grimoire_paper.webp)] bg-[length:100%_100%] p-3 text-ink shadow-[inset_0_0_28px_rgba(36,19,10,0.5),0_6px_16px_rgba(0,0,0,0.45)]"
        >
          <ol
            ref={list}
            onScroll={(e) => {
              const el = e.currentTarget;
              stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
            }}
            className="h-72 space-y-2.5 overflow-y-auto pr-1 font-fell text-[16px] leading-snug"
            aria-live="polite"
          >
            {!loaded ? (
              <li className="italic text-ink/60">The council gathers…</li>
            ) : messages.length === 0 ? (
              <li className="italic text-ink/65">The table is empty. Speak first, and plan the war with your Banner.</li>
            ) : (
              messages.map((m) => (
                <li key={m.id} className="group border-b border-ink/15 pb-2 last:border-0">
                  <div className="flex items-center gap-1.5 text-[11px] not-italic">
                    <span className={`font-mono font-semibold ${m.mine ? "text-[#6b1f12]" : "text-ink/85"}`}>{m.author}</span>
                    <span className={`rounded-sm border px-1 font-display text-[9px] tracking-[0.12em] ${GRADE_STYLE[m.grade]}`}>
                      {m.grade.toUpperCase()}
                    </span>
                    <span className="text-ink/45">{hhmm(m.at)}</span>
                    {!m.mine && (
                      <button
                        onClick={() => void report(m.id)}
                        disabled={reported.has(m.id)}
                        className="ml-auto text-[10px] text-ink/45 underline-offset-2 hover:text-[#6b1f12] hover:underline disabled:no-underline disabled:opacity-60"
                        title="Report this message to the admins"
                      >
                        {reported.has(m.id) ? "Reported" : "Report"}
                      </button>
                    )}
                  </div>
                  {/* plain text: React escapes it, and the server refuses HTML and links anyway */}
                  <p className="mt-0.5 whitespace-pre-wrap break-words">{m.body}</p>
                </li>
              ))
            )}
          </ol>

          <form
            className="mt-2 border-t border-ink/25 pt-2"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void send();
                }
              }}
              maxLength={CHAT_MAX + 20}
              rows={2}
              disabled={muted}
              placeholder={muted ? `Silenced until ${hhmm(mutedUntil!)}` : "Speak to your Banner…"}
              aria-label="Message to the War Council"
              className="w-full resize-none rounded-[2px] border border-ink/35 bg-[#f3e6c8]/55 px-2 py-1.5 font-fell text-[16px] text-ink placeholder:italic placeholder:text-ink/45 focus:border-ink/70 focus:outline-none disabled:opacity-60"
            />
            <div className="mt-1 flex items-center gap-2">
              <span className={`text-[11px] ${left < 0 ? "font-semibold text-[#8b1d10]" : "text-ink/50"}`}>{left}</span>
              {error && <span className="min-w-0 flex-1 truncate text-[11px] text-[#8b1d10]" title={error}>{error}</span>}
              <button
                type="submit"
                disabled={muted || sending || !text.trim() || left < 0}
                className="ml-auto rounded-[2px] bg-ink px-3 py-1 font-display text-[11px] tracking-[0.15em] text-parchment hover:bg-ink/85 disabled:opacity-45"
              >
                SEND
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}
