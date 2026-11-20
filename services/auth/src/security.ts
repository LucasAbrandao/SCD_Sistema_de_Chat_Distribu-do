import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { SignJWT, jwtVerify } from 'jose';
const scrypt = promisify(derive);
export async function hashPassword(password: string, salt = randomBytes(16).toString('hex')) {
  return { salt, hash: ((await scrypt(password, salt, 64)) as Buffer).toString('hex') };
}
export async function checkPassword(password: string, salt: string, hash: string) {
  const result = await hashPassword(password, salt);
  return timingSafeEqual(Buffer.from(result.hash, 'hex'), Buffer.from(hash, 'hex'));
}
export const issuer = process.env.JWT_ISSUER ?? 'scd-auth';
export const audience = process.env.JWT_AUDIENCE ?? 'scd-chat';
export async function signToken(id: string, key: CryptoKey) {
  return new SignJWT({}).setProtectedHeader({ alg: 'RS256' }).setSubject(id).setIssuer(issuer).setAudience(audience).setIssuedAt().setExpirationTime('1h').sign(key);
}
export async function verifyToken(token: string, key: CryptoKey) {
  return (await jwtVerify(token, key, { algorithms: ['RS256'], issuer, audience, requiredClaims: ['sub', 'iat', 'exp'] })).payload;
}
