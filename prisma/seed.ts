import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL;

  if (!adminEmail) {
    console.log("INITIAL_ADMIN_EMAIL not set, skipping admin seed");
    return;
  }

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: Role.ADMIN },
    create: {
      email: adminEmail,
      name: "Initial Admin",
      role: Role.ADMIN
    }
  });

  console.log(`Ensured admin user exists: ${adminEmail}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
