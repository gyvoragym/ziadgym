import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Field } from "./kit";
import { BrowserQRCodeReader } from "@zxing/browser";
import { LoaderCircle, ScanLine } from "lucide-react";
export function QRScanner({
  open,
  onClose,
  onScan,
  manualLabel = "QR value",
  title = "Scan QR code",
}: {
  open: boolean;
  onClose: () => void;
  onScan: (value: string) => void | boolean | Promise<void | boolean>;
  manualLabel?: string;
  title?: string;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [value, setValue] = useState("");
  const [status, setStatus] = useState("Requesting camera permission…");
  const [busy, setBusy] = useState(false);
  const scanRef = useRef(onScan);
  scanRef.current = onScan;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  async function submit(text: string) {
    setBusy(true);
    setError("");
    setStatus("Looking up member…");
    try {
      const result = await scanRef.current(text.trim());
      if (result === false) {
        setError("Invalid QR or Member ID. No matching client belongs to this gym.");
        setStatus("Ready to scan again");
        return false;
      }
      setStatus("Member selected");
      closeRef.current();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not look up this member. Please try again.");
      setStatus("Lookup unsuccessful");
      return false;
    } finally {
      setBusy(false);
    }
  }
  const submitRef = useRef(submit);
  submitRef.current = submit;
  useEffect(() => {
    if (!open) return;
    setError("");
    setValue("");
    setStatus("Requesting camera permission…");
    let stopped = false;
    let reading = false;
    let last = "";
    let controls: { stop: () => void } | undefined;
    const reader = new BrowserQRCodeReader();
    const timer = setTimeout(() => {
      if (stopped) return;
      void reader
        .decodeFromVideoDevice(undefined, video.current ?? undefined, (result) => {
          if (!result || stopped || reading || result.getText() === last) return;
          reading = true;
          last = result.getText();
          void submitRef.current(last).then((ok) => {
            reading = false;
            if (ok) {
              stopped = true;
              controls?.stop();
            } else {
              // Permit the same QR to be scanned again, without flooding lookups.
              reading = true;
              setTimeout(() => { last = ""; reading = false; }, 2000);
            }
          });
        })
        .then((c) => {
          controls = c;
          if (stopped) c.stop();
          else setStatus("Camera ready — scan a member QR");
        })
        .catch((e: unknown) => {
          if (stopped) return;
          setError(
            e instanceof Error && e.name === "NotAllowedError"
              ? "Camera permission denied. Enter the Member ID below."
              : "Camera unavailable. Enter the Member ID or QR value below.",
          );
          setStatus("Manual entry available");
        });
    }, 100);
    return () => {
      stopped = true;
      clearTimeout(timer);
      controls?.stop();
    };
  }, [open]);
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="qr-scan-frame relative overflow-hidden rounded-md">
          <video
            ref={video}
            className="aspect-video w-full rounded-md bg-secondary"
            muted
            playsInline
          />
        </div>
        <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" />
          ) : (
            <ScanLine className="h-4 w-4" />
          )}
          {status}
        </p>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(value);
          }}
        >
          <Field label={manualLabel}>
            <Input
              required
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
          </Field>
          <Button disabled={busy}>
            {busy ? "Looking up…" : manualLabel === "Member ID" ? "Look up member" : "Use QR"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
