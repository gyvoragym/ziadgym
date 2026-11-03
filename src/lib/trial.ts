/** One-hour pending-approval trial helpers. Times come from the server (owner_gate_state), never the client clock alone. */
export const TRIAL_MS = 60 * 60 * 1000;

export type OwnerGate = {
  deleted?: boolean;
  deletionNote?: string;
  gymId: string | null;
  frozen: boolean;
  freezeNote: string;
  decisionNote?: string;
  requestStatus: string | null;
  plan: string | null;
  gymName: string | null;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  now: string;
};

/**
 * Milliseconds of trial left, anchored to the server times returned with the gate.
 * `elapsedMs` is the time passed on the client since the gate was fetched, so a
 * refresh (which refetches fresh server times) can never extend the trial.
 */
export function trialRemainingMs(gate: Pick<OwnerGate, 'trialEndsAt' | 'now'>, elapsedMs = 0): number {
  if (!gate.trialEndsAt) return 0;
  const end = new Date(gate.trialEndsAt).getTime();
  const serverNow = new Date(gate.now).getTime();
  return Math.max(0, end - serverNow - Math.max(0, elapsedMs));
}

/** True while a pending request has a started, unexpired trial. */
export function trialActive(gate: Pick<OwnerGate, 'requestStatus' | 'trialStartedAt' | 'trialEndsAt' | 'now'>, elapsedMs = 0): boolean {
  return gate.requestStatus === 'Pending' && !!gate.trialStartedAt && trialRemainingMs(gate, elapsedMs) > 0;
}

/** True when a pending request's trial has run out. */
export function trialExpired(gate: Pick<OwnerGate, 'requestStatus' | 'trialStartedAt' | 'trialEndsAt' | 'now'>, elapsedMs = 0): boolean {
  return gate.requestStatus === 'Pending' && !!gate.trialStartedAt && trialRemainingMs(gate, elapsedMs) <= 0;
}

export function formatRemaining(ms: number): string {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
