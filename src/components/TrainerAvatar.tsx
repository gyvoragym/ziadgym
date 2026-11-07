import { useState } from "react";
import { initials } from "@/lib/mock";

export function TrainerAvatar({ t, size = "h-12 w-12" }: { t: {name: string; image?: string | undefined}; size?: string }) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const name = t.name?.trim() || "Trainer";
  return t.image && failedImage !== t.image ? (
    <img src={t.image} alt={name} onError={() => setFailedImage(t.image ?? "")}
      className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`grid ${size} shrink-0 place-items-center rounded-full bg-accent font-display font-semibold text-primary`}>
      {initials(name.replace("Coach ", "")) || "T"}
    </span>
  );
}