import type { Metadata } from "next";
import PageShell from "@/components/PageShell";
import AdminClient from "./AdminClient";

export const metadata: Metadata = { title: "Admin — $WERGILD", robots: { index: false } };

export default function AdminPage() {
  return (
    <PageShell>
      <AdminClient />
    </PageShell>
  );
}
