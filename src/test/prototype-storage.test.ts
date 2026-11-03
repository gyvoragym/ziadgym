import { afterEach, describe, expect, it } from 'vitest';
import { clearPrototypeStorage, prototypeStorage } from '@/lib/prototype-storage';
import { createPreviewSession, savePreviewSession } from '@/lib/preview-session';
import { getDemoSessionInfo } from '@/lib/demo';

afterEach(() => {savePreviewSession(null);clearPrototypeStorage();localStorage.clear();});
describe('visual prototype isolation', () => {
  it('does not read or overwrite saved browser account data', () => {
    localStorage.setItem('ironhaus-demo-data-v1', 'existing account data');
    savePreviewSession(createPreviewSession('dashboard','Entered name','existing@example.test','sample password',true));
    expect(prototypeStorage().getItem('ironhaus-demo-data-v1')).toBeNull();
    prototypeStorage().setItem('ironhaus-demo-data-v1','fictional changes');
    expect(localStorage.getItem('ironhaus-demo-data-v1')).toBe('existing account data');
    expect(getDemoSessionInfo()).toEqual({kind:'super',email:'reviewer@example.test',name:'Prototype reviewer',directAccess:true});
  });
  it('keeps entered login details out of the prototype marker', () => {
    savePreviewSession(createPreviewSession('individual','Entered name','contact@example.test','sample password',true));
    const stored = sessionStorage.getItem('gyvora-isolated-preview-session') ?? '';
    expect(stored).not.toContain('Entered name');
    expect(stored).not.toContain('contact@example.test');
    expect(stored).not.toContain('sample password');
  });
});