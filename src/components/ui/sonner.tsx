import { Toaster as Sonner, toast } from "sonner";
import { Ban, Check, CheckCheck, LogOut, Snowflake, Sun, Trash2, UserCheck, UserX, X, Info } from "lucide-react";
import type { ReactNode } from "react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const icon = (node: ReactNode, tone: string) => <span className={`toast-icon grid h-6 w-6 place-items-center rounded-full ${tone}`}>{node}</span>;
const ok = "bg-success/15 text-success", warn = "bg-warning/15 text-warning", bad = "bg-destructive/15 text-destructive", info = "bg-primary/15 text-primary";
const sm = "h-3.5 w-3.5";

/** Picks a distinct, consistent icon from the confirmed action's wording (approve, reject, freeze, delete, accept, leave…). */
export function actionIcon(message: unknown): ReactNode {
  const t = String(message ?? "").toLowerCase();
  if (/unfroz|restor|reactivat/.test(t)) return icon(<Sun className={sm} />, ok);
  if (/froz|freez/.test(t)) return icon(<Snowflake className={sm} />, info);
  if (/approv/.test(t)) return icon(<CheckCheck className={sm} />, ok);
  if (/accept/.test(t)) return icon(<UserCheck className={sm} />, ok);
  if (/reject|declin|revok/.test(t)) return icon(<UserX className={sm} />, warn);
  if (/left|leave/.test(t)) return icon(<LogOut className={sm} />, warn);
  if (/delet|remov|banned|archiv/.test(t)) return icon(<Trash2 className={sm} />, bad);
  return icon(<Check className={sm} />, ok);
}

// Every success toast in the app is raised only after its save resolves; give it the matching icon once, centrally.
const g = globalThis as { __gyToastPatched?: boolean };
if (!g.__gyToastPatched) {
  g.__gyToastPatched = true;
  const success = toast.success;
  toast.success = ((message: Parameters<typeof success>[0], data?: Parameters<typeof success>[1]) => success(message, { icon: actionIcon(message), ...data })) as typeof toast.success;
}

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      icons={{ error: icon(<X className={sm} />, bad), info: icon(<Info className={sm} />, info), warning: icon(<Ban className={sm} />, warn) }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
