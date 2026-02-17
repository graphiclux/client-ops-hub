import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const [email, roleArg] = process.argv.slice(2);
  if (!email) {
    throw new Error("Usage: tsx scripts/set-user-role.ts user@example.com ADMIN");
  }

  const role = (roleArg || "ADMIN") as Role;

  if (!Object.values(Role).includes(role)) {
    throw new Error(`Invalid role: ${role}`);
  }

  const user = await prisma.user.upsert({
    where: { email },
    update: { role },
    create: { email, role, name: email }
  });

  console.log(`Set ${user.email} to role ${user.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
