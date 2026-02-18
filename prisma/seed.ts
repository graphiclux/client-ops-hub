import { PrismaClient, Role } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log("INITIAL_ADMIN_EMAIL or INITIAL_ADMIN_PASSWORD not set, skipping admin seed");
    return;
  }

  if (adminPassword.length < 12) {
    throw new Error("INITIAL_ADMIN_PASSWORD must be at least 12 characters");
  }

  const passwordHash = await hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.ADMIN, passwordHash },
    create: {
      email: adminEmail,
      name: "Initial Admin",
      role: Role.ADMIN,
      passwordHash
    }
  });

  console.log(`Ensured admin user exists with password auth: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
