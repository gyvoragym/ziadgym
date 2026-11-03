# IronHaus delivery

## Implemented
- Extended existing routes, design and store with Cloud-backed gym records, account profiles, isolated gym roles, staff invitations, owner requests and private image storage.
- Added member ID/QR lookup with manual entry, staff attendance/filters/details, editing for programs/plans/sessions/recurring expenses, and staff association management.
- Added client attendance and subscription history, independent personal program copies, completion controls, settings and password changes; removed Payments from client home.
- Added required unselected registration account types, password sign-in (OTP step removed), multi-gym selection, owner request/approval screens and protected data access.
- Added transactional snapshot checks to prevent stale edits overwriting newer gym data.

## Schema
Seven additive migrations create profiles, gyms, role associations, gym records, personal programs, invitations, requests, verified sessions and login challenges; apply permissions and validation; establish private image access policies. Existing frontend demo data was not imported into real gyms.

## Remaining configuration and verification
- No real accounts exist yet. Create and confirm an account to verify authenticated workflows end-to-end. Signed-out routes were browser-checked; 18 regression tests passed. gym CRUD, invitation acceptance, images and admin approval are not end-to-end verified.
- Staff invitation records and acceptance work in code, but invitation email sending is not implemented because no sender domain exists. Resend currently extends the invitation expiry only. Set up a domain you own before wiring email delivery.
- Phone/SMS sign-in is not connected; email sign-in remains available. SMS requires provider configuration.
- No super administrator account is provisioned. An approved administrator identity is required before safely assigning the protected role and verifying owner approval.
- Remember Me controls the verified-app-session lifetime (one day versus 30 days); it does not promise browser session-only auth token storage.
- Camera QR scanning requires browser camera permission; real-camera verification remains outstanding.
