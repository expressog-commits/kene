import type { Metadata, Viewport } from "next";
import PwaManager from "@/components/PwaManager";
import { FEATURES } from "@/lib/features";
import "./globals.css";

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
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans">
        {children}
        <PwaManager />
      </body>
    </html>
  );
}

