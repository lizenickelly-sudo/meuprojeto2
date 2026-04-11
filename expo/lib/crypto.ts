import * as Crypto from 'expo-crypto';

const SALT_PREFIX = 'cashboxpix_v1_';

export async function hashPassword(password: string): Promise<string> {
  console.log('[Crypto] Hashing password...');
  const salted = SALT_PREFIX + password;
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salted
  );
  return digest;
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const newHash = await hashPassword(password);
  return newHash === hash;
}

export async function hashPin(pin: string): Promise<string> {
  const salted = SALT_PREFIX + 'pin_' + pin;
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    salted
  );
  return digest;
}

export async function verifyPin(pin: string, hash: string): Promise<boolean> {
  const newHash = await hashPin(pin);
  return newHash === hash;
}
