import { describe, expect, it, vi } from 'vitest';
import { isPreviewHost, prototypePreviewEnabled } from '@/lib/preview-environment';
import { createStablePreviewSession, readPreviewSession, savePreviewSession } from '@/lib/preview-session';

describe('hosted prototype login isolation', () => {
  for (const host of ['id-preview--11e61e20-504a-41bf-909a-5fd340e381d7.lovable.app', 'id-preview-6--project.lovable.app', 'id-preview-abc123--project.lovable.app', 'preview--gym.workspace.lovable.app', 'project--project-dev.lovable.app']) {
    it(`recognizes built preview ${host}`, () => expect(isPreviewHost(host)).toBe(true));
  }
  for (const host of ['192.168.1.4', '10.0.0.12', '172.20.1.2']) {
    it(`recognizes private-network preview ${host}`, () => expect(isPreviewHost(host)).toBe(true));
  }
  for (const host of ['gyvora.lovable.app', 'project--project.lovable.app', 'gyvora.com', '8.8.8.8', '172.32.0.1', 'id-preview--project.example.com', 'id-preview--project.lovable.app.evil.test']) {
    it(`keeps published host ${host} on real authentication`, () => expect(isPreviewHost(host)).toBe(false));
  }
  it('reads stable fictional identities on a built hosted preview, not on a published host', async () => {
    vi.stubEnv('DEV', false);
    const location = vi.spyOn(window, 'location', 'get');
    location.mockReturnValue(new URL('https://id-preview--project.lovable.app') as unknown as Location);
    try {
      expect(prototypePreviewEnabled()).toBe(true);
      const first = await createStablePreviewSession('gym', 'Fictional', '+20 100 000 0123', 'arbitrary', true);
      const returning = await createStablePreviewSession('gym', 'Changed', '+201000000123', 'different', true);
      expect(returning.id).toBe(first.id);
      savePreviewSession(first);
      expect(readPreviewSession()?.id).toBe(first.id);
      location.mockReturnValue(new URL('https://gyvora.lovable.app') as unknown as Location);
      expect(prototypePreviewEnabled()).toBe(false);
      expect(readPreviewSession()).toBeNull();
    } finally {
      sessionStorage.clear();
      location.mockRestore();
      vi.unstubAllEnvs();
    }
  });
});