import {Link} from '@tanstack/react-router';
import {ArrowLeft} from 'lucide-react';
import type {ReactNode} from 'react';
import { AppBrand } from './AppBrand';
export function ClientShell({title,children,actions}:{title:string;children:ReactNode;actions?:ReactNode}){return <div className="page-enter mx-auto min-h-screen max-w-4xl px-5 py-8"><AppBrand className="mb-6" /><Link to="/member" className="inline-flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4"/>My account</Link><div className="my-6 flex flex-wrap items-center justify-between gap-4"><h1 className="text-2xl font-semibold">{title}</h1>{actions}</div>{children}</div>}