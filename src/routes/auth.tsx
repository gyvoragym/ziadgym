import { createFileRoute, Navigate } from '@tanstack/react-router';
import { seo } from '@/lib/seo';
export const Route=createFileRoute('/auth')({head:()=>seo('Account sign in','Sign in securely to IronHaus.'),component:()=> <Navigate to="/"/>});