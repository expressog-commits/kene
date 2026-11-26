import { NextResponse } from "next/server";
import { FEATURES } from "@/lib/features";
import { ensureSeeded } from "@/lib/server/db";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

const HEALTH_HEADERS = { "Cache-Control": "no-store" };

export async function GET() {
  try {
    await ensureSeeded();
    const startedAt = performance.now();
    const [, pharmacies, medicines] = await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.pharmacy.count({ where: { verificationStatus: "verified" } }),
      prisma.medicine.count(),
    ]);
    const dbLatencyMs = Math.max(0, Math.round(performance.now() - startedAt));

    return NextResponse.json(
      {
        ok: true,
        version: "1.0.0",
        database: "ok",
        dbLatencyMs,
        counts: {
          pharmacies,
          medicines,
        },
        features: { hospitals: FEATURES.hospitals },
        timestamp: new Date().toISOString(),
      },
      { headers: HEALTH_HEADERS },
    );
  } catch {
    return NextResponse.json(
      { error: "Base de données indisponible." },
      { status: 503, headers: HEALTH_HEADERS },
    );
  }
}
