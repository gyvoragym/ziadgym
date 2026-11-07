import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useStore, type StaffMember } from "@/lib/store";
import { useCloud } from "@/components/CloudProvider";
import { manageInvitation, manageStaff, lookupClient } from "@/lib/cloud.functions";
import { gymPages, formatPermissions } from '@/lib/gym-permissions';
import { QRScanner } from '@/components/QRScanner';
import { invitationStatus } from "@/lib/validation";
import { parseAccountQrPayload } from "@/lib/account-qr-payload";
import { StaffAttendance } from "@/components/StaffAttendance";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PageHeader, Panel, Field, DataTable, td, selectCls } from "@/components/kit";
import { toast } from "sonner";
import { seo } from "@/lib/seo";
import {
  getDemoSession,
  useDemoStore,
  createDemoInvitation,
  changeDemoInvitation,
  changeDemoStaff,
  lookupDemoClient,
  type DemoInvitation,
} from "@/lib/demo";
export const Route = createFileRoute("/_gym/staff")({
  head: () => seo("Staff & roles", "Manage gym staff invitations, permissions and attendance."),
  component: Staff,
});
const areas = gymPages;
function Staff() {
  const c = useCloud();
  const staff = useStore((s) => s.staff);
  const invite = useServerFn(manageInvitation);
  const lookup = useServerFn(lookupClient);
  const [query,setQuery]=useState('');
  type Found={id:string;full_name:string;email:string;phone:string};
  const [person,setPerson]=useState<Found|null>(null);
  const [scan,setScan]=useState(false);
  async function find(value:string, fromCamera=false):Promise<Found|null>{
    setPerson(null);
    try{
      const qrProfile=parseAccountQrPayload(value);
      if(value.trim().startsWith("GYVORA:PROFILE:")&&!qrProfile)
        throw new Error("This GYVORA profile QR is invalid or unreadable.");
      if(qrProfile?.type==="gym")
        throw new Error("Only a registered Client account can be invited as staff.");
      const lookupValue=qrProfile?.gyvora_id??value.trim();
      const r=getDemoSession()
        ?lookupDemoClient(c.gymId,lookupValue)
        :await lookup({data:{gymId:c.gymId,memberId:lookupValue}});
      const p={id:r.id,full_name:r.full_name,email:r.email??'',phone:r.phone??''};
      setPerson(p);
      return p;
    }catch(e){
      if(fromCamera)throw e;
      const m=e instanceof Error?e.message:'User lookup failed';
      toast.error(/no existing|no sample|not found/i.test(m)?'No registered Client account matches. The person must register as a Client first.':m);
      return null;
    }
  }
  const edit = useServerFn(manageStaff);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [cloudInvitations, setInvitations] = useState<
    Database["public"]["Tables"]["staff_invitations"]["Row"][]
  >([]);
  const demoInvitations = useDemoStore((s) => s.invitations);
  const invitations: DemoInvitation[] = getDemoSession()
    ? demoInvitations.filter((i) => i.gym_id === c.gymId)
    : cloudInvitations;
  const gymName = useStore((s) => s.gym.name);
  async function load() {
    if (getDemoSession()) return;
    const { data, error } = await supabase
      .from("staff_invitations")
      .select("*")
      .eq("gym_id", c.gymId)
      .order("created_at", { ascending: false });
    if (error) toast.error(error.message);
    else setInvitations(data ?? []);
  }
  useEffect(() => {
    if (c.gymId) void load();
  }, [c.gymId]);
  async function action(id: string, action: "resend" | "cancel") {
    try {
      if (action === "cancel" && !window.confirm("Cancel this invitation?")) return;
      if (getDemoSession()) changeDemoInvitation(c.gymId, id, action);
      else await invite({ data: { gymId: c.gymId, id, action } });
      toast.success(
        action === "resend"
          ? "Prototype invitation renewed — no email sent."
          : "Invitation cancelled",
      );
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update invitation");
    }
  }
  async function removeStaff(s: StaffMember) {
    if (!s.id || !window.confirm(`Remove ${s.name} from this gym? Their account and other gyms stay unchanged.`)) return;
    setBusy(true);
    try {
      if (getDemoSession()) changeDemoStaff(c.gymId, s.id, null);
      else await edit({ data: { gymId: c.gymId, id: s.id, remove: true, role: 'Reception', permissions: [], name: s.name, phone: s.phone ?? '' } });
      await c.selectGym(c.gymId); setOpen(false); toast.success('Staff removed from this gym');
    } catch (e) { toast.error(e instanceof Error ? e.message : 'Could not remove staff'); }
    finally { setBusy(false); }
  }
  return (
    <>
      <PageHeader
        title="Staff & roles"
        actions={
          c.role === "Owner" && (
            <Button
              onClick={() => {
                setEditing(null);
                setPermissions([]);setPerson(null);setQuery('');
                setOpen(true);
              }}
            >
              Add Staff
            </Button>
          )
        }
      />
      <Tabs defaultValue="staff">
        <TabsList className="mb-6">
          <TabsTrigger value="staff">Staff</TabsTrigger>
          <TabsTrigger value="invitations">Invitations</TabsTrigger>
          <TabsTrigger value="attendance">Staff Attendance</TabsTrigger>
        </TabsList>
        <TabsContent value="staff">
          <Panel title="Staff list">
            <DataTable head={["Employee", "Email", "Role", "Permissions", "Actions"]}>
              {staff.map((s) => (
                <tr key={s.id ?? s.email}>
                  <td className={td}>{s.name}</td>
                  <td className={td}>{s.email}</td>
                  <td className={td}>{s.role}</td>
                  <td className={td}>{formatPermissions(s.permissions ?? [])}</td>
                  <td className={td}>
                    {c.role === "Owner" && s.role !== "Owner" && (
                      <div className="flex gap-2"><Button
                        size="sm"
                        variant="secondary"
                        onClick={() => {
                          setEditing(s);
                          setPermissions(s.permissions ?? []);
                          setOpen(true);
                        }}
                      >
                        Edit
                      </Button><Button size="sm" variant="destructive" disabled={busy} onClick={()=>void removeStaff(s)}>Delete Staff</Button></div>
                    )}
                  </td>
                </tr>
              ))}
            </DataTable>
            {!staff.length && <p className="py-6 text-muted-foreground">No staff members.</p>}
          </Panel>
        </TabsContent>
        <TabsContent value="invitations">
          <Panel title="Invitations">
            <DataTable
              head={[
                "Invitee Full Name",
                "Invitee Email",
                "Invited Role",
                "Invitation Status",
                "Date Sent",
                "Expiration Date",
                "Actions",
              ]}
            >
              {invitations.map((i) => (
                <tr key={i.id}>
                  <td className={td}>
                    {i.full_name}
                    <div className="text-xs text-muted-foreground">{i.gym_name ?? gymName}</div>
                  </td>
                  <td className={td}>{i.email || "—"}</td>
                  <td className={td}>{i.role}</td>
                  <td className={td}>{invitationStatus(i.status, i.expires_at)}</td>
                  <td className={td}>{new Date(i.created_at).toLocaleDateString()}</td>
                  <td className={td}>{new Date(i.expires_at).toLocaleDateString()}</td>
                  <td className={td}>
                    {["Pending", "Expired"].includes(invitationStatus(i.status, i.expires_at)) &&
                      c.role === "Owner" && (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => void action(i.id, "resend")}
                          >
                            Resend Invitation
                          </Button>
                          {invitationStatus(i.status, i.expires_at) === "Pending" && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void action(i.id, "cancel")}
                            >
                              Cancel Invitation
                            </Button>
                          )}
                        </div>
                      )}
                  </td>
                </tr>
              ))}
            </DataTable>
            {!invitations.length && (
              <p className="py-6 text-muted-foreground">No invitations yet.</p>
            )}
          </Panel>
        </TabsContent>
        <TabsContent value="attendance">
          <StaffAttendance />
        </TabsContent>
      </Tabs>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit staff" : "Invite staff"}</DialogTitle>
          </DialogHeader>
          <form
            key={editing?.id ?? "new"}
            className="space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setBusy(true);
              const d = new FormData(e.currentTarget);
              try {
                if (editing?.id) {
                  if (getDemoSession()) changeDemoStaff(c.gymId, editing.id, { role: String(d.get("role")), permissions, name: String(d.get("name")), phone: String(d.get("phone") ?? "") });
                  else await edit({
                    data: {
                      gymId: c.gymId,
                      id: editing.id,
                      remove: false,
                      role: String(d.get("role")) as "Admin" | "Reception" | "Trainer",
                      permissions: permissions as Array<(typeof areas)[number]>,
                      name: String(d.get("name")),
                      phone: String(d.get("phone") ?? ""),
                    },
                  });
                  toast.success("Staff permissions saved");
                  await c.selectGym(c.gymId);
                } else {
                  let resolved = person;
                  if (!resolved && query.trim()) resolved = await find(query);
                  if (!resolved)
                    throw new Error("Look up the existing Client account by GYVORA ID, QR code, email or phone first.");
                  const role = String(d.get("role")) as "Admin" | "Reception" | "Trainer";
                  if (getDemoSession())
                    createDemoInvitation(c.gymId, gymName, resolved.full_name, resolved.email, role, {
                      userId: resolved.id,
                      permissions,
                    });
                  else
                    await invite({
                      data: {
                        gymId: c.gymId,
                        action: "create",
                        name: resolved.full_name,
                        email: resolved.email || undefined,
                        role,
                        userId: resolved.id,
                        permissions,
                      },
                    });
                  toast.success(
                    getDemoSession()?"Prototype invitation saved — no email sent.":"Invitation saved. Staff access requires acceptance.",
                  );
                  await load();
                }
                setOpen(false);
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Could not save staff");
              } finally {
                setBusy(false);
              }
            }}
          >
            {!editing&&<><QRScanner open={scan} onClose={()=>setScan(false)} onScan={async value=>Boolean(await find(value,true))}/><Field label="GYVORA Client ID, QR, email, phone or name"><div className="flex gap-2"><Input aria-label="Staff user lookup" value={query} onChange={e=>{setQuery(e.target.value);setPerson(null);}}/><Button type="button" onClick={()=>void find(query)}>Look up</Button><Button type="button" variant="outline" onClick={()=>setScan(true)}>Scan QR</Button></div></Field>{person&&<p className="text-sm text-success">{person.full_name} · {person.email||'No email'} · {person.phone||'No phone'} · {person.id}</p>}</>}
            <Field label="Full Name">
              <Input key={person?.id??editing?.id??'name'} name="name" required maxLength={100} defaultValue={editing?.name??person?.full_name} readOnly={!editing} />
            </Field>
            <Field label="Email (optional)">
              <Input
                name="email"
                type="email"
                maxLength={255}
                key={person?.id??editing?.id??'email'} defaultValue={editing?.email??person?.email}
                readOnly
              />
            </Field>
            <Field label="Phone (optional)">
              <Input name="phone" type="tel" maxLength={30} key={person?.id??editing?.id??'phone'} defaultValue={editing?.phone??person?.phone} readOnly={!editing} />
            </Field>
            <Field label="Role">
              <select name="role" className={selectCls} defaultValue={editing?.role ?? "Reception"}>
                {["Admin", "Reception", "Trainer"].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            {(
              <fieldset className="grid grid-cols-2 gap-2">
                <legend className="mb-2 text-sm">Permissions</legend>
                {areas.map((a) => (
                  <div key={a} className="flex items-start gap-2 text-sm">
                    <input
                      type="checkbox"
                      aria-label={a}
                      checked={permissions.includes(a)}
                      onChange={(e) =>
                        setPermissions(
                          e.target.checked
                            ? [...permissions, a]
                            : permissions.filter((p) => p !== a && !p.startsWith(a+':')),
                        )
                      }
                    />
                    <span>{a}<span className="mt-1 flex flex-wrap gap-2">{['create','edit','delete'].map(action=><label key={action} className="flex gap-1 text-xs"><input type="checkbox" aria-label={`${a} ${action}`} disabled={!permissions.includes(a)} checked={permissions.includes(`${a}:${action}`)} onChange={e=>setPermissions(e.target.checked?[...permissions,`${a}:${action}`]:permissions.filter(p=>p!==`${a}:${action}`))}/>{action}</label>)}</span></span>
                  </div>
                ))}
              </fieldset>
            )}
            <DialogFooter>
              {editing?.id && (
                <Button
                  type="button"
                  variant="destructive"
                  disabled={busy}
                  onClick={() => void removeStaff(editing)}
                >
                  Delete Staff
                </Button>
              )}
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button disabled={busy||(!editing&&!person&&!query.trim())}>
                {busy ? "Saving…" : editing ? "Save" : "Send Invitation"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
