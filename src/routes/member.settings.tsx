import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useCloud } from "@/components/CloudProvider";
import { ClientShell } from "@/components/ClientShell";
import { ExerciseImage } from "@/components/ProgramEditor";
import { uploadImage } from "@/lib/images";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/kit";
import { z } from "zod";
import { toast } from "sonner";
import { seo } from "@/lib/seo";
import { readPreviewSession } from '@/lib/preview-session';
import { SampleAccountQR } from '@/components/SampleAccountQR';
export const Route = createFileRoute("/member/settings")({
  head: () =>
    seo(
      "Account settings",
      "View your permanent GYVORA ID and update account details or sign out.",
    ),
  component: Settings,
});
function Settings() {
  const c = useCloud();
  const [photo, setPhoto] = useState("");
  const [phone, setPhone] = useState(c.profile?.phone ?? "");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    setPhone(c.profile?.phone ?? "");
    if (!c.profile?.phone) {
      void supabase.auth.getUser().then(({ data, error }) => {
        if (!active) return;
        if (error) {
          toast.error(error.message);
          return;
        }
        const accountPhone = data.user?.phone ?? data.user?.user_metadata["phone"];
        if (typeof accountPhone === "string") setPhone(accountPhone);
      });
    }
    return () => {
      active = false;
    };
  }, [c.profile?.id, c.profile?.phone]);
  if (!c.profile) return null;
  return (
    <ClientShell title="Account Settings">
      {readPreviewSession() ? <div className="mb-6 max-w-lg"><SampleAccountQR kind="client"/></div> : c.profile.gyvora_id&&<p className="mb-6 break-all text-sm text-muted-foreground">GYVORA ID · {c.profile.gyvora_id}</p>}
      <form
        className="max-w-lg space-y-5"
        onSubmit={async (e) => {
          e.preventDefault();
          if (readPreviewSession()) {toast.info('Prototype only — account details were not changed.');return;}
          setBusy(true);
          const d = new FormData(e.currentTarget);
          try {
            const f = z
              .object({
                full_name: z.string().trim().min(1).max(100),
                email: z.string().trim().email().max(255),
                phone: z.string().trim().max(30),
              })
              .parse(Object.fromEntries(d));
            const { error } = await supabase
              .from("profiles")
              .update({ full_name: f.full_name, phone: f.phone, ...(photo ? { photo } : {}) })
              .eq("id", c.profile?.id ?? "");
            if (error) throw error;
            if (f.email !== c.profile?.email) {
              const { error } = await supabase.auth.updateUser({ email: f.email });
              if (error) throw error;
              toast.success("Confirm your email change from your inbox");
            }
            toast.success("Profile saved");
            await c.refresh();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not save profile");
          } finally {
            setBusy(false);
          }
        }}
      >
        <ExerciseImage path={photo || c.profile.photo} />
        <Field label="Profile Photo">
          <Input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (readPreviewSession()) {toast.info('Prototype only — no photo uploaded.');return;}
              try {
                setPhoto(await uploadImage(f));
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Upload failed");
              }
            }}
          />
        </Field>
        <Field label="Full Name">
          <Input name="full_name" required maxLength={100} defaultValue={c.profile.full_name} />
        </Field>
        <Field label="Email">
          <Input
            name="email"
            type="email"
            required
            maxLength={255}
            defaultValue={c.profile.email}
          />
        </Field>
        <Field label="Phone Number">
          <Input name="phone" maxLength={30} value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Button disabled={busy}>{busy ? "Saving…" : "Save changes"}</Button>
      </form>
      <section className="mt-10 max-w-lg border-t pt-6">
        <h2 className="text-xl font-semibold">Change Password</h2>
        <form
          className="mt-4 space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (readPreviewSession()) {e.currentTarget.reset();toast.info('Prototype only — no password was changed.');return;}
            const d = new FormData(e.currentTarget);
            const p = z
              .object({ current: z.string().min(1).max(128), next: z.string().min(8).max(128) })
              .safeParse({ current: d.get("current"), next: d.get("next") });
            if (!p.success) {
              toast.error(
                "Enter your current password and a new password of at least 8 characters.",
              );
              return;
            }
            const { error } = await supabase.auth.updateUser({
              password: p.data.next,
              current_password: p.data.current,
            });
            if (error) toast.error(error.message);
            else toast.success("Password changed");
          }}
        >
          <Field label="Current password">
            <Input name="current" type="password" required maxLength={128} />
          </Field>
          <Field label="New password">
            <Input name="next" type="password" required minLength={8} maxLength={128} />
          </Field>
          <Button variant="secondary">Change Password</Button>
        </form>
      </section>
      <Button variant="destructive" className="mt-10" onClick={() => void c.logout()}>
        Logout
      </Button>
    </ClientShell>
  );
}
