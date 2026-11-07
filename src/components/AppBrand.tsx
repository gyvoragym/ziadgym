import { useEffect, useState } from 'react';
import logo from '@/assets/gyvora-logo.png';
import { cn } from '@/lib/utils';
import { useDemoStore } from '@/lib/demo';
import { imageUrl } from '@/lib/images';
import { usePlatformSettings } from '@/lib/platform-settings';

export function AppBrand({ className, large = false }: { className?: string; large?: boolean }) {
  const branding = useDemoStore((state) => state.platformBranding);
  const { data: platformSettings } = usePlatformSettings();
  const name = branding?.name || platformSettings?.name || 'GYVORA';
  const logoPath = branding?.logo || platformSettings?.logo || '';
  const [brandLogo, setBrandLogo] = useState(logo);
  useEffect(() => {
    let active = true;
    if (!logoPath) {
      setBrandLogo(logo);
      return () => { active = false; };
    }
    void imageUrl(logoPath)
      .then(url => { if (active) setBrandLogo(url); })
      .catch(() => { if (active) setBrandLogo(logo); });
    return () => { active = false; };
  }, [logoPath]);

  return <div className={cn('flex min-w-0 items-center gap-3', className)}>
    <img src={brandLogo} alt={`${name} logo`} width={500} height={500}
      className={cn('shrink-0 rounded-lg object-contain', large ? 'h-24 w-24' : 'h-16 w-16')} />
    <span className="font-display text-lg font-semibold">{name}</span>
  </div>;
}