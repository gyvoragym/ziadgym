import {createFileRoute,Link} from '@tanstack/react-router';
import {useState,useEffect} from 'react';
import {supabase} from '@/integrations/supabase/client';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Field} from '@/components/kit';
import {seo} from '@/lib/seo';
import {z} from 'zod';
export const Route=createFileRoute('/reset-password')({head:()=>seo('Reset password','Securely reset your IronHaus account password.'),component:Reset});
function Reset(){const [recovery,setRecovery]=useState(false);const [message,setMessage]=useState('');useEffect(()=>{if(window.location.hash.includes('type=recovery'))setRecovery(true);const {data:{subscription}}=supabase.auth.onAuthStateChange(e=>{if(e==='PASSWORD_RECOVERY')setRecovery(true);});return()=>subscription.unsubscribe();},[]);return <div className="mx-auto max-w-md px-6 py-16"><h1 className="text-2xl">Reset password</h1>{recovery?<form className="mt-6 space-y-4" onSubmit={async e=>{e.preventDefault();const password=String(new FormData(e.currentTarget).get('password'));const v=z.string().min(8).max(128).safeParse(password);if(!v.success){setMessage('Use a password between 8 and 128 characters.');return;}const {error}=await supabase.auth.updateUser({password:v.data});setMessage(error?.message??'Password updated. Sign in with your new password.');}}><Field label="New password"><Input type="password" name="password" required minLength={8} maxLength={128}/></Field><Button>Update password</Button></form>:<p className="mt-6">Open the password reset link from your email to continue.</p>}<p role="status" className="mt-4">{message}</p><Link to="/" className="mt-4 block text-primary">Sign in</Link></div>}