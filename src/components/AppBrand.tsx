import logo from '@/assets/gyvora-logo.png';
import { cn } from '@/lib/utils';

export function AppBrand({ className, large = false }: { className?: string; large?: boolean }) {
  return <div className={cn('flex min-w-0 items-center gap-3', className)}>
    <img src={logo} alt="GYVORA logo" width={500} height={500}
      className={cn('shrink-0 rounded-lg object-contain', large ? 'h-24 w-24' : 'h-16 w-16')} />
    <span className="font-display text-lg font-semibold">GYVORA</span>
  </div>;
}