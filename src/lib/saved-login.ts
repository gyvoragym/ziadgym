export type LoginAccountType = 'gym' | 'individual' | 'dashboard';

/** Persisted roles, never the selector, determine administrator eligibility. */
export function matchesLoginType(selected: LoginAccountType, accountType: string, admin: boolean) {
  if (selected === 'dashboard') return admin;
  if (selected === 'gym') return accountType === 'owner' && !admin;
  return ['client', 'staff'].includes(accountType) && !admin;
}