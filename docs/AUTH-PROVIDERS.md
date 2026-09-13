# Signing in with Google and Microsoft

Both are optional. A deployment with neither configured shows only the email
and password form, which is a working state rather than a broken one — the
buttons appear only for providers that have credentials.

Set `APP_URL` first: the redirect URI registered with each provider has to
match it exactly, down to the scheme and the absence of a trailing slash.

---

## Google

1. Google Cloud console → **APIs & Services → OAuth consent screen**. Pick
   *External* unless everyone signing in is in your own Workspace, and fill in
   the application name, support email and a privacy policy URL.
2. **APIs & Services → Credentials → Create credentials → OAuth client ID**,
   type **Web application**.
3. Authorised redirect URI:

   ```
   https://protocolo.tu-dominio.com/api/auth/google/callback
   ```

4. Copy the client ID and secret into the deployment:

   ```env
   GOOGLE_CLIENT_ID=123456789-abcdef.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=...
   ```

While the consent screen is in *Testing*, only the accounts listed as test
users can sign in. Publish it when you are ready for everyone.

---

## Microsoft

1. Entra ID (formerly Azure AD) → **App registrations → New registration**.
2. Supported account types:
   - *Accounts in this organizational directory only* if the app is for one
     company. Also set `MICROSOFT_TENANT_ID` to that directory's id.
   - *Accounts in any organizational directory and personal Microsoft accounts*
     to let clients and outside collaborators use their own.
3. Redirect URI, platform **Web**:

   ```
   https://protocolo.tu-dominio.com/api/auth/microsoft/callback
   ```

4. **Certificates & secrets → New client secret**. Copy the *value*, not the id;
   it is only shown once. Note its expiry — sign-in stops working the day it
   lapses.
5. Fill in the deployment:

   ```env
   MICROSOFT_CLIENT_ID=00000000-1111-2222-3333-444444444444
   MICROSOFT_CLIENT_SECRET=...
   # optional, restricts sign-in to one directory
   MICROSOFT_TENANT_ID=...
   ```

The default scopes (`openid email profile`) need no administrator consent.

---

## How accounts are joined up

One person, one account. Signing in through a provider binds that identity to
an account, and a second provider binds to the same one, so somebody can
register with a password and later use Google without ending up with two
accounts.

Binding to an address somebody already holds is also how an account gets taken
over, so it only happens when the provider actually vouches for the address:

- **Google** states whether the address is verified, and is trusted when it is.
- **Microsoft work and school accounts** are verified by their tenant.
- **Personal Microsoft accounts** can carry an address nobody checked, so they
  are treated as unverified: they can create a new account, but never attach
  themselves to an existing one. The person is told to sign in with their
  password instead.

An account created through a provider has no password. Attempting the password
form with it says so rather than reporting wrong credentials.

---

## Troubleshooting

**`redirect_uri_mismatch`.** The URI registered with the provider differs from
`<APP_URL>/api/auth/<provider>/callback`. Compare them character by character,
including `https` and any trailing slash.

**Sign-in returns "the attempt expired".** The short-lived cookie holding the
state, nonce and PKCE verifier was lost — usually because the flow started on
one hostname and came back on another, or took longer than ten minutes. Start
again from the same address.

**"Your provider does not confirm that address belongs to you."** A personal
Microsoft account, or a Google account with an unverified address, tried to
attach itself to an existing account. Sign in with the password, or use a work
account.

**The buttons do not appear.** The credentials are not reaching the container.
In Easypanel, check the Environment tab and redeploy — environment changes need
a restart.
