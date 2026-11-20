import { FEATURES } from "@/lib/features";
import { jsonError, jsonOk } from "@/lib/server/http";
import { prisma } from "@/lib/server/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return jsonOk({
      ok: true,
      database: "ok",
      features: { hospitals: FEATURES.hospitals },
      timestamp: new Date().toISOString(),
    });
  } catch {
    return jsonError("Base de données indisponible.", 503);
  }
}
