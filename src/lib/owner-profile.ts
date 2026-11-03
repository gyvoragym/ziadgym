import { prototypeStorage } from './prototype-storage';
import { z } from 'zod';
import { getDemoSessionInfo } from './demo';
export const ownerProfileSchema = z.object({ full_name: z.string().trim().min(1).max(100), phone: z.string().trim().max(30), email: z.union([z.string().trim().email().max(255), z.literal('')]), photo: z.string().max(7000000) });
export type OwnerProfile = z.infer<typeof ownerProfileSchema>;
function key() { const s = getDemoSessionInfo(); if (s?.kind !== 'owner') throw new Error('Gym owner account required'); return `ironhaus-owner-profile:${s.email.trim().toLowerCase() || 'anonymous'}`; }
export function readOwnerProfile(): OwnerProfile | null { try { return ownerProfileSchema.parse(JSON.parse(prototypeStorage().getItem(key()) ?? 'null')); } catch { return null; } }
export function saveOwnerProfile(profile: OwnerProfile) { prototypeStorage().setItem(key(), JSON.stringify(ownerProfileSchema.parse(profile))); }