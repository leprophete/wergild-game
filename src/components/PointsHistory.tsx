import { FACTIONS, FACTION_BY_ID, type FactionId } from "@/lib/factions";
import { cumulative } from "@/lib/game/bannerStats";

/**
 * Cumulative points over the season, one line per Banner: the page's own Banner drawn
 * strong in its colour, the four others thin and muted for scale. Each line is labelled
 * at its end (no legend to decode). Server-rendered SVG.
 */
export function PointsHistory({
  history,
  focus,
  startsAt,
  endsAt,
}: {
  history: { hour: number; points: Record<FactionId, number> }[];
  focus: FactionId;
  startsAt: number;
  endsAt: number;
}) {
  if (history.length < 2) {
    return (
      <p className="font-fell italic text-parchment/55">
        The chronicle of this season has only begun: come back in a few hours.
      </p>
    );
  }
  const W = 720;
  const H = 260;
  const pad = { l: 46, r: 118, t: 12, b: 26 };
  const iw = W - pad.l - pad.r;
  const ih = H - pad.t - pad.b;

  // cumulative series
  const series = cumulative(history);
  const acc = Object.fromEntries(
    FACTIONS.map((f) => [f.id, series[f.id][series[f.id].length - 1][1]]),
  ) as Record<FactionId, number>;
  // from the first scored hour to the last one (the season may have opened before scoring began)
  const t0 = Math.max(startsAt, history[0].hour);
  const t1 = Math.min(endsAt, history[history.length - 1].hour + 3_600_000);
  const max = Math.max(1, ...FACTIONS.map((f) => acc[f.id]));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const x = (t: number) => pad.l + ((t - t0) / (t1 - t0)) * iw;
  const y = (v: number) => pad.t + ih - (v / top) * ih;
  // every line starts from zero at the first scored hour
  const path = (pts: [number, number][]) =>
    ([[t0, 0], ...pts] as [number, number][])
      .map(
        ([t, v], i) => `${i ? "L" : "M"}${x(t).toFixed(1)},${y(v).toFixed(1)}`,
      )
      .join("");

  // time ticks: days for a long span, hours for a short one (UTC)
  const span = t1 - t0;
  const unit =
    span >= 2 * 86_400_000
      ? 86_400_000
      : span >= 12 * 3_600_000
        ? 6 * 3_600_000
        : 3_600_000;
  const ticksT: number[] = [];
  for (let d = Math.ceil(t0 / unit) * unit; d <= t1; d += unit) ticksT.push(d);
  const everyN = Math.max(1, Math.ceil(ticksT.length / 7));
  const label = (d: number) =>
    unit === 86_400_000
      ? new Date(d).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          timeZone: "UTC",
        })
      : `${new Date(d).toISOString().slice(11, 13)}:00`;

  // end labels, pushed apart so they never overlap
  const order = [...FACTIONS].sort((a, b) => acc[b.id] - acc[a.id]);
  const labelY: Record<string, number> = {};
  let last = -Infinity;
  for (const f of order) {
    const want = y(acc[f.id]);
    const yy = Math.max(want, last + 15);
    labelY[f.id] = yy;
    last = yy;
  }
  const lastT = series[focus][series[focus].length - 1][0];

  return (
    <figure>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full min-w-[540px]"
          role="img"
          aria-label={`Cumulative points of ${FACTION_BY_ID[focus].name} this season, against the other Banners`}
        >
          {Array.from(
            { length: Math.round(top / step) + 1 },
            (_, i) => i * step,
          ).map((v) => (
            <g key={v}>
              <line
                x1={pad.l}
                x2={pad.l + iw}
                y1={y(v)}
                y2={y(v)}
                stroke="rgba(230,216,184,0.08)"
              />
              <text
                x={pad.l - 8}
                y={y(v)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-parchment/45 font-mono text-[10px]"
              >
                {v.toLocaleString("en-US")}
              </text>
            </g>
          ))}
          {ticksT.map((d, i) =>
            i % everyN ? null : (
              <text
                key={d}
                x={x(d)}
                y={H - 8}
                textAnchor="middle"
                className="fill-parchment/40 font-mono text-[10px]"
              >
                {label(d)}
              </text>
            ),
          )}
          {order
            .filter((f) => f.id !== focus)
            .map((f) => (
              <path
                key={f.id}
                d={path(series[f.id])}
                fill="none"
                stroke={f.color}
                strokeOpacity={0.45}
                strokeWidth={1.4}
                strokeLinejoin="round"
              />
            ))}
          <path
            d={path(series[focus])}
            fill="none"
            stroke={FACTION_BY_ID[focus].color}
            strokeWidth={3}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <circle
            cx={x(lastT)}
            cy={y(acc[focus])}
            r={4}
            fill={FACTION_BY_ID[focus].color}
            stroke="#141210"
            strokeWidth={1.5}
          />
          {order.map((f) => {
            const ex = x(series[f.id][series[f.id].length - 1][0]) + 8;
            return (
              <text
                key={f.id}
                x={ex}
                y={labelY[f.id]}
                dominantBaseline="middle"
                className={
                  f.id === focus
                    ? "fill-gold text-[12px] font-semibold"
                    : "fill-parchment/50 text-[11px]"
                }
              >
                {f.name.replace(/^The /, "")}{" "}
                {acc[f.id].toLocaleString("en-US")}
              </text>
            );
          })}
        </svg>
      </div>
      <figcaption className="mt-1 text-xs text-parchment/45">
        Points added up hour by hour this season (UTC).{" "}
        {FACTION_BY_ID[focus].name} in colour, the other Banners faint.
      </figcaption>
    </figure>
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
