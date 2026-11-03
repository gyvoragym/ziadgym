import { createFileRoute, Link, useHydrated } from '@tanstack/react-router';
import { useState } from 'react';
import { AppBrand } from '@/components/AppBrand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Field } from '@/components/kit';
import { seo } from '@/lib/seo';
export const Route = createFileRoute('/forgot-password')({head:()=>seo('Password recovery prototype','Review simulated GYVORA password recovery without sending codes or changing a password.'),component:ForgotPassword});
function ForgotPassword() {
  const hydrated = useHydrated();
  const [contact,setContact]=useState('');const [sent,setSent]=useState(false);const [code,setCode]=useState('');const [verified,setVerified]=useState(false);const [message,setMessage]=useState('');const [success,setSuccess]=useState(false);
  function send(){if(!contact.trim()){setMessage('Enter an email or phone number.');return;}setSent(true);setCode('');setVerified(false);setMessage('Simulated code sent — no email or SMS was sent.');}
  return <div className="mx-auto max-w-md px-6 py-16"><AppBrand large className="mb-8"/><h1 className="text-2xl font-semibold">Forgot Password?</h1>{success ? <p role="status" className="mt-6 text-success">Prototype recovery complete. No password was changed.</p> : <form className="mt-6 space-y-4" onSubmit={e=>{e.preventDefault();if(!verified){setMessage('Verify a sample code first.');return;}e.currentTarget.reset();setContact('');setCode('');setSuccess(true);}}>
  <Field label="Email or phone"><Input value={contact} onChange={e=>{setContact(e.target.value);setSent(false);setVerified(false);setMessage('');}} required autoComplete="off"/></Field>
  <Button type="button" variant="outline" onClick={send}>Send Code</Button>
  {sent && <><Field label="Simulated verification code"><Input value={code} onChange={e=>{setCode(e.target.value);setVerified(false);}} autoComplete="off"/></Field><div className="flex gap-2"><Button type="button" variant="outline" onClick={()=>{if(!code.trim()){setMessage('Enter a non-empty sample code.');return;}setVerified(true);setMessage('Sample code accepted — verification simulated.');}}>Verify</Button><Button type="button" variant="ghost" onClick={send}>Resend Code</Button></div></>}
  <Field label="New password"><Input type="password" name="password" required minLength={8} maxLength={128} autoComplete="off"/></Field><Button type="submit" disabled={!hydrated}>Reset Password</Button></form>}{!success&&message&&<p role="status" className="mt-4 text-sm text-muted-foreground">{message}</p>}<Button asChild variant="link" className="mt-6 px-0"><Link to="/">Back to login</Link></Button></div>;
}
