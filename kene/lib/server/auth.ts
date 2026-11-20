import { cookies } from "next/headers";
import type { SessionInfo } from "@/lib/types";
import { createSessionToken, hashToken } from "./crypto";
import {
  mapAccountRecord,
  type AccountRecord,
  type SessionRecord,
} from "./db";
import { prisma } from "./prisma";

export const SESSION_COOKIE = "kene_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

export async function createSession(accountId: string): Promise<string> {
  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { expiresAt: { lte: now } } }),
    prisma.session.create({
      data: {
        tokenHash: hashToken(token),
        accountId,
        createdAt: now,
        expiresAt,
      },
    }),
  ]);

  return token;
}

export function setSessionCookie(token: string) {
  cookies().set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export function clearSessionCookie() {
  cookies().set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

export async function getAuth(): Promise<{
  account: AccountRecord;
  session: SessionRecord;
} | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const row = await prisma.session.findUnique({
    where: { tokenHash },
    include: { account: true },
  });

  if (!row || row.expiresAt.getTime() <= Date.now()) {
    return null;
  }

  return {
    account: mapAccountRecord(row.account),
    session: {
      tokenHash: row.tokenHash,
      accountId: row.accountId,
      createdAt: row.createdAt.toISOString(),
      expiresAt: row.expiresAt.toISOString(),
    },
  };
}

export async function revokeSession(): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return;
  const tokenHash = hashToken(token);
  await prisma.session.deleteMany({ where: { tokenHash } });
}

export async function revokeOtherSessions(accountId: string): Promise<void> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  const keep = token ? hashToken(token) : "";
  await prisma.session.deleteMany({
    where: keep
      ? { accountId, tokenHash: { not: keep } }
      : { accountId },
  });
}

export async function revokeAllSessions(accountId: string): Promise<void> {
  await prisma.session.deleteMany({ where: { accountId } });
}

export async function establishmentName(
  account: Pick<AccountRecord, "type" | "establishmentId">,
): Promise<string> {
  if (account.type === "admin") {
    return "Plateforme Kéné";
  }
  if (account.type === "pharmacy") {
    const pharmacy = await prisma.pharmacy.findUnique({
      where: { id: account.establishmentId },
      select: { name: true },
    });
    return pharmacy?.name ?? "Pharmacie";
  }
  const hospital = await prisma.hospital.findUnique({
    where: { id: account.establishmentId },
    select: { name: true },
  });
  return hospital?.name ?? "Hôpital";
}

export async function publicSession(
  account: AccountRecord,
  signedInAt: string,
): Promise<SessionInfo> {
  return {
    accountId: account.id,
    type: account.type,
    establishmentId: account.establishmentId,
    managerName: account.managerName,
    email: account.email,
    role: account.role,
    establishmentName: await establishmentName(account),
    signedInAt,
  };
}
