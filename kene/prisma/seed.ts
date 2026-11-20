import { resetDatabase } from "../lib/server/db";
import { prisma } from "../lib/server/prisma";

async function main() {
  await resetDatabase();
  console.log("Base de données Kéné initialisée avec les données de démonstration.");
}

main()
  .catch((error) => {
    console.error("Échec du seed Prisma :", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
