import { test } from "node:test";
import assert from "node:assert/strict";

process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-secret-for-local-validation-only";

const twoFactorModulePromise = import("@/lib/security/two-factor-session");

test("buildTwoFactorSessionMarker prefers jti", async () => {
  const { buildTwoFactorSessionMarker } = await twoFactorModulePromise;
  assert.equal(buildTwoFactorSessionMarker({ jti: "session-jti", iat: 12345 }), "session-jti");
});

test("buildTwoFactorSessionMarker falls back to iat", async () => {
  const { buildTwoFactorSessionMarker } = await twoFactorModulePromise;
  assert.equal(buildTwoFactorSessionMarker({ iat: 12345 }), "12345");
});

test("2FA session token validates for matching user+session marker", async () => {
  const { createTwoFactorSessionToken, isValidTwoFactorSessionToken } = await twoFactorModulePromise;
  const token = await createTwoFactorSessionToken("user-1", "marker-1", 60);
  const valid = await isValidTwoFactorSessionToken(token, "user-1", "marker-1");
  assert.equal(valid, true);
});

test("2FA session token fails for mismatched session marker", async () => {
  const { createTwoFactorSessionToken, isValidTwoFactorSessionToken } = await twoFactorModulePromise;
  const token = await createTwoFactorSessionToken("user-1", "marker-1", 60);
  const valid = await isValidTwoFactorSessionToken(token, "user-1", "marker-2");
  assert.equal(valid, false);
});

test("2FA session token fails for mismatched user", async () => {
  const { createTwoFactorSessionToken, isValidTwoFactorSessionToken } = await twoFactorModulePromise;
  const token = await createTwoFactorSessionToken("user-1", "marker-1", 60);
  const valid = await isValidTwoFactorSessionToken(token, "user-2", "marker-1");
  assert.equal(valid, false);
});
