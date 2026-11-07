import { z } from 'zod';
export const clientDetailsSchema = z.object({
  name: z.string().trim().min(1, 'Client name is required').max(100),
  email: z.string().trim().email().max(255).transform(v => v.toLowerCase()),
  phone: z.string().trim().max(30),
  photo: z.string().max(1500000),
});
export function clientDeleteScope(gymId?: string) {
  return gymId ? 'gym' : 'account';
}
export function joinedProgramGyms<T extends {id: string}>(directory: T[], links: {gymId: string}[], memberships: {gymId: string}[]) {
  return directory.filter(g => links.some(l => l.gymId === g.id) || memberships.some(m => m.gymId === g.id));
}