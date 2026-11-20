import { randomUUID } from "node:crypto";
import type { OutboxItem } from "./db";
import { isMailConfigured, sendRecoveryCodeEmail } from "./mailer";
import { prisma } from "./prisma";

const MAX_ATTEMPTS = 5;
const BASE_DELAY_MS = 60_000;
const MAX_DELAY_MS = 6 * 60 * 60_000;
const INTERVAL_MS = 30_000;

type NewMail = Pick<
  OutboxItem,
  | "to"
  | "accountId"
  | "managerName"
  | "establishmentName"
  | "recoveryCode"
  | "kind"
>;

export function backoffMs(attempts: number): number {
  return Math.min(
    MAX_DELAY_MS,
    BASE_DELAY_MS * Math.pow(5, Math.max(0, attempts - 1)),
  );
}

/** Met un envoi en file : il partira immédiatement, puis sera repris si besoin. */
export async function enqueueRecoveryEmail(mail: NewMail): Promise<void> {
  const now = new Date();
  await prisma.outboxEmail.create({
    data: {
      id: randomUUID(),
      attempts: 0,
      nextAttemptAt: now,
      createdAt: now,
      to: mail.to,
      accountId: mail.accountId,
      managerName: mail.managerName,
      establishmentName: mail.establishmentName,
      recoveryCode: mail.recoveryCode,
      kind: mail.kind,
    },
  });
}

async function claimDue(now: number): Promise<OutboxItem[]> {
  const nowDate = new Date(now);
  return prisma.$transaction(async (tx) => {
    const due = await tx.outboxEmail.findMany({
      where: { nextAttemptAt: { lte: nowDate } },
    });

    const claimed: OutboxItem[] = [];
    for (const item of due) {
      const nextAttempts = item.attempts + 1;
      const nextAttemptDate = new Date(now + backoffMs(nextAttempts));
      await tx.outboxEmail.update({
        where: { id: item.id },
        data: {
          attempts: nextAttempts,
          nextAttemptAt: nextAttemptDate,
        },
      });
      claimed.push({
        id: item.id,
        to: item.to,
        accountId: item.accountId,
        managerName: item.managerName,
        establishmentName: item.establishmentName,
        recoveryCode: item.recoveryCode,
        kind: item.kind as "created" | "reset",
        attempts: nextAttempts,
        nextAttemptAt: nextAttemptDate.toISOString(),
        createdAt: item.createdAt.toISOString(),
        lastError: item.lastError ?? undefined,
      });
    }
    return claimed;
  });
}

async function settle(
  item: OutboxItem,
  result: { sent: boolean; reason?: string },
): Promise<void> {
  const current = await prisma.outboxEmail.findUnique({
    where: { id: item.id },
  });
  if (!current) return;

  if (result.sent) {
    await prisma.outboxEmail.deleteMany({ where: { id: item.id } });
    return;
  }

  const lastError = result.reason ?? "inconnu";
  if (current.attempts >= MAX_ATTEMPTS) {
    await prisma.outboxEmail.deleteMany({ where: { id: item.id } });
    console.warn(
      `Code de secours abandonné après ${current.attempts} tentatives (${lastError}).`,
    );
    return;
  }

  await prisma.outboxEmail.update({
    where: { id: item.id },
    data: { lastError },
  });
}

const shared = globalThis as typeof globalThis & {
  __keneOutboxRunning?: boolean;
  __keneOutboxTimer?: ReturnType<typeof setInterval>;
};

export async function processOutbox(): Promise<{
  attempted: number;
  sent: number;
}> {
  if (!isMailConfigured()) return { attempted: 0, sent: 0 };
  if (shared.__keneOutboxRunning) return { attempted: 0, sent: 0 };

  const now = Date.now();
  const pendingCount = await prisma.outboxEmail.count({
    where: { nextAttemptAt: { lte: new Date(now) } },
  });
  if (pendingCount === 0) {
    return { attempted: 0, sent: 0 };
  }

  shared.__keneOutboxRunning = true;
  try {
    const due = await claimDue(now);
    let sent = 0;
    for (const item of due) {
      const result = await sendRecoveryCodeEmail({
        accountId: item.accountId,
        email: item.to,
        managerName: item.managerName,
        establishmentName: item.establishmentName,
        recoveryCode: item.recoveryCode,
        kind: item.kind,
      });
      if (result.sent) sent += 1;
      await settle(item, result);
    }
    return { attempted: due.length, sent };
  } finally {
    shared.__keneOutboxRunning = false;
  }
}

export function startOutboxWorker() {
  if (shared.__keneOutboxTimer || !isMailConfigured()) return;
  shared.__keneOutboxTimer = setInterval(() => {
    void processOutbox();
  }, INTERVAL_MS);
  shared.__keneOutboxTimer.unref?.();
}

// Reprend les envois en attente dès qu'un module serveur est chargé.
startOutboxWorker();
