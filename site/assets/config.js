// AEL Operations Portal — settings.
// Fill in the two values from Supabase → Project Settings → API Keys / Data API.
// The "publishable" (or "anon public") key is MEANT to be public; it can only do what the
// database rules allow (sign in, then read what that user is permitted to see).
// NEVER put the "secret" / "service_role" key here.
window.PORTAL_CONFIG = {
  supabaseUrl: 'https://YOUR-PROJECT-REF.supabase.co',
  supabaseKey: 'PASTE-PUBLISHABLE-OR-ANON-KEY-HERE',
  idleMinutes: 60,          // sign out after this many minutes with no activity
  orgName: 'AEL Operations Portal'
};
