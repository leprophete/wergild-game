export interface AdminState {
  wallet: string;
  seasons: {
    id: number;
    number: number;
    name: string;
    startsAt: number;
    endsAt: number;
    status: "scheduled" | "active" | "ended";
    winner: string | null;
  }[];
  events: {
    id: number;
    seasonNumber: number;
    type: "tithe" | "plague" | "rush";
    zone: { x: number; y: number; w: number; h: number } | null;
    announcedAt: number;
    startsAt: number;
    endsAt: number;
    appliedAt: number | null;
  }[];
  excluded: { wallet: string; faction: string | null }[];
  params: { label: string; value: string }[];
}
