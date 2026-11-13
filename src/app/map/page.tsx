import type { Metadata } from "next";
import MapClient from "@/components/map/MapClient";
import { MapLoader } from "@/components/map/MapLoader";

export const metadata: Metadata = {
  title: "The Map — $WERGILD",
  description: "Five Banners, one parchment. Every token has a price in blood.",
};

export default function MapPage() {
  return (
    <>
      <MapClient />
      <MapLoader />
    </>
  );
}
