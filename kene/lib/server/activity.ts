import { randomUUID } from "node:crypto";
import type { ActivityItem } from "@/lib/types";
import { prisma } from "./prisma";

export async function logActivity(
  kind: ActivityItem["kind"],
  label: string,
): Promise<void> {
  await prisma.activityLog.create({
    data: {
      id: randomUUID(),
      at: new Date(),
      kind,
      label,
    },
  });
}
