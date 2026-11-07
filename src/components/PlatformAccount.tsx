import { useEffect, useState } from 'react';
import { useCloud } from './CloudProvider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Field } from './kit';
import { ExerciseImage } from './ProgramEditor';
import { getDemoSession } from '@/lib/demo';
import { adminProfileSchema, readAdminProfile, saveAdminProfile } from '@/lib/platform-admin';
import { uploadImage } from '@/lib/images';
import { supabase } from '@/integrations/supabase/client';
import { useServerFn } from '@tanstack/react-start';
import { changePlatformCredentials } from '@/lib/platform-admin.functions';
import { PlatformAccountLinks } from './PlatformAccountLinks';

export function PlatformAccount({open,onOpenChange}:{open:boolean;onOpenChange:(open:boolean)=>void}){
 const changeCredentials=useServerFn(changePlatformCredentials);
 const c=useCloud();const [name,setName]=useState('');const [email,setEmail]=useState('');const [photo,setPhoto]=useState('');const [busy,setBusy]=useState(false);const [uploading,setUploading]=useState(false);const [message,setMessage]=useState('');const [error,setError]=useState('');const demo=!!getDemoSession();
 useEffect(()=>{if(!open || !c.profile)return;const p=demo?readAdminProfile():null;setName(p?.full_name??c.profile.full_name);setEmail(p?.email??c.profile.email);setPhoto(p?.photo??c.profile.photo);setMessage('');setError('');},[open,c.profile?.id]);
 async function save(e:React.FormEvent<HTMLFormElement>){e.preventDefault();setBusy(true);setError('');setMessage('');try{const row=adminProfileSchema.parse({full_name:name,email,photo});if(demo){saveAdminProfile(row);setMessage('Profile saved. This prototype email is a display detail, not a sign-in credential.');}else{if(!c.profile)throw new Error('Sign in first');if(row.email!==c.profile.email){const current=String(new FormData(e.currentTarget).get('current')??'');if(!current)throw new Error('Enter your current password to change your email.');await changeCredentials({data:{current,change:{email:row.email}}});setMessage('Profile saved. Your email change may require confirmation; your current email remains active until confirmed.');}const {error:saveError}=await supabase.from('profiles').update({full_name:row.full_name,photo:row.photo}).eq('id',c.profile.id);if(saveError)throw saveError;await c.refresh();setMessage(prev=>prev||'Profile saved.');}}catch(err){setError(err instanceof Error?err.message:'Could not save profile');}finally{setBusy(false);}}
 return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg"><DialogHeader><DialogTitle>Account Settings</DialogTitle><DialogDescription>Platform Super Admin</DialogDescription></DialogHeader><form className="space-y-4" onSubmit={save}>
 <ExerciseImage path={photo} className="h-20 w-20 rounded-full object-cover"/><Field label="Profile Photo"><Input type="file" accept="image/jpeg,image/png,image/webp" disabled={busy||uploading} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setUploading(true);setError('');try{setPhoto(await uploadImage(file));}catch(err){setError(err instanceof Error?err.message:'Upload failed');}finally{setUploading(false);}}}/></Field>
 <Field label="Full Name"><Input value={name} onChange={e=>setName(e.target.value)} required maxLength={100}/></Field><Field label="Email"><Input type="email" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={255}/></Field>
 {!demo&&email!==c.profile?.email&&<Field label="Current password for email change"><Input name="current" type="password" autoComplete="current-password" required maxLength={128}/></Field>}
 <Button disabled={busy||uploading}>{uploading?'Uploading…':busy?'Saving…':'Save changes'}</Button></form>
 <section className="mt-4 border-t pt-4"><h2 className="font-semibold">Change Password</h2>{demo?<p className="mt-2 text-sm text-muted-foreground">Prototype access has no authenticated password. Password changes are unavailable here; no password is saved.</p>:<form className="mt-3 space-y-3" onSubmit={async e=>{e.preventDefault();const form=e.currentTarget;const d=new FormData(form);const current=String(d.get('current'));const next=String(d.get('next'));const confirm=String(d.get('confirm'));if(next.length<8||next.length>128||next!==confirm){setError('Use 8–128 characters and matching new passwords.');return;}setBusy(true);setError('');setMessage('');try{await changeCredentials({data:{current,change:{password:next}}});form.reset();setMessage('Password changed securely.');}catch(err){setError(err instanceof Error?err.message:'Password change failed');}finally{setBusy(false);}}}><Field label="Current password"><Input name="current" type="password" required autoComplete="current-password" maxLength={128}/></Field><Field label="New password"><Input name="next" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></Field><Field label="Confirm new password"><Input name="confirm" type="password" required minLength={8} maxLength={128} autoComplete="new-password"/></Field><Button disabled={busy} variant="secondary">{busy?'Changing…':'Change Password'}</Button></form>}</section>
  <PlatformAccountLinks open={open}/>
  {error&&<p role="alert" className="text-sm text-destructive">{error}</p>}{message&&<p role="status" className="text-sm text-success">{message}</p>}</DialogContent></Dialog>;
}