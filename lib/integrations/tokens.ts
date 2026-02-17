import { IntegrationProvider } from "@prisma/client";
import { prisma } from "@/lib/db";
import { refreshXeroToken } from "@/lib/integrations/xero";
import { decryptValue, encryptValue } from "@/lib/security/encryption";

type TokenInput = {
  userId: string;
  provider: IntegrationProvider;
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
  tenantId?: string;
};

export async function upsertIntegrationToken(input: TokenInput) {
  return prisma.integrationToken.upsert({
    where: {
      userId_provider: {
        userId: input.userId,
        provider: input.provider
      }
    },
    update: {
      accessTokenEncrypted: encryptValue(input.accessToken),
      refreshTokenEncrypted: input.refreshToken ? encryptValue(input.refreshToken) : null,
      expiresAt: input.expiresAt,
      scope: input.scope,
      tenantId: input.tenantId
    },
    create: {
      userId: input.userId,
      provider: input.provider,
      accessTokenEncrypted: encryptValue(input.accessToken),
      refreshTokenEncrypted: input.refreshToken ? encryptValue(input.refreshToken) : null,
      expiresAt: input.expiresAt,
      scope: input.scope,
      tenantId: input.tenantId
    }
  });
}

export async function getIntegrationToken(userId: string, provider: IntegrationProvider) {
  const token = await prisma.integrationToken.findUnique({
    where: {
      userId_provider: { userId, provider }
    }
  });

  if (!token) return null;

  return {
    ...token,
    accessToken: decryptValue(token.accessTokenEncrypted),
    refreshToken: token.refreshTokenEncrypted ? decryptValue(token.refreshTokenEncrypted) : null
  };
}

export async function getValidXeroToken(userId: string) {
  const token = await getIntegrationToken(userId, IntegrationProvider.XERO);
  if (!token) return null;

  const now = Date.now();
  const expiresAtMs = token.expiresAt ? new Date(token.expiresAt).getTime() : null;
  const isExpiringSoon = expiresAtMs !== null && expiresAtMs <= now + 2 * 60 * 1000;

  if (!isExpiringSoon) {
    return token;
  }

  if (!token.refreshToken) {
    return token;
  }

  const refreshed = await refreshXeroToken(token.refreshToken);
  const nextAccessToken = String(refreshed.access_token || "");
  const nextRefreshToken = String(refreshed.refresh_token || token.refreshToken);
  const expiresInSeconds = Number(refreshed.expires_in || 1800);
  const nextScope = (refreshed.scope as string | undefined) || token.scope || undefined;
  const nextExpiresAt = new Date(Date.now() + expiresInSeconds * 1000);

  await upsertIntegrationToken({
    userId,
    provider: IntegrationProvider.XERO,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    expiresAt: nextExpiresAt,
    scope: nextScope,
    tenantId: token.tenantId || undefined
  });

  return {
    ...token,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    expiresAt: nextExpiresAt,
    scope: nextScope
  };
}

export async function removeIntegrationToken(userId: string, provider: IntegrationProvider) {
  await prisma.integrationToken.deleteMany({
    where: { userId, provider }
  });
}
