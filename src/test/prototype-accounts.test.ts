import { beforeEach, describe, expect, it } from 'vitest';
import { authenticatePrototypeAccount, listPrototypeAccounts, registerPrototypeAccount } from '@/lib/prototype-accounts';

describe('isolated prototype registration', () => {
  beforeEach(() => localStorage.clear());

  it('creates a phone-first account and checks its password before login', async () => {
    const account = await registerPrototypeAccount({
      type: 'individual',
      name: 'Fictional Client',
      phone: '+20 10 0000 1234',
      email: '',
      password: 'fictional-pass',
    });

    expect(account).toMatchObject({
      type: 'individual',
      name: 'Fictional Client',
      phone: '+201000001234',
      email: '',
    });
    expect(account.passwordHash).not.toContain('fictional-pass');
    await expect(authenticatePrototypeAccount('individual', '+201000001234', 'fictional-pass')).resolves.toMatchObject({ id: account.id });
    await expect(authenticatePrototypeAccount('individual', '+201000001234', 'wrong-pass')).rejects.toThrow('Incorrect phone number or password');
    await expect(authenticatePrototypeAccount('gym', '+201000001234', 'fictional-pass')).rejects.toThrow('Incorrect phone number or password');
    expect(localStorage.getItem('gyvora-prototype-accounts-v1')).toBeNull();
    expect(Object.keys(localStorage).some(key => key.startsWith('gyvora-isolated-prototype:'))).toBe(true);
  });

  it('refuses duplicate phone accounts and exposes registered client details to the admin directory', async () => {
    const first = await registerPrototypeAccount({
      type: 'individual',
      name: 'Fictional Client',
      phone: '+201000001234',
      email: 'fictional@example.test',
      password: 'fictional-pass',
      photo: 'data:image/png;base64,AA==',
    });

    await expect(registerPrototypeAccount({
      type: 'individual',
      name: 'Duplicate',
      phone: '+20 100 000 1234',
      email: '',
      password: 'fictional-pass',
    })).rejects.toThrow('already exists');
    expect(listPrototypeAccounts()).toEqual([first]);
  });
});
