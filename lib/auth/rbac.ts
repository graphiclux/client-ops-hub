import { Role } from "@prisma/client";

export const roleLevels: Record<Role, number> = {
  READONLY: 1,
  CONTRACTOR: 2,
  MANAGER: 3,
  ADMIN: 4
};

export function hasMinimumRole(userRole: Role, minRole: Role) {
  return roleLevels[userRole] >= roleLevels[minRole];
}

export const rolePermissions = {
  canWrite(role: Role) {
    return role === "ADMIN" || role === "MANAGER" || role === "CONTRACTOR";
  },
  canAdmin(role: Role) {
    return role === "ADMIN";
  }
};
