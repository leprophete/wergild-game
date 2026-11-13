import type { Metadata, Viewport } from "next";
import { Cinzel, IM_Fell_English, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/wallet/Providers";
import { IlluminationDefs } from "@/components/IlluminatedInitial";

const cinzel = Cinzel({ subsets: ["latin"], weight: ["400", "600", "700"], variable: "--nf-cinzel" });
const fell = IM_Fell_English({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--nf-fell" });
const inter = Inter({ subsets: ["latin"], variable: "--nf-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--nf-mono" });

export const metadata: Metadata = {
  title: "$WERGILD",
  description: "Every token has a price in blood.",
};

export const viewport: Viewport = {
  themeColor: "#141210",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${cinzel.variable} ${fell.variable} ${inter.variable} ${mono.variable}`}>
      <body className="bg-charcoal font-sans text-parchment antialiased">
        <IlluminationDefs />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
