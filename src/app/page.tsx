import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import HomeClient from "./HomeClient";

export const metadata: Metadata = {
  title: "$WERGILD — Every token has a price in blood",
  description:
    "A war of five Banners on an old parchment map. Hold $WERGILD to raise soldiers, swear to a Banner, conquer the map. Seasons of 14 days.",
};

export default function Home() {
  return (
    <PageShell>
      <HomeClient />
    </PageShell>
  );
}
