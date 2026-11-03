import { generateId } from './utils';
import { prototypePreviewEnabled } from './preview-environment';

export type PreviewAccountType = 'gym' | 'individual' | 'dashboard';
export type PreviewSession = { id: string; type: PreviewAccountType; name: string; scenarioKey?: string; contact?: string; email?: string; photo?: string; dob?: string; gender?: string; gyvoraId?: string; adminToken?: string };
const key = 'gyvora-isolated-preview-session';

export function previewEnabled(developmentBuild: boolean, runtimeMode?: string) {
  return developmentBuild && runtimeMode !== 'production';
}

// A prototype-only digest groups fictional requests, never authenticates an account.
export async function prototypeContactKey(contact: string) {
  const normalized = contact.includes('@') ? contact.trim().toLowerCase() : contact.trim().replace(/[\s()+.-]/g, '');
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(normalized));
    return `fictional-${Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('')}`;
  }
  let hash = 14695981039346656037n;
  for (const byte of new TextEncoder().encode(normalized)) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 1099511628211n);
  }
  return `prototype-${hash.toString(16).padStart(16, '0')}`;
}

export function createPreviewSession(type: string, name: string, identifier: string, password: string, enabled: boolean): PreviewSession {
  if (!enabled) throw new Error('Preview login is unavailable.');
  if (!['gym', 'individual', 'dashboard'].includes(type)) throw new Error('Choose a prototype account type.');
  if (![name, identifier, password].every(value => value.trim())) throw new Error('Enter your name, email or phone, and password.');
  return { id: `preview-${generateId()}`, type: type as PreviewAccountType, name: 'Prototype reviewer' };
}

export async function createStablePreviewSession(type: PreviewAccountType, name: string, identifier: string, password: string, enabled: boolean) {
  const session = createPreviewSession(type, name, identifier, password, enabled);
  if (type === 'dashboard') {
    return { ...session, id: 'preview-dashboard-platform-admin', name: name.trim(), scenarioKey: 'platform-admin' };
  }
  const scenarioKey = await prototypeContactKey(identifier);
  return {...session, id: `preview-${type}-${scenarioKey}`, name: name.trim(), scenarioKey, contact: identifier.trim().slice(0, 40)};
}

export function readPreviewSession(): PreviewSession | null {
  if (!prototypePreviewEnabled() || typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    return value?.id?.startsWith('preview-') && ['gym', 'individual', 'dashboard'].includes(value.type) && typeof value.name === 'string' ? value : null;
  } catch { return null; }
}

export function savePreviewSession(session: PreviewSession | null) {
  if (session && prototypePreviewEnabled()) sessionStorage.setItem(key, JSON.stringify(session));
  else sessionStorage.removeItem(key);
}

export type PreviewChallenge = { contact: string; channel: 'email' | 'phone'; expiresAt: number };
export function verifyPreviewSignup(challenge: PreviewChallenge | null, contact: string, code: string, enabled: boolean, now = Date.now()) {
  if (!enabled) throw new Error('Preview verification is unavailable.');
  if (!challenge || challenge.expiresAt <= now || challenge.contact !== contact.trim()) throw new Error('Send a new code for this contact.');
  if (!code.trim()) throw new Error('Enter the verification code.');
  return { preview: true as const };
}