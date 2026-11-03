import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/kit';
import { seo } from '@/lib/seo';
import { getDemoAccounts, updateDemoAccount } from '@/lib/demo';
import { AppBrand } from '@/components/AppBrand';

export const Route = createFileRoute('/demo-recovery')({
  head: () => seo('Demo password recovery', 'Reset a fictional GYVORA demo account password with a simulated code.'),
  component: DemoRecovery,
});

/**
 * Demo-only password recovery. The "code" is simulated: any non-empty value
 * is accepted and nothing is sent. It only resets browser-local demo account
 * passwords — real accounts use email reset from the client sign-in page.
 */
function DemoRecovery() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function sendCode() {
    if (!identifier.trim()) { setError('Enter your demo email or phone first.'); return; }
    setError('');
    setCodeSent(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const id = identifier.trim().toLowerCase();
      if (!id) throw new Error('Enter your demo email or phone.');
      if (!codeSent) throw new Error('Send the demo code first.');
      if (!code.trim()) throw new Error('Enter the demo code. Any non-empty value works in demo mode.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      const acc = getDemoAccounts().find((a) => a.email === id || a.email === `phone:${id}` || a.phone === id);
      if (!acc) throw new Error('No demo account matches that email or phone on this browser.');
      updateDemoAccount(acc.email, { password });
      await navigate({ to: '/' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset the demo password.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <AppBrand large className="mb-8" />
        <h1 className="text-2xl font-semibold">Recover a demo password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demo only — the code is simulated and any non-empty code is accepted. This resets browser-local demo accounts, never real accounts.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <Field label="Demo Email or Phone">
            <div className="flex gap-2">
              <Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} maxLength={255} className="flex-1" />
              <Button type="button" variant="outline" onClick={sendCode}>{codeSent ? 'Resend' : 'Send code'}</Button>
            </div>
          </Field>
          {codeSent && (
            <Field label="Demo Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} placeholder="Any value works in demo mode" autoComplete="off" />
            </Field>
          )}
          <Field label="New Password"><Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} maxLength={128} autoComplete="new-password" /></Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? 'Resetting…' : 'Reset demo password'}</Button>
          <p className="text-sm text-muted-foreground"><Link to="/" className="text-primary">Back to sign in</Link></p>
        </form>
      </div>
    </div>
  );
}
