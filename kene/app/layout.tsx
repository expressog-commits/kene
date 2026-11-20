import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import PwaManager from "@/components/PwaManager";
import { FEATURES } from "@/lib/features";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: FEATURES.hospitals
    ? "Kéné — Pharmacies et lits d'urgences à Abidjan"
    : "Kéné — Pharmacies & disponibilité des médicaments à Abidjan",
  description: FEATURES.hospitals
    ? "Kéné montre quelles pharmacies vérifiées d'Abidjan ont votre médicament en stock, à quel prix, les officines de garde et les lits libres aux urgences."
    : "Kéné montre quelles pharmacies vérifiées d'Abidjan déclarent votre médicament en stock, à quel prix, et les officines de garde autour de vous.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Kéné",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B7E72",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr" className={sans.variable}>
      <body className="font-sans">
        {children}
        <PwaManager />
      </body>
    </html>
  );
}
