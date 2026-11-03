import { createFileRoute } from "@tanstack/react-router";
import { useRef } from "react";
import { useCloud } from "@/components/CloudProvider";
import { ClientShell } from "@/components/ClientShell";
import { Button } from "@/components/ui/button";
import { QRCodeSVG } from "qrcode.react";
import { Download, Share2 } from "lucide-react";
import { toast } from "sonner";
import { seo } from "@/lib/seo";
import { readPreviewSession } from '@/lib/preview-session';
import { SampleAccountQR } from '@/components/SampleAccountQR';
import { createAccountQrPayload } from '@/lib/account-qr-payload';
export const Route = createFileRoute("/member/qr")({
  head: () =>
    seo("My permanent QR", "Share or download your permanent GYVORA account ID and private QR code."),
  component: MemberQR,
});
function MemberQR() {
  const c = useCloud();
  const ref = useRef<HTMLDivElement>(null);
  const id = c.profile?.gyvora_id;
  const qrValue = id && c.profile
    ? createAccountQrPayload({
        type: 'individual',
        gyvora_id: id,
        full_name: c.profile.full_name,
        email: c.profile.email ?? '',
        phone: c.profile.phone ?? '',
      })
    : '';
  if(readPreviewSession()) return <ClientShell title="My sample QR"><div className="mx-auto max-w-lg"><SampleAccountQR kind="client"/></div></ClientShell>;
  async function image() {
    const svg = ref.current?.querySelector("svg");
    if (!svg) throw new Error("QR unavailable");
    const source = new XMLSerializer().serializeToString(svg);
    const url = URL.createObjectURL(new Blob([source], { type: "image/svg+xml" }));
    try {
      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("Could not create QR image"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 730;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Image download unavailable");
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 640, 730);
      ctx.drawImage(img, 40, 40, 560, 560);
      ctx.fillStyle = "#000000";
      ctx.textAlign = "center";
      ctx.font = "20px sans-serif";
      ctx.fillText("GYVORA · Member ID", 320, 650);
      ctx.font = "14px sans-serif";
      ctx.fillText(id ?? "", 320, 680);
      return await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Could not create image"))),
          "image/png",
        ),
      );
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  async function download() {
    try {
      const blob = await image();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "gyvora-member-qr.png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      return true;
    } catch (e) {
      toast.error(String(e));
      return false;
    }
  }
  async function share() {
    if (!id) return;
    try {
      if (navigator.share) {
        let shareData: ShareData = {
          title: "My GYVORA Member QR",
          text: `Member ID: ${id}`,
          url: window.location.href,
        };
        if (typeof File !== "undefined" && navigator.canShare) {
          const file = new File([await image()], "gyvora-member-qr.png", { type: "image/png" });
          if (navigator.canShare({ files: [file] })) {
            shareData = { files: [file], title: "My GYVORA QR", text: `Member ID: ${id}` };
          }
        }
        await navigator.share(shareData);
        return;
      }
      await navigator.clipboard.writeText(window.location.href);
      toast.success("QR page link copied");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      if (!navigator.share && await download()) {
        toast.success("QR downloaded instead");
        return;
      }
      toast.error(e instanceof Error ? e.message : "Could not share your QR.");
    }
  }
  return (
    <ClientShell title="My QR">
      <div className="mx-auto max-w-md text-center">
        <div ref={ref} className="mx-auto w-fit rounded-lg bg-foreground p-6">
          {id ? (
            <QRCodeSVG
              value={qrValue}
              size={240}
              marginSize={4}
              bgColor="transparent"
              fgColor="currentColor"
              className="text-background"
            />
          ) : (
            <p className="text-background">No Member ID available.</p>
          )}
        </div>
        <h2 className="mt-6 text-xl font-semibold">{c.profile?.full_name}</h2>
        <p className="mt-3 break-all text-sm text-muted-foreground">GYVORA ID · {id}</p>
        <div className="mt-6 flex justify-center gap-3">
          <Button disabled={!id} onClick={() => void share()}>
            <Share2 className="h-4 w-4" />
            Share
          </Button>
          <Button disabled={!id} variant="outline" onClick={() => void download()}>
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </div>
    </ClientShell>
  );
}
