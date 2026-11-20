import { NextResponse } from "next/server";
import type { ZodType } from "zod";

export const NO_STORE = { "Cache-Control": "no-store" };

export function jsonOk(data: unknown) {
  return NextResponse.json(data, { headers: NO_STORE });
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status, headers: NO_STORE });
}

/** Refuse les mutations cross-origin (protection CSRF complémentaire à SameSite). */
export function isSameOrigin(request: Request): boolean {
  const host = request.headers.get("host");
  const forwardedHost = request.headers
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim();
  const allowedHosts = new Set(
    [host, forwardedHost].filter((value): value is string => Boolean(value)),
  );

  const origin = request.headers.get("origin");
  if (origin) {
    if (allowedHosts.size === 0) return false;
    try {
      return allowedHosts.has(new URL(origin).host);
    } catch {
      return false;
    }
  }

  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") {
    return false;
  }

  const referer = request.headers.get("referer");
  if (referer) {
    if (allowedHosts.size === 0) return false;
    try {
      return allowedHosts.has(new URL(referer).host);
    } catch {
      return false;
    }
  }

  return true;
}

export async function readJson(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const data = await request.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return data as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseZod<T>(
  schema: ZodType<T>,
  data: unknown,
): { success: true; data: T } | { success: false; error: string } {
  const parsed = schema.safeParse(data);
  if (parsed.success) return { success: true, data: parsed.data };
  return {
    success: false,
    error: parsed.error.issues[0]?.message ?? "Requête invalide.",
  };
}

export function rawTrimmed(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function integer(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

export function isValidEmail(value: string): boolean {
  return value.length <= 160 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function clientKey(request: Request, suffix = ""): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0]?.trim() || "local";
  return `${ip}:${suffix}`;
}
