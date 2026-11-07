import { createFileRoute, Link, useNavigate, useHydrated, useRouter } from "@tanstack/react-router";
import { useCloud } from "@/components/CloudProvider";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { seo } from "@/lib/seo";
import { createStablePreviewSession, savePreviewSession, type PreviewAccountType } from '@/lib/preview-session';
import { readSampleRequest, prototypeTrialActive } from '@/lib/prototype-scenario';
import { resetPrototypeData, setDemoSession, useDemoStore } from "@/lib/demo";
import { clearPrototypeStorage } from '@/lib/prototype-storage';
import cover from "@/assets/gyvora-login-hero.jpg";
import { AppBrand } from '@/components/AppBrand';
import { supabase } from '@/integrations/supabase/client';
import { resolveDestination } from '@/lib/post-login';
import { prototypePreviewEnabled } from '@/lib/preview-environment';
import { getPrototypePreference, savePrototypePreference } from '@/lib/prototype-login';
import { DEFAULT_PLATFORM_WHATSAPP, whatsappLink } from '@/lib/demo';
import { verifyPlatformAdminLogin } from '@/lib/admin-auth.functions';
import { useServerFn } from '@tanstack/react-start';
import { normalizeEgyptianMobile } from '@/lib/signup-verifier';
import { isSupabaseClientConfigured } from '@/lib/supabase-availability';
import { authBackendForRuntime } from '@/lib/auth-backend';
import { signInWithPhonePassword } from '@/lib/registration.functions';
import { usePlatformSettings } from '@/lib/platform-settings';

export const Route = createFileRoute("/")({
  head: () => ({meta: [...seo("GYVORA workspace", "Open a Gym or Client prototype workspace.").meta, {property:"og:image",content:cover},{name:"twitter:image",content:cover}]}),
  validateSearch: (search: Record<string, unknown>): { created?: boolean; confirmationRequired?: boolean } => ({
    created: search["created"] === true || search["created"] === "true",
    confirmationRequired: search["confirmationRequired"] === true || search["confirmationRequired"] === "true",
  }),
  component: Login,
});

/** Decorative WhatsApp glyph. Visual label only: no link, no button, no click action. */
function WhatsAppGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 fill-current" aria-hidden="true" focusable="false">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}


function Login() {
  const [destination, setDestination] = useState<PreviewAccountType>("gym");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [adminMode, setAdminMode] = useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const navigate = useNavigate();
  const cloud = useCloud();
  const platformWhatsapp = useDemoStore((state) => state.platformWhatsapp);
  const platformBranding = useDemoStore((state) => state.platformBranding);
  const { data: cloudPlatformSettings } = usePlatformSettings();
  const hydrated = useHydrated();
  const router = useRouter();
  const { created, confirmationRequired } = Route.useSearch();
  const verifyAdmin = useServerFn(verifyPlatformAdminLogin);
  const phoneSignIn = useServerFn(signInWithPhonePassword);
  const previewMode = hydrated && prototypePreviewEnabled();
  const demoAdminMode = previewMode && adminMode;

  useEffect(() => {
    const draftRaw = sessionStorage.getItem('gyvora-prototype-signup-draft');
    if (draftRaw) {
      try {
        const draft = JSON.parse(draftRaw) as { destination?: PreviewAccountType; name?: string; email?: string; phone?: string };
        if (draft.destination === 'gym' || draft.destination === 'individual') setDestination(draft.destination);
        if (typeof draft.name === 'string') setName(draft.name);
        if (typeof draft.email === 'string') setEmail(draft.email);
        if (typeof draft.phone === 'string') setPhone(draft.phone);
      } catch {
        setError('Could not load the prototype signup details. Enter any details to continue.');
      } finally {
        sessionStorage.removeItem('gyvora-prototype-signup-draft');
      }
      return;
    }
    const preference = getPrototypePreference();
    if (!preference) return;
    setDestination(preference.destination === 'dashboard' ? 'gym' : preference.destination);
    setName(preference.name);
    setRemember(true);
    if (preference.email.includes("@")) setEmail(preference.email);
    else setPhone(preference.email);
  }, []);

  async function signIn(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const contact = phone.trim() || email.trim();
    setBusy(true);
    try {
      const shouldCheckAdmin = prototypePreviewEnabled() && contact !== '' && password !== '';
      if (shouldCheckAdmin) {
        const adminToken = await verifyAdmin({
          data: adminMode
            ? { name, email, phone, password }
            : { contacts: [phone.trim(), email.trim()].filter(Boolean), password },
        });
        if (adminToken) {
          const accountSession = {
            ...(await createStablePreviewSession(
              'dashboard',
              name.trim() || 'GYVORA Administrator',
              contact,
              password,
              true,
            )),
            adminToken,
          };
          await router.options.context.queryClient.cancelQueries();
          router.options.context.queryClient.clear();
          savePreviewSession(accountSession);
          resetPrototypeData();
          savePrototypePreference({ destination: 'gym', name: name.trim(), email: contact }, false);
          await cloud.refresh();
          setName(''); setEmail(''); setPhone(''); setPassword('');
          await navigate({ to: '/super-admin' });
          return;
        }
        if (adminMode) {
          throw new Error('Administrator verification failed. Check all administrator details.');
        }
      }
      if (contact && password) {
        const apiBase = (import.meta.env["VITE_GYVORA_API_URL"] || '').replace(/\/+$/, '');
        if (authBackendForRuntime(prototypePreviewEnabled()) === 'supabase') {
          if (!isSupabaseClientConfigured()) {
            throw new Error(
              'Production sign-in is not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the Vercel project.',
            );
          }
          await router.options.context.queryClient.cancelQueries();
          router.options.context.queryClient.clear();
          setDemoSession(null);
          savePreviewSession(null);
          clearPrototypeStorage();
          resetPrototypeData();
          let authError: Error | null = null;
          if (contact.includes('@')) {
            const { error } = await supabase.auth.signInWithPassword({
              email: contact.trim().toLowerCase(),
              password,
            });
            authError = error;
          } else {
            try {
              const { session } = await phoneSignIn({
                data: { phone: normalizeEgyptianMobile(contact), password },
              });
              const { error } = await supabase.auth.setSession(session);
              authError = error;
            } catch {
              authError = new Error('Invalid phone number or password.');
            }
          }
          if (authError) {
            throw new Error(
              'Sign-in failed. Check your email or phone number and password.',
            );
          }
          await cloud.refresh();
          await navigate({ to: await resolveDestination() });
          setName('');
          setEmail('');
          setPhone('');
          setPassword('');
          return;
        }
        const response = await fetch(`${apiBase}/api/auth/login`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ contact, password, accountType: destination }),
        });
        if (!response.headers.get('content-type')?.includes('application/json')) {
          throw new Error(
            apiBase
              ? 'The configured GYVORA API did not return JSON. Check VITE_GYVORA_API_URL and confirm the API is running.'
              : 'The GYVORA API is not deployed at this address. Configure a production sign-in provider or deploy the API and set VITE_GYVORA_API_URL.',
          );
        }
        const result = await response.json().catch(() => ({})) as {
          error?: string;
          user?: { accountType?: string; fullName?: string };
        };
        if (!response.ok) throw new Error(result.error || 'Sign-in failed. Check your details.');
        const user = result.user;
        const accountType = user?.accountType;
        if (!user || (accountType !== 'gym' && accountType !== 'individual')) {
          throw new Error('The server returned an invalid account type. Please try again.');
        }
        await router.options.context.queryClient.cancelQueries();
        router.options.context.queryClient.clear();
        if (prototypePreviewEnabled()) {
          const accountName = user.fullName?.trim() || name.trim() || contact;
          const previewSession = await createStablePreviewSession(
            accountType,
            accountName,
            contact,
            password,
            true,
          );
          setDemoSession(null);
          savePreviewSession(previewSession);
          savePrototypePreference({destination: accountType, name: accountName, email: contact}, remember);
          await cloud.refresh();
          const savedRequest = accountType === 'gym' ? readSampleRequest() : null;
          const gymDestination = savedRequest?.status === 'Approved' || (savedRequest?.status === 'Pending' && prototypeTrialActive(savedRequest))
            ? '/dashboard'
            : '/subscription-request';
          setName(''); setEmail(''); setPhone(''); setPassword('');
          await navigate({ to: accountType === 'gym' ? gymDestination : '/member' });
          return;
        }
        clearPrototypeStorage();
        resetPrototypeData();
        savePreviewSession(null);
        savePrototypePreference({destination: accountType, name, email: contact}, remember);
        setName(''); setEmail(''); setPhone(''); setPassword('');
        await navigate({ to: accountType === 'gym' ? '/dashboard' : '/member' });
        return;
      } else {
        throw new Error('Enter your registered phone number or email and password. New users must create an account first.');
      }
    }catch(e){setError(e instanceof Error?e.message:'Could not sign in.');}
    finally{setBusy(false);}
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden lg:block">
        <img src={cover} alt="Gym training racks and weight plates" className="absolute inset-0 h-full w-full object-cover" width={675} height={1200} />
        <div className="hero-overlay absolute inset-0" />
        <div className="absolute bottom-12 left-12 right-12">
          <span className="eyebrow">Gym OS</span>
          <h2 className="mt-3 max-w-md text-4xl font-semibold leading-tight">Run your club like a high‑performance athlete.</h2>
          <p className="mt-3 max-w-md text-muted-foreground">Members, attendance, sessions, trainers and finance — one premium workspace.</p>
        </div>
      </div>
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <AppBrand large className="mb-8" />
          <h1 className="text-3xl font-semibold">{demoAdminMode ? "Administrator access" : "Welcome back"}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{demoAdminMode ? "Verify the platform administrator profile." : "Sign in to your account"}</p>
          <p role="status" className="mt-3 text-sm text-muted-foreground">{demoAdminMode ? "Administrator access is separate from preview profiles." : "Sign in with the phone number and password you registered. New users must create an account first."}</p>
          {!demoAdminMode && created && <p className="mt-3 text-sm text-success">{confirmationRequired ? "Check your Gmail and follow the confirmation link before signing in. No SMS code is required." : "Your account is ready. Sign in with your phone or Gmail and password."}</p>}

          <form className="mt-6 space-y-4" onSubmit={signIn} noValidate>
            <div className="space-y-2">
              <Label htmlFor="demo-email">{demoAdminMode ? "Administrator email" : "Gmail address"}</Label>
              <Input id="demo-email" name="email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" placeholder="Email address" required={demoAdminMode} className="h-11 bg-card" />
            </div>
            <div className="space-y-2"><Label htmlFor="demo-phone">Phone number</Label><Input id="demo-phone" name="phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" placeholder="01012345678 or +201012345678" required={demoAdminMode} className="h-11 bg-card" /></div>
            {!demoAdminMode && <p className="text-xs text-muted-foreground">Enter your phone number or your registered email.</p>}
            <div className="space-y-2">
              <Label htmlFor="demo-password">Password</Label>
              <Input id="demo-password" name="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" type="password" placeholder="••••••••" required className="h-11 bg-card" />
            </div>
            {!demoAdminMode && <><Link to="/forgot-password" className="block text-xs text-primary hover:underline">Forgot password?</Link>
            <div className="flex items-center gap-2"><Checkbox id="demo-remember" checked={remember} onCheckedChange={value => setRemember(value === true)} /><Label htmlFor="demo-remember" className="text-sm font-normal">Remember Me</Label></div></>}
            {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
            <Button type="submit" disabled={busy || !hydrated} className="h-11 w-full">{busy ? (demoAdminMode ? "Opening workspace…" : "Signing in…") : demoAdminMode ? "Continue as administrator" : "Login"}</Button>
          </form>
          {previewMode && <button type="button" className="mt-5 block w-full text-center text-xs text-muted-foreground hover:text-primary" onClick={() => {setAdminMode(value => !value);setError("");setPassword("");}}>
            {adminMode ? "Back to Gym and Client access" : "Platform administrator"}
          </button>}
          {!demoAdminMode && <p className="mt-6 text-center text-sm text-muted-foreground">
            New here? <Link to="/register" className="text-primary hover:underline">Create account</Link>
          </p>}
          <a href={whatsappLink(platformWhatsapp || cloudPlatformSettings?.whatsapp || DEFAULT_PLATFORM_WHATSAPP, `Hello, I need help with ${platformBranding?.name || cloudPlatformSettings?.name || 'GYVORA'}.`)} target="_blank" rel="noopener noreferrer" className="mt-6 flex items-center justify-center gap-2 text-sm font-medium text-muted-foreground hover:text-primary">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full border bg-secondary text-primary">
              <WhatsAppGlyph />
            </span>
            Contact Us
          </a>

        </div>
      </div>
    </div>
  );
}
