import { prototypeStorage } from './prototype-storage';
import { prototypeContactKey, type PreviewAccountType } from './preview-session';
import { normalizeContact } from './signup-verifier';
import { prototypePreviewEnabled } from './preview-environment';

export type PrototypeAccount = {
  id: string;
  type: Exclude<PreviewAccountType, 'dashboard'>;
  name: string;
  phone: string;
  email: string;
  photo: string;
  dob: string;
  gender: string;
  passwordSalt: string;
  passwordHash: string;
};

const accountsKey = 'gyvora-prototype-accounts-v1';

export async function prototypeAccountId(type: Exclude<PreviewAccountType, 'dashboard'>, phone: string) {
  const contactKey = await prototypeContactKey(normalizeContact('phone', phone));
  return `preview-${type}-${contactKey}`;
}

function readAccounts(): PrototypeAccount[] {
  const raw = prototypeStorage().getItem(accountsKey);
  if (!raw) return [];
  const accounts: unknown = JSON.parse(raw);
  if (!Array.isArray(accounts)) throw new Error('Prototype account data is invalid.');
  return accounts as PrototypeAccount[];
}

function randomSalt() {
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');
}

async function passwordHash(salt: string, password: string) {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const saltBytes = new Uint8Array(salt.match(/.{2}/g)?.map(value => Number.parseInt(value, 16)) ?? []);
  const bytes = await globalThis.crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 120000, hash: 'SHA-256' },
    key,
    256,
  );
  return Array.from(new Uint8Array(bytes), value => value.toString(16).padStart(2, '0')).join('');
}

function assertPrototypeMode() {
  if (!prototypePreviewEnabled()) throw new Error('Prototype accounts are unavailable on published sites.');
}

export async function registerPrototypeAccount(input: {
  type: Exclude<PreviewAccountType, 'dashboard'>;
  name: string;
  phone: string;
  email: string;
  password: string;
  photo?: string;
  dob?: string;
  gender?: string;
}) {
  assertPrototypeMode();
  const name = input.name.trim();
  const phone = normalizeContact('phone', input.phone);
  const email = input.email.trim().toLowerCase();
  if (!name) throw new Error('Enter your full name.');
  if (input.password.length < 8) throw new Error('Password must be at least 8 characters.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.');
  const id = await prototypeAccountId(input.type, phone);
  const accounts = readAccounts();
  if (accounts.some(account => account.id === id)) throw new Error('An account with this phone number already exists. Sign in instead.');
  const salt = randomSalt();
  const account: PrototypeAccount = {
    id,
    type: input.type,
    name,
    phone,
    email,
    photo: input.photo ?? '',
    dob: input.dob ?? '',
    gender: input.gender ?? '',
    passwordSalt: salt,
    passwordHash: await passwordHash(salt, input.password),
  };
  prototypeStorage().setItem(accountsKey, JSON.stringify([...accounts, account]));
  return account;
}

export async function authenticatePrototypeAccount(type: Exclude<PreviewAccountType, 'dashboard'>, contact: string, password: string) {
  assertPrototypeMode();
  const value = contact.trim();
  if (!value) throw new Error('Enter your phone number.');
  const accounts = readAccounts();
  const matches = value.includes('@')
    ? accounts.filter(account => account.type === type && account.email === value.toLowerCase())
    : accounts.filter(account => account.type === type && account.phone === normalizeContact('phone', value));
  if (matches.length > 1) throw new Error('More than one account matches. Sign in with your phone number.');
  const account = matches[0];
  if (!account || account.passwordHash !== await passwordHash(account.passwordSalt, password)) {
    throw new Error('Incorrect phone number or password, or this account has not been registered.');
  }
  return account;
}

export function listPrototypeAccounts() {
  assertPrototypeMode();
  return readAccounts();
}

export function updatePrototypeAccount(id: string, details: Partial<Pick<PrototypeAccount, 'name' | 'phone' | 'email' | 'photo'>>) {
  assertPrototypeMode();
  const accounts = readAccounts();
  const account = accounts.find(row => row.id === id);
  if (!account) return false;
  Object.assign(account, details);
  prototypeStorage().setItem(accountsKey, JSON.stringify(accounts));
  return true;
}

export function deletePrototypeAccount(id: string) {
  assertPrototypeMode();
  const accounts = readAccounts();
  const next = accounts.filter(account => account.id !== id);
  if (next.length === accounts.length) return false;
  prototypeStorage().setItem(accountsKey, JSON.stringify(next));
  return true;
}
