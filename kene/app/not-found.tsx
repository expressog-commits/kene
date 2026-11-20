import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-sand px-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-card">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-lg font-semibold text-brand-700">
          404
        </span>
        <h1 className="mt-4 text-xl font-semibold tracking-tight text-ink-900">
          Cette page n&apos;existe pas
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">
          Le lien est peut-être incomplet. Revenez à l&apos;accueil ou ouvrez
          directement l&apos;application Kéné.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/" className="btn-secondary text-xs">
            Accueil
          </Link>
          <Link href="/app" className="btn-primary text-xs">
            Ouvrir Kéné
          </Link>
        </div>
      </div>
    </main>
  );
}
