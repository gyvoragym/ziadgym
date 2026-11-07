import { readPreviewSession } from './preview-session';
import { getDemoState } from './demo';
import { prototypePreviewEnabled } from './preview-environment';

export type SampleRequest = {
  id: string;
  gymName: string;
  plan: string;
  planId?: string;
  billingType?: 'Monthly' | 'Annual';
  durationDays?: number;
  price?: number;
  requestDate: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  decisionNote?: string;
  skipped: boolean;
  phone?: string;
  trialStartedAt?: number;
  trialExpiresAt?: number;
};
type RequestPlan = { id: string; name: string; billingType: 'Monthly' | 'Annual'; durationDays: number; price: number };
const key = 'gyvora-fictional-subscription-scenario';
const scopedKey = 'gyvora-fictional-subscription-contacts';
export const PROTOTYPE_TRIAL_MS = 60 * 60 * 1000;
function currentScope() { const session = readPreviewSession(); return session?.type === 'gym' ? session.scenarioKey : undefined; }
function readRegistry(): Record<string, SampleRequest> {
  try { return JSON.parse(localStorage.getItem(scopedKey) ?? '{}'); } catch { return {}; }
}
export function readSampleRequests() { return readRegistry(); }
export function makeSampleRequest(gymName: string, plan: string, skipped: boolean, date: string, plans: RequestPlan[]): SampleRequest {
  if (!gymName.trim()) throw new Error('Enter your gym name.');
  const selected = plans.find(candidate => candidate.id === plan || candidate.name === plan);
  if (!selected) throw new Error('Select an available subscription plan.');
  return {
    id:'prototype-subscription-request',
    gymName:gymName.trim().slice(0,100),
    plan:selected.name,
    planId:selected.id,
    billingType:selected.billingType,
    durationDays:selected.durationDays,
    price:selected.price,
    requestDate:date,
    status:'Pending',
    skipped,
  };
}
export function readSampleRequest(scope = currentScope()): SampleRequest | null {
  if (!prototypePreviewEnabled() || typeof window === 'undefined') return null;
  try {
    const row = scope ? readRegistry()[scope] : JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!row || row.id !== 'prototype-subscription-request' || typeof row.gymName !== 'string' || typeof row.plan !== 'string' || !row.plan.trim() || !['Pending','Approved','Rejected'].includes(row.status)) return null;
    const decision = getDemoState().requests.find(r => r.id === (scope ? `prototype-${scope}` : row.id));
    const gym = scope ? getDemoState().gyms.find(g => g.email === scope) : undefined;
    return decision ? {...row, gymName:gym?.name ?? decision.gymName, plan:gym?.plan ?? decision.plan, status: decision.status, decisionNote: decision.decisionNote} : row as SampleRequest;
  } catch {return null;}
}
export function saveSampleRequest(request: SampleRequest, scope = currentScope()) {
  const contact = readPreviewSession()?.contact;
  if (contact) request = {...request, phone: contact};
  if (!prototypePreviewEnabled()) throw new Error('Prototype scenario unavailable.');
  if (scope) localStorage.setItem(scopedKey, JSON.stringify({...readRegistry(), [scope]:request}));
  localStorage.setItem(key,JSON.stringify(request));
}
export function resetSampleRequest(scope = currentScope()) {
  if (typeof window === 'undefined') return;
  if (scope) { const registry = readRegistry(); delete registry[scope]; localStorage.setItem(scopedKey, JSON.stringify(registry)); }
  else localStorage.removeItem(scopedKey);
  localStorage.removeItem(key);
}
export function prototypeTrialActive(request: SampleRequest | null, now = Date.now()) {
  return request?.status === 'Pending' && !!request?.trialStartedAt && typeof request.trialExpiresAt === 'number' && now < request.trialExpiresAt;
}
export function startSampleTrial(request: SampleRequest, now = Date.now()): SampleRequest {
  if (request.status !== 'Pending') throw new Error('Only pending requests can start a prototype trial.');
  if (request.trialExpiresAt !== undefined) {
    if (!prototypeTrialActive(request, now)) throw new Error('Your trial period has ended. Your request is awaiting administrator approval.');
    return request;
  }
  return {...request, skipped:true, trialStartedAt:now, trialExpiresAt:now + PROTOTYPE_TRIAL_MS};
}
export function sampleEntryStep(request: SampleRequest | null): 0 | 2 { return request ? 2 : 0; }