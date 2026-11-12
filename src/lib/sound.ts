"use client";

import { useEffect, useState } from "react";

/**
 * Optional sounds (SPEC "Son"): quill scratch on deploy, drum roll on conquest, hunting horn
 * when an event begins, the knell at the end of a season. OFF by default, remembered per
 * browser. Synthesised with Web Audio: no file to download, nothing plays until the player
 * has switched sound on (which is also the user gesture browsers require).
 */
export type Cue = "quill" | "drum" | "horn" | "knell";

const KEY = "wg_sound";
let ctx: AudioContext | null = null;
const listeners = new Set<(on: boolean) => void>();

export function soundOn(): boolean {
  try {
    return localStorage.getItem(KEY) === "on";
  } catch {
    return false;
  }
}

export function setSoundOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode */
  }
  if (on) {
    audio();
    play("quill");
  }
  for (const l of listeners) l(on);
}

export function useSoundSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(soundOn());
    listeners.add(setOn);
    return () => {
      listeners.delete(setOn);
    };
  }, []);
  return [on, setSoundOn];
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function noise(a: AudioContext, seconds: number) {
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * seconds), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const src = a.createBufferSource();
  src.buffer = buf;
  return src;
}

function master(a: AudioContext, volume: number) {
  const g = a.createGain();
  g.gain.value = volume;
  g.connect(a.destination);
  return g;
}

/** A quill scratching parchment: three short bursts of filtered noise. */
function quill(a: AudioContext, t: number) {
  const out = master(a, 0.22);
  for (let i = 0; i < 3; i++) {
    const s = noise(a, 0.12);
    const bp = a.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 3200 + i * 700;
    bp.Q.value = 1.8;
    const g = a.createGain();
    const t0 = t + i * 0.11;
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09 + i * 0.01);
    s.connect(bp).connect(g).connect(out);
    s.start(t0);
    s.stop(t0 + 0.13);
  }
}

/** A short war-drum roll ending on a heavy stroke. */
function drum(a: AudioContext, t: number) {
  const out = master(a, 0.5);
  const hits = [0, 0.09, 0.17, 0.24, 0.3, 0.36, 0.5];
  hits.forEach((dt, i) => {
    const last = i === hits.length - 1;
    const o = a.createOscillator();
    o.type = "sine";
    const t0 = t + dt;
    o.frequency.setValueAtTime(last ? 95 : 140, t0);
    o.frequency.exponentialRampToValueAtTime(last ? 45 : 70, t0 + 0.2);
    const g = a.createGain();
    g.gain.setValueAtTime(last ? 1 : 0.35 + i * 0.07, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + (last ? 0.55 : 0.16));
    o.connect(g).connect(out);
    o.start(t0);
    o.stop(t0 + 0.6);
    const s = noise(a, 0.08);
    const hp = a.createBiquadFilter();
    hp.type = "lowpass";
    hp.frequency.value = 900;
    const gs = a.createGain();
    gs.gain.setValueAtTime(0.25, t0);
    gs.gain.exponentialRampToValueAtTime(0.001, t0 + 0.07);
    s.connect(hp).connect(gs).connect(out);
    s.start(t0);
  });
}

/** A hunting horn: two brassy notes, a fifth apart. */
function horn(a: AudioContext, t: number) {
  const out = master(a, 0.18);
  const notes: [number, number, number][] = [
    [0, 0.42, 233.08],
    [0.48, 0.9, 349.23],
  ];
  for (const [dt, len, f] of notes) {
    const t0 = t + dt;
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(600, t0);
    lp.frequency.linearRampToValueAtTime(2200, t0 + 0.12);
    lp.frequency.linearRampToValueAtTime(1300, t0 + len);
    const g = a.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(1, t0 + 0.07);
    g.gain.setValueAtTime(1, t0 + len - 0.12);
    g.gain.linearRampToValueAtTime(0, t0 + len);
    for (const det of [-4, 4]) {
      const o = a.createOscillator();
      o.type = "sawtooth";
      o.frequency.value = f;
      o.detune.value = det;
      o.connect(lp);
      o.start(t0);
      o.stop(t0 + len + 0.05);
    }
    lp.connect(g).connect(out);
  }
}

/** The knell: a large bell, three tolls with inharmonic partials. */
function knell(a: AudioContext, t: number) {
  const out = master(a, 0.22);
  const partials: [number, number, number][] = [
    [0.5, 1, 4.5],
    [1, 0.7, 3.5],
    [1.19, 0.45, 2.6],
    [1.56, 0.35, 2],
    [2, 0.3, 1.6],
    [2.74, 0.2, 1.1],
  ];
  for (let k = 0; k < 3; k++) {
    const t0 = t + k * 2.2;
    for (const [m, amp, decay] of partials) {
      const o = a.createOscillator();
      o.type = "sine";
      o.frequency.value = 196 * m;
      const g = a.createGain();
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(amp, t0 + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0008, t0 + decay);
      o.connect(g).connect(out);
      o.start(t0);
      o.stop(t0 + decay + 0.1);
    }
  }
}

const lastPlayed: Partial<Record<Cue, number>> = {};

/** Plays a cue if sound is on (and not the same cue within the last second). */
export function play(cue: Cue) {
  if (!soundOn()) return;
  const a = audio();
  if (!a) return;
  const now = performance.now();
  if (now - (lastPlayed[cue] ?? 0) < 1000) return;
  lastPlayed[cue] = now;
  const t = a.currentTime + 0.02;
  ({ quill, drum, horn, knell })[cue](a, t);
}
