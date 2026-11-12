import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import RankingClient from "./RankingClient";

export const metadata: Metadata = { title: "The Ranking — $WERGILD" };

export default function RankingPage() {
  return (
    <PageShell>
      <RankingClient />
    </PageShell>
  );
}
