import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import MeClient from "./MeClient";

export const metadata: Metadata = { title: "My Shield — $WERGILD" };

export default function MePage() {
  return (
    <PageShell>
      <MeClient />
    </PageShell>
  );
}
