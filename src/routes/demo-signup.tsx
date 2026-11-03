import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/kit';
import { seo } from '@/lib/seo';
import { registerDemoAccount, setDemoSession, sessionKindFor, demoDestination } from '@/lib/demo';
import { AppBrand } from '@/components/AppBrand';
import { prototypePreviewEnabled } from '@/lib/preview-environment';

export const Route = createFileRoute('/demo-signup')({
  head: () => seo('Demo sign up', 'Create a fictional GYVORA demo account with a simulated phone code.'),
  component: DemoSignup,
});

/**
 * Demo-only phone/OTP registration. The "code" is simulated: any non-empty
 * value is accepted and no SMS is ever sent. Accounts are browser-local demo
 * accounts — this never touches real authentication.
 */
function DemoSignup() {
  const navigate = useNavigate();
  const isPrototypePreview = prototypePreviewEnabled();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isPrototypePreview) void navigate({ to: '/', replace: true });
  }, [isPrototypePreview, navigate]);

  function sendCode() {
    if (!phone.trim()) { setError('Enter a phone number first.'); return; }
    setError('');
    setCodeSent(true);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (!name.trim()) throw new Error('Enter your name.');
      if (!phone.trim()) throw new Error('Enter a phone number.');
      if (!codeSent) throw new Error('Send the demo code first.');
      if (!code.trim()) throw new Error('Enter the demo code. Any non-empty value works in demo mode.');
      if (password.length < 8) throw new Error('Password must be at least 8 characters.');
      const acc = registerDemoAccount(name.trim(), `phone:${phone.trim().toLowerCase()}`, password, 'individual', phone.trim());
      setDemoSession(sessionKindFor(acc.type), acc.email);
      await navigate({ to: demoDestination(acc) });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the demo account.');
    } finally {
      setBusy(false);
    }
  }

  if (isPrototypePreview) return null;

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm">
        <AppBrand large className="mb-8" />
        <h1 className="text-2xl font-semibold">Create a demo account</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demo only — the phone code is simulated and any non-empty code is accepted. No SMS is sent and no real account is created.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <Field label="Full Name"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={100} autoComplete="name" /></Field>
          <Field label="Phone Number">
            <div className="flex gap-2">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} type="tel" maxLength={30} placeholder="Fictional number" className="flex-1" />
              <Button type="button" variant="outline" onClick={sendCode}>{codeSent ? 'Resend' : 'Send code'}</Button>
            </div>
          </Field>
          {codeSent && (
            <Field label="Demo Code">
              <Input value={code} onChange={(e) => setCode(e.target.value)} maxLength={12} placeholder="Any value works in demo mode" autoComplete="off" />
            </Field>
          )}
          <Field label="Password"><Input value={password} onChange={(e) => setPassword(e.target.value)} type="password" minLength={8} maxLength={128} autoComplete="new-password" /></Field>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="h-11 w-full">{busy ? 'Creating…' : 'Create demo account'}</Button>
          <p className="text-sm text-muted-foreground">
            Want a real account? <Link to="/register" className="text-primary">Register with email</Link>
            {' · '}<Link to="/" className="text-primary">Back to sign in</Link>
          </p>
        </form>
      </div>
    </div>
  );
}
