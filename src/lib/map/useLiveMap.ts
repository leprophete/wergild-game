"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/client";
import type { MapPayload } from "./remote";

export type LiveStatus = "loading" | "live" | "offline" | "no-season";

/**
 * Loads GET /api/map, then listens to Supabase Realtime (cells, events, seasons, score_ticks).
 * Every game action touches its cell row, so any change triggers a (debounced) reload:
 * the server stays the only source of truth.
 */
export function useLiveMap(enabled: boolean) {
  const [payload, setPayload] = useState<MapPayload | null>(null);
  const [status, setStatus] = useState<LiveStatus>("loading");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    let inflight: AbortController | null = null;
    let lastBody = "";
    const load = async () => {
      inflight?.abort();
      const ctl = new AbortController();
      inflight = ctl;
      try {
        const res = await fetch("/api/map", { cache: "no-store", signal: ctl.signal });
        if (res.status === 404) return alive && setStatus("no-season");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const body = await res.text();
        if (!alive) return;
        setStatus("live");
        // nothing moved since the last read: no new state, no re-render, no redraw
        if (body.replace(/"generatedAt":\d+/, "") === lastBody) return;
        lastBody = body.replace(/"generatedAt":\d+/, "");
        setPayload(JSON.parse(body) as MapPayload);
      } catch (e) {
        if (!alive || ctl.signal.aborted) return;
        // a blip (network, server reloading): keep the last map, say so, retry on the next tick.
        // Not console.error — it is expected and recoverable, not a bug.
        console.warn("map: reload failed, will retry", e instanceof Error ? e.message : e);
        setStatus("offline");
      }
    };
    const reload = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(load, 400);
    };
    load();

    const sb = getBrowserSupabase();
    const channel = sb
      ?.channel("wergild-map")
      .on("postgres_changes", { event: "*", schema: "public", table: "cells" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "seasons" }, reload)
      .on("postgres_changes", { event: "*", schema: "public", table: "score_ticks" }, reload)
      .subscribe();
    // safety net if a socket message is missed (tab asleep, network blip)
    const poll = setInterval(() => !document.hidden && load(), 60_000);
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      inflight?.abort();
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) sb?.removeChannel(channel);
    };
  }, [enabled]);

  return { payload, status };
}
