<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- GYVORA IDs use a shared locked text allocator and append-only versioned registry; old reservations stay retired, demo caches migrate once, and opaque demo reservations return only IDs. Browser-local contacts and legacy account keys stay isolated.
- Development signup uses local mock codes without provider accounts; production server send/verify boundaries fail closed until real providers are installed.
- Preview identities use contact hashes and isolated browser persistence, never Cloud privileges; admin edits/gates share the owner key. The shared classifier enables prototypes on dev servers and supported preview hosts, not published hosts, because hosted previews use production builds. Real requests use authenticated RPCs.
- User gym browsing uses the existing safe content RPC and a dashboard-styled client workspace; public projections never include management data or grant membership. Personal workout saves keep source gym/plan keys with a per-user unique index, while editable definitions remain independent.
- Persisted staff page names grant read access and page:create/edit/delete grant independent actions in existing invitation/role permission arrays; database record triggers enforce actions, and member gym discovery includes owner-added memberships without manual directory links.
- Admin gym deletion uses retained tombstones, an append-only deletion/restore history and the shared database entitlement predicate; reversible suspension never disables owner authentication or removes associations, while the separate permanent-account flow remains isolated.
- Existing-client memberships reuse gym_records/client_id and historical snapshots; database uniqueness and owner/approved-gym guards enforce linking, while client-owned directory links never grant access. Shared summaries expose only gym approval/plan, never billing credentials or receipts. Client portal path exceptions match /member or /member/ exactly, not /members or /memberships.
- Shared app branding uses a reusable component backed by uploaded CDN asset pointers; gym identity and legacy storage/QR namespaces stay separate to preserve user records and permanent codes.
- Super Admin plans, dates, notes, prices and branding extend existing prototype snapshots; assigning a plan copies its stable ID, billing type, duration and agreed prices into the gym, so catalog edits cannot change agreements. Projected billing uses saved billing types and anchored dates, with plan duration end dates exclusive, never payment receipts. Provider identities are read from authenticated accounts without substituting social sign-in for linking or fabricating demo connections.
- Both owner trainer views read the same gym-scoped store and persistence pipeline; optional notes and shared photo fallbacks avoid duplicate records. Trainer profile mutations merge validated fields by trainer ID and retain previous names for workout lookup; program/assignment attribution remains a historical name snapshot, so renames preserve associations without rewriting creators.
- Gym event history is appended from demo snapshot differences and Cloud record/invitation triggers; owner-only notification reads and per-user read/dismiss state stay separate from underlying gym records so notification actions cannot alter them.
- Owner personal settings use account-scoped demo profile overrides or authenticated provider updates, while gym branding reads only the saved gym snapshot; shared calendar-date filtering keeps attendance, sessions and Finance-based dashboard expenses consistent.
- Product sales reuse gym product snapshots: stable IDs identify edits, stock-only forms preserve `sales`, sales controls change `qty` by the sold delta, totals are derived, and transition validation blocks insufficient stock and deletion of recorded sales.
- Keep gym invoice records in the existing transaction snapshots and archive deletions; retained numbered records preserve the per-gym sequence while database guards prevent duplicate or changed numbers. Trainer schedules use optional weekly rows so legacy trainer details remain compatible.
- Keep platform expenses, gym-scoped prototype invitations and workout assignment snapshots in the existing demo store, and session client selections keyed by gym; this preserves local persistence without granting Cloud access or mixing platform and gym finances.
- Preserve TanStack routes and the UI kit; project RPC middleware attaches refreshed provider tokens, private QR lookup requires a session, and scanners await lookup results so failures stay visible.
- Store gym records under a gym ID with permission-enforced access; keep account profiles, gym role associations, invitations and approval requests in separate tables so editable profile data never grants access.
- Real login uses provider password auth; signup code challenges are not login sessions. `otp_verified()` remains an authenticated-session compatibility shim so existing RLS policies stay intact.
- Login preferences exclude passwords; clear isolated legacy/demo sessions before credential sign-in so fictional access cannot grant Cloud permissions.
- Demo data stays isolated; member history follows changes; duplicate checks apply only to new/relinked record IDs, never edits/removals.

- Locked writes preserve profiles; reports sum sessions and atomic subscription price/date events, subtracting paid invoices. Demo reports stay isolated.
- Pricing JSON keeps legacy labels plus numeric durationMonths; shared calendar helpers clamp dates and preserve ordinary-edit history.
- Client gym joins and favorites are separate from paid memberships and staff roles; client-facing reads project only public gym details, while immutable membership snapshots retain history independently of gym associations.
- Platform request notifications derive only from submitted requests, with per-admin read state; Cloud inserts fan out through an owner-request trigger and recipient/admin RLS, while prototype profiles use stable session keys and never update provider credentials.
