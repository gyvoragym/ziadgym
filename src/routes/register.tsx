import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/kit';
import { seo } from '@/lib/seo';
import { AccountTypeSelector } from '@/components/AccountTypeSelector';
import { AppBrand } from '@/components/AppBrand';
import { supabase } from '@/integrations/supabase/client';
import { normalizeEgyptianMobile } from '@/lib/signup-verifier';
import { registrationSchema } from '@/lib/registration';
import { completeOAuthRegistration } from '@/lib/registration.functions';
import { resolveDestination } from '@/lib/post-login';
import { prototypePreviewEnabled } from '@/lib/preview-environment';
import { authBackendForRuntime } from '@/lib/auth-backend';
import { isSupabaseClientConfigured } from '@/lib/supabase-availability';

export const Route = createFileRoute('/register')({
  head: () => seo('Create account', 'Create a GYVORA Gym or Client account.'),
  component: Register,
});

const oauthRegistrationKey = 'gyvora-oauth-registration';

function registrationErrorMessage(error: unknown) {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'object' && error !== null) {
    if ('message' in error && typeof error.message === 'string') return error.message;
    if ('error_description' in error && typeof error.error_description === 'string') {
      return error.error_description;
    }
    if ('code' in error && typeof error.code === 'string') {
      return `Registration failed (${error.code}).`;
    }
  }
  return 'Registration failed. Please try again.';
}

function Register() {
  const navigate = useNavigate();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [accountType, setAccountType] = useState<'gym' | 'individual'>('gym');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [socialSession, setSocialSession] = useState(false);
  const [oauthIntent, setOauthIntent] = useState<'login' | 'register'>('register');
  const finishOAuth = useServerFn(completeOAuthRegistration);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('oauth') !== '1') return;
    let active = true;
    void (async () => {
      try {
        const { data, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;
        if (!data.user) throw new Error('The provider did not return a signed-in account. Please try again.');
        if (active) setSocialSession(true);

        const intent = sessionStorage.getItem('gyvora-oauth-intent') === 'login' ? 'login' : 'register';
        if (active) setOauthIntent(intent);
        const rawPending = sessionStorage.getItem(oauthRegistrationKey);
        const pending = rawPending
          ? JSON.parse(rawPending) as { accountType?: 'gym' | 'individual'; fullName?: string; phone?: string }
          : null;
        const { data: existingProfile, error: profileError } = await supabase
          .from('profiles')
          .select('account_type,full_name,phone')
          .eq('id', data.user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        const nextType = pending?.accountType === 'gym'
          ? 'gym'
          : pending?.accountType === 'individual'
            ? 'individual'
            : existingProfile?.account_type === 'owner' ? 'gym' : 'individual';
        const nextName = pending?.fullName
          ?? existingProfile?.full_name
          ?? String(data.user.user_metadata['full_name'] ?? data.user.user_metadata['name'] ?? '');
        const nextPhone = pending?.phone ?? data.user.phone ?? existingProfile?.phone ?? '';
        if (active) {
          setAccountType(nextType);
          setEmail(data.user.email ?? '');
          setPhone(nextPhone);
          if (nextName) {
            const nameInput = formRef.current?.elements.namedItem('full_name');
            if (nameInput instanceof HTMLInputElement) nameInput.value = nextName;
          }
        }

        if (!nextPhone) {
          if (active) setError('Enter your Egyptian mobile number to finish creating your account.');
          return;
        }

        const normalizedPhone = normalizeEgyptianMobile(nextPhone);
        await finishOAuth({
          data: {
            fullName: nextName || 'GYVORA user',
            phone: normalizedPhone,
            accountType: nextType,
          },
        });
        sessionStorage.removeItem(oauthRegistrationKey);
        sessionStorage.removeItem('gyvora-oauth-intent');
        if (intent === 'login') {
          window.location.assign(await resolveDestination());
        } else {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
          await navigate({ to: '/', search: { created: true } });
        }
        return;
      } catch (e) {
        if (active) {
          const message = e instanceof Error ? e.message : 'Could not continue with the provider account.';
          setError(message);
          toast.error(message);
        }
      }
    })();
    return () => { active = false; };
  }, [finishOAuth, navigate]);

  function changed() {
    setError('');
    setPhoneError('');
  }

  async function createAccount() {
    const form = formRef.current;
    if (!form) return;
    const values = new FormData(form);
    const registration = registrationSchema.safeParse({
      full_name: values.get('full_name'),
      phone,
      email,
      password: values.get('password'),
      account_type: accountType,
    });

    if (!registration.success) {
      const phoneIssue = registration.error.issues.find((issue) => issue.path.includes('phone'));
      if (phoneIssue) setPhoneError(phoneIssue.message);
      setError(registration.error.issues.find((issue) => !issue.path.includes('phone'))?.message ?? '');
      return;
    }

    setBusy(true);
    setError('');
    setPhoneError('');

    try {
      if (socialSession) {
        await finishOAuth({
          data: {
            fullName: registration.data.full_name,
            phone: registration.data.phone,
            accountType: registration.data.account_type,
          },
        });
        sessionStorage.removeItem(oauthRegistrationKey);
        sessionStorage.removeItem('gyvora-oauth-intent');
        if (oauthIntent === 'login') {
          window.location.assign(await resolveDestination());
        } else {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
          await navigate({ to: '/', search: { created: true } });
        }
        return;
      }

      if (authBackendForRuntime(prototypePreviewEnabled()) === 'supabase') {
        if (!isSupabaseClientConfigured()) {
          throw new Error(
            'Production sign-up is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the Vercel project.',
          );
        }

        const { data, error: signUpError } = await supabase.auth.signUp({
          email: registration.data.email,
          password: registration.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: registration.data.full_name,
              phone: registration.data.phone,
              account_type: registration.data.account_type === 'gym' ? 'owner' : 'client',
            },
          },
        });
        if (signUpError) {
          throw new Error('Could not create the account with those details. If you already have an account, sign in.');
        }
        if (data.user && data.user.identities?.length === 0) {
          throw new Error(
            'Could not create the account. If you already have one, sign in; otherwise check the details and try again.',
          );
        }

        const confirmationRequired = !data.session;
        if (data.session) {
          const { error: signOutError } = await supabase.auth.signOut();
          if (signOutError) throw signOutError;
        }
        form.reset();
        setEmail('');
        setPhone('');
        toast.success(
          confirmationRequired
            ? 'Account created. Check your Gmail for the confirmation link.'
            : 'Account created successfully. Sign in with your phone or Gmail and password.',
        );
        await navigate({
          to: '/',
          search: { created: true, confirmationRequired },
        });
        return;
      }

      const apiBase = (import.meta.env["VITE_GYVORA_API_URL"] || '').replace(/\/+$/, '');
      const response = await fetch(`${apiBase}/api/auth/register`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          fullName: registration.data.full_name,
          phone: registration.data.phone,
          email: registration.data.email || undefined,
          password: registration.data.password,
          accountType: registration.data.account_type,
        }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.headers.get('content-type')?.includes('application/json')) {
        throw new Error(
          import.meta.env["VITE_GYVORA_API_URL"]
            ? 'The configured GYVORA API did not return JSON. Check VITE_GYVORA_API_URL and confirm the API is running.'
            : 'The GYVORA API did not return JSON. For local setup, install server dependencies with npm --prefix server install, then run npm run dev. For a deployed app, configure VITE_GYVORA_API_URL to a running API.',
        );
      }
      if (!response.ok) throw new Error(result.error || 'Could not create account. Please try again.');
      form.reset();
      setEmail('');
      setPhone('');
      toast.success('Account created successfully. Sign in with your phone number and password.');
      await navigate({ to: '/', search: { created: true } });
    } catch (e) {
      const message = registrationErrorMessage(e);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(false);
    }
  }

  return <div className="flex min-h-screen items-center justify-center px-6 py-12"><div className="w-full max-w-lg">
    <AppBrand large className="mb-8"/>
    <h1 className="text-2xl font-semibold">Create your account</h1>
    <p role="status" className="mt-3 text-sm text-muted-foreground">
      Choose your account type, enter your phone and password, and create your account in a few seconds. No SMS or verification code is required.
    </p>
    <form ref={formRef} noValidate className="mt-6 grid gap-4 sm:grid-cols-2" onInput={e => {
      const values = new FormData(e.currentTarget);
      setFullName(String(values.get('full_name') ?? ''));
      setPhone(String(values.get('phone') ?? ''));
      setPassword(String(values.get('password') ?? ''));
    }} onSubmit={e => {e.preventDefault();void createAccount();}}>
      <div className="sm:col-span-2"><AccountTypeSelector value={accountType} onChange={value => {if(value==='dashboard')return;setAccountType(value);changed();}}/></div>
      <Field label="Full Name" className="sm:col-span-2"><Input name="full_name" required maxLength={100} autoComplete="name" onChange={e => {setFullName(e.target.value);changed();}}/></Field>
      <Field label="Gmail address *" className="sm:col-span-2"><Input name="email" type="email" value={email} onChange={e => {setEmail(e.target.value);changed();}} autoComplete="email" required/><span className="text-xs text-muted-foreground">Required for account sign-in and recovery.</span></Field>
      <Field label="Phone Number *" className="sm:col-span-2"><div className="flex gap-2"><Input name="phone" type="tel" value={phone} onChange={e => {setPhone(e.target.value);changed();}} autoComplete="tel" placeholder="01012345678 or +201012345678" aria-invalid={!!phoneError} aria-label="Phone Number" required/></div></Field>
      {phoneError && <p role="alert" className="-mt-2 text-sm text-destructive sm:col-span-2">{phoneError}</p>}
      <Field label="Password" className="sm:col-span-2"><Input name="password" type="password" required minLength={4} maxLength={128} autoComplete="new-password" onChange={e => {setPassword(e.target.value);changed();}}/><span className="text-xs text-muted-foreground">At least 4 characters.</span></Field>
      {accountType === 'individual' && <><Field label="Date of birth"><Input name="dob" type="date" /></Field><Field label="Gender"><select name="gender" className="h-10 w-full rounded-md border bg-card px-3"><option value="">Not specified</option><option>Male</option><option>Female</option></select></Field></>}
      {error && <p role="alert" className="text-sm text-destructive sm:col-span-2">{error}</p>}
      <Button type="submit" disabled={busy || !fullName.trim() || !phone.trim() || !email.trim() || password.length < 8} className="sm:col-span-2">
        {busy ? 'Creating account…' : 'Create account'}
      </Button>
      <p className="text-sm text-muted-foreground sm:col-span-2">Already have an account? <Link to="/" className="text-primary">Sign in</Link></p>
    </form>
  </div></div>;
}
