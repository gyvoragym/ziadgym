import { describe, expect, it, vi } from 'vitest';
import { createPreviewSession, previewEnabled, prototypeContactKey, verifyPreviewSignup } from '@/lib/preview-session';

describe('isolated preview account rules', () => {
  it('accepts non-empty arbitrary login values only in preview', () => {
    expect(createPreviewSession('gym','Fictional','anything','anything',true).type).toBe('gym');
    expect(() => createPreviewSession('gym','Fictional','anything','anything',false)).toThrow();
    expect(() => createPreviewSession('gym',' ','anything','anything',true)).toThrow();
  });
  for (const contact of ['owner@example.test', '+201000000123']) it(`accepts Gym login using ${contact} with the existing password field`, () => {
    expect(createPreviewSession('gym', 'Fictional owner', contact, 'existing-password', true).type).toBe('gym');
    expect(() => createPreviewSession('gym', 'Fictional owner', contact, '', true)).toThrow();
    expect(() => createPreviewSession('gym', 'Fictional owner', contact, 'existing-password', false)).toThrow();
  });
   it('allows only the administrator design, with no persisted identity or real role', () => {
     expect(createPreviewSession('dashboard','Fictional','anything','anything',true).type).toBe('dashboard');
     expect(() => createPreviewSession('admin','Fictional','anything','anything',true)).toThrow();
  });
  it('does not use entered contacts as identities or save passwords', () => {
    const a=createPreviewSession('individual','Fictional','existing@example.test','secret',true);
    const b=createPreviewSession('individual','Fictional','existing@example.test','secret',true);
    expect(a.id).not.toBe(b.id);
    expect(Object.keys(a).sort()).toEqual(['id','name','type']);
     expect(a.name).toBe('Prototype reviewer');
  });
  it('creates stable local prototype keys when Web Crypto is unavailable', async () => {
    vi.stubGlobal('crypto', undefined);
    try {
      expect(await prototypeContactKey('+20 10 1234 5678')).toBe(await prototypeContactKey('+201012345678'));
    } finally {
      vi.unstubAllGlobals();
    }
  });
  it('disables preview in production builds and runtimes', () => {
    expect(previewEnabled(false,'development')).toBe(false);
    expect(previewEnabled(true,'production')).toBe(false);
    expect(previewEnabled(true,'development')).toBe(true);
  });
  for (const channel of ['email','phone'] as const) it(`mock ${channel} signup accepts nonempty codes without a real account`, () => {
    const challenge={contact:'fictional',channel,expiresAt:200};
    expect(verifyPreviewSignup(challenge,'fictional','anything',true,100)).toEqual({preview:true});
    expect(()=>verifyPreviewSignup(challenge,'fictional',' ',true,100)).toThrow();
    expect(()=>verifyPreviewSignup(challenge,'fictional','anything',false,100)).toThrow();
    expect(()=>verifyPreviewSignup(challenge,'changed','anything',true,100)).toThrow();
    expect(()=>verifyPreviewSignup(challenge,'fictional','anything',true,200)).toThrow();
  });
});