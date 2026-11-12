"use client";

import { useEffect, useState } from "react";
import { COOLDOWN_MINUTES } from "@config/game";
import type { FactionId } from "@/lib/factions";
import { STATIC_CELLS, cellLabel, neighbors } from "@/lib/map/layout";
import type { CellState } from "@/lib/map/state";

/**
 * Where a Banner may deploy right now (rule 4): its own cells, and the cells touching them
 * by a side — never water, never another Banner's base camp. The guide lights up the
 * targets of the first deployment: the cells next to your land, and your own base camp.
 */
export function deployTargets(cells: CellState[], faction: FactionId): number[] {
  const out: number[] = [];
  for (const c of cells) {
    const st = STATIC_CELLS[c.id];
    if (st.terrain === "water") continue;
    if (st.baseOf && st.baseOf !== faction) continue;
    if (st.baseOf === faction) {
      out.push(c.id);
      continue;
    }
    if (c.owner === faction) continue; // already ours: valid, but the guide points outwards
    if (neighbors(c.id).some((n) => cells[n]?.owner === faction && STATIC_CELLS[n].terrain !== "water")) out.push(c.id);
  }
  return out;
}

/** Rule 4 for one cell: may this Banner deploy here? */
export function canDeployOn(cells: CellState[], faction: FactionId, id: number): boolean {
  const st = STATIC_CELLS[id];
  if (!st || st.terrain === "water") return false;
  if (st.baseOf) return st.baseOf === faction;
  if (cells[id]?.owner === faction) return true;
  return neighbors(id).some((n) => cells[n]?.owner === faction && STATIC_CELLS[n].terrain !== "water");
}

const DONE_KEY = "wg_first_deploy_done";
export type GuideStep = "pick" | "deploy" | "done";

/** The guide runs once per browser, until the first deployment (or until skipped). */
export function useFirstDeployGuide(eligible: boolean, hasDeployed: boolean, selectedIsTarget: boolean) {
  const [dismissed, setDismissed] = useState(true);
  const [justDeployed, setJustDeployed] = useState(false);
  const [wasEligible, setWasEligible] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DONE_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);
  useEffect(() => {
    if (eligible && !hasDeployed) setWasEligible(true);
    if (wasEligible && hasDeployed) setJustDeployed(true);
  }, [eligible, hasDeployed, wasEligible]);

  const finish = () => {
    try {
      localStorage.setItem(DONE_KEY, "1");
    } catch {
      /* private mode */
    }
    setDismissed(true);
    setJustDeployed(false);
  };

  let step: GuideStep | null = null;
  if (!dismissed) {
    if (justDeployed) step = "done";
    else if (eligible && !hasDeployed) step = selectedIsTarget ? "deploy" : "pick";
  }
  return { step, finish };
}

export function GuideCard({
  step,
  cell,
  onSkip,
  inline = false,
}: {
  step: GuideStep;
  cell: number | null;
  onSkip: () => void;
  /** inside the mobile drawer instead of over the map */
  inline?: boolean;
}) {
  const n = step === "pick" ? 1 : step === "deploy" ? 2 : 3;
  return (
    <div
      role="status"
      className={
        inline
          ? "mb-4 rounded-md border border-gold/70 bg-gold/[0.07] px-3 py-2.5 text-sm"
          : "absolute inset-x-3 top-14 z-20 mx-auto max-w-md rounded-md border border-gold bg-charcoal/95 px-4 py-3 text-sm shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
      }
    >
      <div className="flex items-center justify-between">
        <span className="font-display text-[11px] tracking-[0.2em] text-gold">YOUR FIRST DEPLOYMENT · {n}/3</span>
        {step !== "done" && (
          <button onClick={onSkip} className="text-xs text-parchment/50 hover:text-parchment">
            Skip
          </button>
        )}
      </div>
      <p className="mt-1 text-parchment/90">
        {step === "pick" && (
          <>
            The <span className="text-gold">glowing cells</span> are yours to take: they touch your Banner&apos;s land. Tap
            one.
          </>
        )}
        {step === "deploy" && (
          <>
            {cell !== null && <span className="font-mono text-gold">{cellLabel(cell)}</span>}: choose how many soldiers
            to send, then press <span className="font-semibold text-gold">Deploy</span>.
          </>
        )}
        {step === "done" && (
          <>
            Your soldiers stand. Their ink stays wet for {COOLDOWN_MINUTES} minutes; then they may march again. Every
            full hour, each cell your Banner holds scores. The war is yours.
          </>
        )}
      </p>
      {step === "done" && (
        <button onClick={onSkip} className="mt-2 rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-charcoal hover:brightness-110">
          To war
        </button>
      )}
    </div>
  );
}
