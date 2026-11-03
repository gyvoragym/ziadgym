import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";

export const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z"
    />
    <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
    <path
      fill="#EA4335"
      d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
    />
  </svg>
);
export const AppleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true">
    <path d="M16.4 12.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9-1.7 0-3.3 1-4.2 2.6-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.6 1.3-.1 1.8-.8 3.3-.8s2 .8 3.4.8c1.4 0 2.3-1.3 3.1-2.5 1-1.4 1.4-2.8 1.4-2.9 0 0-2.7-1-2.7-4.1ZM13.9 4.9c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.2 2-1.1 3.1 1.1.1 2.3-.6 3-1.5Z" />
  </svg>
);
/** Social sign-in always continues through phone verification before opening an account. */
export function SocialSignIn() {
  const [busy, setBusy] = useState("");

  async function start(provider: "google" | "apple") {
    setBusy(provider);
    try {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        toast.info(
          "You're already signed in. Linking this provider to the existing account needs manual identity linking enabled in the backend auth settings — no duplicate account was created.",
        );
        return;
      }
      sessionStorage.removeItem("gyvora-oauth-registration");
      sessionStorage.setItem("gyvora-oauth-intent", "login");
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/register?oauth=1`,
      });
      if (result.error) {
        sessionStorage.removeItem("gyvora-oauth-intent");
        toast.error(
          `${provider === "google" ? "Google" : "Apple"} sign-in didn't complete: ${result.error.message}`,
        );
        return;
      }
      if (result.redirected) return;
      const confirmed = await supabase.auth.getUser();
      if (!confirmed.data.user) {
        sessionStorage.removeItem("gyvora-oauth-intent");
        return void toast.error("The provider didn't confirm a session.");
      }
      window.location.assign("/register?oauth=1");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Social sign-in did not complete.");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="mt-6">
      <div className="relative mb-4 text-center text-xs text-muted-foreground">
        <span className="relative z-10 bg-background px-2">or continue with</span>
        <span className="absolute inset-x-0 top-1/2 border-t" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 bg-card"
          disabled={!!busy}
          onClick={() => start("google")}
          aria-label="Sign in with Google"
        >
          <GoogleIcon />
          Google
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-11 gap-2 bg-card"
          disabled={!!busy}
          onClick={() => start("apple")}
          aria-label="Sign in with Apple"
        >
          <AppleIcon />
          Apple
        </Button>
      </div>
    </div>
  );
}
