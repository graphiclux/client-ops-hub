import * as OTPAuth from "otpauth";
import QRCode from "qrcode";

const issuer = "Client Ops Hub";

export function createTotpSecret(email: string) {
  const totp = new OTPAuth.TOTP({
    issuer,
    label: email,
    algorithm: "SHA1",
    digits: 6,
    period: 30,
    secret: new OTPAuth.Secret()
  });

  return {
    base32: totp.secret.base32,
    otpauthUrl: totp.toString()
  };
}

export async function createQrDataUrl(otpauthUrl: string) {
  return QRCode.toDataURL(otpauthUrl);
}

export function verifyTotpCode(secretBase32: string, code: string) {
  const totp = new OTPAuth.TOTP({
    issuer,
    secret: OTPAuth.Secret.fromBase32(secretBase32)
  });

  const delta = totp.validate({ token: code, window: 1 });
  return delta !== null;
}
