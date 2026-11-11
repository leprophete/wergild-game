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
    const load = async () => {
      try {
        const res = await fetch("/api/map", { cache: "no-store" });
        if (res.status === 404) return alive && setStatus("no-season");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const p = (await res.json()) as MapPayload;
        if (!alive) return;
        setPayload(p);
        setStatus("live");
      } catch (e) {
        console.error("map load failed", e);
        if (alive) setStatus("offline");
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
    const poll = setInterval(load, 60_000);
    const onVisible = () => document.visibilityState === "visible" && reload();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      alive = false;
      clearInterval(poll);
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) sb?.removeChannel(channel);
    };
  }, [enabled]);

  return { payload, status };
}
