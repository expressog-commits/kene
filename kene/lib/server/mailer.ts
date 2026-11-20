const DEFAULT_KNOCK_API_URL = "https://api.knock.app/v1";

interface RecoveryEmailInput {
  accountId: string;
  email: string;
  managerName: string;
  establishmentName: string;
  recoveryCode: string;
  kind: "created" | "reset";
}

export interface DeliveryResult {
  sent: boolean;
  reason?: string;
}

export function isMailConfigured(): boolean {
  return Boolean(process.env.KNOCK_API_KEY);
}

/**
 * Déclenche le workflow Knock « account-recovery-code ».
 * Best-effort : une panne d'email ne doit jamais faire échouer la création
 * de compte ou la récupération, le code restant affiché une fois à l'écran.
 */
export async function sendRecoveryCodeEmail(
  input: RecoveryEmailInput,
): Promise<DeliveryResult> {
  const apiKey = process.env.KNOCK_API_KEY;
  if (!apiKey) return { sent: false, reason: "not-configured" };

  const apiUrl = process.env.KNOCK_API_URL || DEFAULT_KNOCK_API_URL;
  const workflow =
    process.env.KNOCK_WORKFLOW_KEY || "account-recovery-code";
  const subject =
    input.kind === "created"
      ? "Votre code de secours Kéné"
      : "Votre nouveau code de secours Kéné";
  const intro =
    input.kind === "created"
      ? `Votre compte professionnel pour ${input.establishmentName} est créé.`
      : `Le code d'accès de ${input.establishmentName} a été réinitialisé.`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(
      `${apiUrl}/workflows/${encodeURIComponent(workflow)}/trigger`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          recipients: [
            {
              id: input.accountId,
              email: input.email,
              name: input.managerName,
            },
          ],
          data: {
            email_subject: subject,
            intro,
            recovery_code: input.recoveryCode,
            establishment_name: input.establishmentName,
            manager_name: input.managerName,
          },
        }),
        signal: controller.signal,
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return { sent: false, reason: `http-${response.status}` };
    }
    return { sent: true };
  } catch {
    return { sent: false, reason: "network" };
  } finally {
    clearTimeout(timeout);
  }
}
