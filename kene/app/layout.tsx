import type { Metadata, Viewport } from "next";
import PwaManager from "@/components/PwaManager";
import { FEATURES } from "@/lib/features";
import "./globals.css";

const APP_TITLE = FEATURES.hospitals
  ? "Kéné — Pharmacies et lits d'urgences à Abidjan"
  : "Kéné — Pharmacies & disponibilité des médicaments à Abidjan";

const APP_DESCRIPTION = FEATURES.hospitals
  ? "Kéné montre quelles pharmacies vérifiées d'Abidjan ont votre médicament en stock, à quel prix, les officines de garde et les lits libres aux urgences."
  : "Kéné montre quelles pharmacies vérifiées d'Abidjan déclarent votre médicament en stock, à quel prix, et les officines de garde autour de vous.";

export const metadata: Metadata = {
  title: APP_TITLE,
  description: APP_DESCRIPTION,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg",
  },
  openGraph: {
    title: APP_TITLE,
    description: APP_DESCRIPTION,
    locale: "fr_CI",
    type: "website",
    siteName: "Kéné",
  },
  appleWebApp: {
    capable: true,
    title: "Kéné",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#045D56",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap"
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

