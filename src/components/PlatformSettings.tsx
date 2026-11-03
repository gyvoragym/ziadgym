import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
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

export function PlatformSettings({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}) {
  const saveContact=useServerFn(savePlatformContact);
  const branding = useDemoStore(s=>s.platformBranding);const savedWa=useDemoStore(s=>s.platformWhatsapp);const [wa,setWa]=useState('');
  const [name,setName]=useState('');const [logo,setLogo]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  const demo=getDemoSession()==='super';
  useEffect(()=>{if(open){setName(branding?.name === 'IRONHAUS Platform' ? 'GYVORA' : branding?.name??'GYVORA');setLogo(branding?.logo??'');setError('');setWa(savedWa??'');}},[open,branding,savedWa]);
  useEffect(()=>{if(open&&!demo)void supabase.from('platform_settings').select('whatsapp').eq('id',true).maybeSingle().then(({data})=>setWa(data?.whatsapp??''));},[open,demo]);
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Platform Settings</DialogTitle><DialogDescription>Platform branding · gym branding stays unchanged.</DialogDescription></DialogHeader>
    {!demo?<form className="space-y-4" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{await saveContact({data:{whatsapp:wa}});toast.success('Contact number saved');onOpenChange(false);}catch(e){setError(e instanceof Error?e.message:'Could not save contact');}finally{setBusy(false);}}}><Field label="WhatsApp contact number"><Input value={wa} onChange={e=>setWa(e.target.value)} maxLength={20} inputMode="tel"/></Field><Button disabled={busy}>{busy?'Saving…':'Save contact'}</Button></form>:<form className="space-y-4" onSubmit={e=>{e.preventDefault();try{savePlatformWhatsapp(wa);}catch(err){setError(err instanceof Error?err.message:'Invalid number');return;}try{savePlatformBranding({name,logo});onOpenChange(false);}catch{setError('Enter a platform name of 1–100 characters.');}}}>
      <Field label="Platform name"><Input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></Field>
      <Field label="WhatsApp contact number"><Input value={wa} onChange={e=>setWa(e.target.value)} placeholder="+20 100 000 0000" maxLength={20} inputMode="tel"/></Field>
      {logo ? <ExerciseImage path={logo} className="h-16 w-16 rounded-md object-contain"/> : <AppBrand />}
      <Field label="Platform logo"><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{setLogo(await uploadImage(file));}catch(err){setError(err instanceof Error?err.message:'Upload failed');}finally{setBusy(false);}}}/></Field>
      {logo&&<Button type="button" variant="outline" onClick={()=>setLogo('')}>Remove logo</Button>}
      <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={()=>onOpenChange(false)}>Cancel</Button><Button disabled={busy}>{busy?'Uploading…':'Save branding'}</Button></div>
    </form>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}
  </DialogContent></Dialog>;
}