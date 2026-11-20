import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  __kenePrisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.__kenePrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

globalForPrisma.__kenePrisma = prisma;
