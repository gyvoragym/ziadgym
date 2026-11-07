export type SubscriptionStep = 'selection' | 'sent' | 'status';
export function subscriptionEntryStep(request: {status:string} | null): SubscriptionStep {
  return request ? 'status' : 'selection';
}