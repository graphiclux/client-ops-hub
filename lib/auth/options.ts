import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { Role } from "@prisma/client";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/db";
import { createAuditLog } from "@/lib/security/audit";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        const email = credentials?.email?.toLowerCase().trim();
        const password = credentials?.password;

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            passwordHash: true
          }
        });

        if (!user?.passwordHash) {
          return null;
        }

        const valid = await compare(password, user.passwordHash);
        if (!valid) {
          return null;
        }

        return {
          id: user.id,
          name: user.name,
          email: user.email
        };
      }
    })
  ],
  callbacks: {
    async jwt({ token }) {
      if (!token.email) return token;

      const user = await prisma.user.findUnique({
        where: { email: token.email },
        select: { id: true, role: true, totpEnabled: true, isServiceAccount: true }
      });

      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.totpEnabled = user.totpEnabled;
        token.isServiceAccount = user.isServiceAccount;
      }

      return token;
    },
    async session({ session, token }) {
      if (!session.user || !token.userId || !token.role) {
        return session;
      }

      session.user.id = token.userId as string;
      session.user.role = token.role as Role;
      session.user.totpEnabled = Boolean(token.totpEnabled);
      session.user.isServiceAccount = Boolean(token.isServiceAccount);
      return session;
    }
  },
  events: {
    async signIn({ user }) {
      await createAuditLog({
        userId: user.id,
        action: "AUTH_LOGIN",
        entityType: "User",
        entityId: user.id ?? null
      });
    },
    async signOut({ token }) {
      await createAuditLog({
        userId: (token?.userId as string | undefined) ?? null,
        action: "AUTH_LOGOUT",
        entityType: "User",
        entityId: (token?.userId as string | undefined) ?? null
      });
    }
  }
};

export function auth() {
  return getServerSession(authOptions);
}
