"use client";

import Link from "next/link";
import { IconLogo, IconPhone } from "@/components/icons";

export default function OfflinePage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
          <IconLogo className="h-8 w-8 text-brand-500" />
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink-900">
          Vous êtes hors-ligne
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Kéné ne parvient pas à joindre le réseau pour actualiser les stocks. Si vous
          avez déjà ouvert l&apos;application, les dernières données enregistrées restent
          consultables.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-primary min-h-[48px] text-xs"
          >
            Réessayer
          </button>
          <Link href="/" className="btn-secondary min-h-[48px] text-xs">
            Ouvrir l&apos;app (cache)
          </Link>
        </div>

        <div className="mt-6 border-t border-slate-100 pt-5">
          <a
            href="tel:185"
            className="btn min-h-[48px] w-full bg-red-600 px-4 py-2.5 text-xs text-white hover:bg-red-700"
          >
            <IconPhone className="h-4 w-4" />
            Urgence vitale : appeler le SAMU 185
          </a>
        </div>
      </div>
    </main>
  );
}
