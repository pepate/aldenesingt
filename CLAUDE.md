## Playwright Profiles

Authenticated browser profiles are available at `.playwright/profiles/`.

Available profiles:
- **admin**: Admin role — full access including user management and song creation (max@muster.de)

Config: `.playwright/profiles.json`

**Important:** This app uses Firebase Authentication, which stores session tokens in **IndexedDB** (not cookies/localStorage). Standard `state-load` alone is not enough.

To restore the admin session in a new browser session:
1. `playwright-cli -s={session} open "https://aldene.de"`
2. Run the `_restoreAuth` eval from `.playwright/profiles/admin.json`
3. `playwright-cli -s={session} goto "https://aldene.de"` (reload to pick up auth)
4. Verify with snapshot — should show user avatar, not login button

Run `/setup-profiles` to create new profiles or refresh expired sessions.
