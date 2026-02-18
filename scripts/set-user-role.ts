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

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    throw new Error(`User not found: ${email}`);
  }

  const user = await prisma.user.update({
    where: { email },
    data: { role }
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
