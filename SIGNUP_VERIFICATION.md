# Signup and verification

The public login and registration pages use Supabase Auth for real accounts, including in local development. A user must register before password sign-in succeeds. Create Account requires a name, an Egyptian mobile number, and a nonempty password; email is optional. Phone input accepts local `010`, `011`, `012`, or `015` numbers and supported international forms such as `+201012345678`, then normalizes to E.164.

Password signup uses the normal client-side Supabase email signup API with an internal, non-deliverable email address derived from the phone. The phone is saved as ordinary profile data; no phone provider or service-role key is used. Email confirmations must be disabled because the internal address cannot receive messages. The app accepts any nonempty password up to 128 characters. Local Supabase minimum length is set to one; in the connected hosted project, disable minimum length and leaked-password protection in Auth password settings if Supabase rejects the password. The optional email is saved only as profile contact information. Users sign in with their phone and password; the app maps the phone to the internal Auth account. Gym and Client account types are saved on the profile. Phone ownership is not verified, so users can register a number they do not control.

Google and Apple use the connected OAuth provider through the Lovable auth service. Registration collects the account type, name, and phone before redirecting to the provider; after provider confirmation the app saves the phone as profile data without changing the Auth phone or sending an SMS.

Phone-password signup does not require the Supabase Phone provider, an SMS provider, or a Supabase service-role key. For the connected hosted project, disable Email confirmations in Supabase Auth as well; the local `supabase/config.toml` setting does not change hosted settings. Configure Google and Apple credentials in the connected Supabase/Lovable authentication provider settings and allow the deployed app's `/register?oauth=1` redirect URL. The application does not generate or accept locally supplied verification codes.

The hidden Platform Admin area continues to require a real authenticated Supabase administrator role for cloud data. Its **New Signups** view reads Supabase Auth users with a phone number and their profiles from the server, reports today's total, and shows the latest 500 accounts. These numbers are not necessarily verified. It never uses local preview data as a substitute for real accounts.

Prototype tools elsewhere in the project remain browser-local and do not grant Cloud privileges. Their IDs, QR records, and demo data are separate from real account records and do not synchronize across browsers.

Gym accounts continue through the existing subscription-request and approval flow after sign-in. Account recovery remains separate from signup.
