import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import JoinClient from "./JoinClient";

export const metadata: Metadata = {
  title: "Choose your Banner — $WERGILD",
  description: "Five Banners hang in the hall. Swear your oath to one of them.",
};

export default function JoinPage() {
  return (
    <PageShell>
      <JoinClient />
    </PageShell>
  );
}
