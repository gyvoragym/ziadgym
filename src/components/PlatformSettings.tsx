import { useEffect, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field } from './kit';
import { ExerciseImage } from './ProgramEditor';
import { getDemoSession, savePlatformBranding, savePlatformWhatsapp, useDemoStore } from '@/lib/demo';
import { uploadImage } from '@/lib/images';
import { AppBrand } from './AppBrand';
import { useServerFn } from '@tanstack/react-start';
import { savePlatformContact } from '@/lib/platform-admin.functions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function PlatformSettings({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const saveContact = useServerFn(savePlatformContact);
  const queryClient = useQueryClient();
  const branding = useDemoStore(state => state.platformBranding);
  const savedWa = useDemoStore(state => state.platformWhatsapp);
  const [wa, setWa] = useState('');
  const [name, setName] = useState('GYVORA');
  const [logo, setLogo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const demo = getDemoSession() === 'super';

  useEffect(() => {
    if (!open) return;
    setError('');
    if (demo) {
      setName(branding?.name === 'IRONHAUS Platform' ? 'GYVORA' : branding?.name ?? 'GYVORA');
      setLogo(branding?.logo ?? '');
      setWa(savedWa ?? '');
      return;
    }

    let active = true;
    void (async () => {
      try {
        const { data, error: loadError } = await supabase.from('platform_settings').select('whatsapp,name,logo').eq('id', true).maybeSingle();
        if (!active) return;
        if (loadError) {
          setError('Could not load platform settings.');
          return;
        }
        setWa(data?.whatsapp ?? '');
        setName(data?.name ?? 'GYVORA');
        setLogo(data?.logo ?? '');
      } catch {
        if (active) setError('Could not load platform settings.');
      }
    })();
    return () => { active = false; };
  }, [open, demo, branding, savedWa]);

  async function uploadLogo(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      setLogo(await uploadImage(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Logo upload failed.');
    } finally {
      setBusy(false);
    }
  }

  function saveDemo(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      if (!name.trim() || name.trim().length > 100) throw new Error('Enter a platform name of 1–100 characters.');
      if (logo.length > 8000) throw new Error('The platform logo reference is too long.');
      if (wa.trim() && !/^\+?[0-9 ()-]{6,20}$/.test(wa.trim())) throw new Error('Enter a WhatsApp number with country code and digits.');
      savePlatformWhatsapp(wa);
      savePlatformBranding({ name, logo });
      toast.success('Platform settings saved');
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save platform settings.');
    }
  }

  async function saveCloud(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      await saveContact({ data: { whatsapp: wa, name, logo } });
      await queryClient.invalidateQueries({ queryKey: ['platform-branding'] });
      toast.success('Platform settings saved');
      onOpenChange(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save platform settings.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Platform Settings</DialogTitle>
          <DialogDescription>Platform branding · gym branding stays unchanged.</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={demo ? saveDemo : saveCloud}>
          <Field label="Platform name">
            <Input value={name} onChange={event => setName(event.target.value)} required maxLength={100} />
          </Field>
          <Field label="WhatsApp contact number">
            <Input value={wa} onChange={event => setWa(event.target.value)} placeholder="+20 100 000 0000" maxLength={20} inputMode="tel" />
          </Field>
          {logo ? <ExerciseImage path={logo} className="h-16 w-16 rounded-md object-contain" /> : <AppBrand />}
          <Field label="Platform logo">
            <Input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={event => void uploadLogo(event.target.files?.[0])} />
          </Field>
          {logo && <Button type="button" variant="outline" onClick={() => setLogo('')}>Remove logo</Button>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
