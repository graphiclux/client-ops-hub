import { ClientPermission, Prisma, Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";

export function managerAccessRestricted() {
  return Boolean(env.MANAGER_RESTRICT_TO_ASSIGNED_CLIENTS);
}

export function buildClientAccessWhere(user: { id: string; role: Role }, write = false): Prisma.ClientWhereInput | undefined {
  const requiredPermission: ClientPermission | undefined = write ? "EDIT" : undefined;

  if (user.role === "ADMIN") return undefined;

  if (user.role === "MANAGER") {
    if (!managerAccessRestricted()) return undefined;
    return {
      OR: [
        { ownerUserId: user.id },
        {
          members: {
            some: {
              userId: user.id,
              ...(requiredPermission ? { permission: requiredPermission } : {})
            }
          }
        }
      ]
    };
  }

  if (user.role === "CONTRACTOR") {
    return {
      members: {
        some: {
          userId: user.id,
          ...(requiredPermission ? { permission: requiredPermission } : {})
        }
      }
    };
  }

  return undefined;
}

export async function canAccessClient(user: { id: string; role: Role }, clientId: string, write = false) {
  const requiredPermission: ClientPermission | undefined = write ? "EDIT" : undefined;

  if (user.role === "ADMIN") return true;

  if (user.role === "MANAGER") {
    if (!managerAccessRestricted()) return true;

    const managerMatch = await prisma.client.findFirst({
      where: {
        id: clientId,
        OR: [
          { ownerUserId: user.id },
          {
            members: {
              some: {
                userId: user.id,
                ...(requiredPermission ? { permission: requiredPermission } : {})
              }
            }
          }
        ]
      },
      select: { id: true }
    });

    return Boolean(managerMatch);
  }

  if (user.role === "READONLY") return !write;

  const membership = await prisma.clientUser.findFirst({
    where: {
      clientId,
      userId: user.id,
      ...(requiredPermission ? { permission: requiredPermission } : {})
    }
  });

  return Boolean(membership);
}
