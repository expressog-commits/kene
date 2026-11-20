import { getAuth, publicSession } from "@/lib/server/auth";
import {
  ensureSeeded,
  getClaimedEstablishmentIds,
  getVisibleDemoAccounts,
  loadPublicState,
} from "@/lib/server/db";
import { jsonError, jsonOk } from "@/lib/server/http";
import { processOutbox } from "@/lib/server/outbox";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await ensureSeeded();
    void processOutbox();
    const auth = await getAuth();
    const [state, session, claimedEstablishmentIds] = await Promise.all([
      loadPublicState(auth),
      auth
        ? publicSession(auth.account, auth.session.createdAt)
        : Promise.resolve(null),
      getClaimedEstablishmentIds(),
    ]);

    return jsonOk({
      state,
      session,
      claimedEstablishmentIds,
      demoAccounts: getVisibleDemoAccounts(),
    });
  } catch {
    return jsonError("Données indisponibles.", 500);
  }
}
