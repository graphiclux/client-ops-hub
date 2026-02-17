import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { Role } from "@prisma/client";
import { prisma } from "@/lib/db";
import { allowedGoogleDomains } from "@/lib/env";
import { createAuditLog } from "@/lib/security/audit";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt"
  },
  pages: {
    signIn: "/login"
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || ""
    })
  ],
  callbacks: {
    async signIn({ account, profile }) {
      const email = profile?.email?.toLowerCase();
      if (!email) return false;

      const domain = email.split("@")[1]?.toLowerCase();
      if (!domain || !allowedGoogleDomains.includes(domain)) {
        return false;
      }

      await prisma.user.upsert({
        where: { email },
        update: {
          name: profile?.name ?? undefined,
          googleSub: account?.providerAccountId
        },
        create: {
          email,
          name: profile?.name,
          googleSub: account?.providerAccountId,
          role: Role.READONLY
        }
      });

      return true;
    },
    async jwt({ token }) {
      if (!token.email) return token;

      const user = await prisma.user.findUnique({
        where: { email: token.email },
        select: { id: true, role: true, totpEnabled: true }
      });

      if (user) {
        token.userId = user.id;
        token.role = user.role;
        token.totpEnabled = user.totpEnabled;
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
