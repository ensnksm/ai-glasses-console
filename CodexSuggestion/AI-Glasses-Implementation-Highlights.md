# AI Glasses prototype: implementation highlights for Claude

AI Glasses is a desktop dashboard for a competition demo. It shows how an operator could monitor assistive smart glasses, trace AI events, and review candidate training samples. The current app runs locally with mock data and no connected cameras, devices, or backend. The dashboard UI is in Chinese; UI terms below are translated into English for this review.

## What's new: sign-in, approvals, and permissions

- **Sign-in and registration:** Visitors must sign in before opening the dashboard. A new account stays pending until an administrator approves it and chooses a role. After sign-in, a permitted deep link opens at its original destination; otherwise, the app opens Live Monitor.
- **Administrator Center:** The only super administrator is the built-in demo account `admin01`. It can approve or reject applications, return rejected applications to pending, enable or disable ordinary accounts, and change their access. Its own role and enabled status are fixed. The account table has search and status filters. The audit log records the time, actor, target, and change.
- **Roles and individual permissions:** The three assignable roles are AI Analyst, Data Reviewer, and Read-Only Observer. The analyst can view analysis, model monitoring, and read-only datasets. The reviewer can view and work with candidate samples and review recognition results. The observer can view basic monitoring, devices, and events. All signed-in roles can change display preferences.
- **Seven permission overrides:** The administrator can inherit, allow, or deny access to analytics, model monitoring, datasets, sample viewing, recognition review, sample addition, and sample editing. Adding or editing samples requires sample viewing. An administrator can grant recognition review without granting access to samples. Changing someone's role preserves their overrides, and the editor previews the resulting access before saving.
- **Consistent access decisions:** The same rules control navigation, direct page access, and action handlers. Changes propagate to other tabs on the same browser origin. Revoking a page permission redirects a user who is on that page. Disabling an account ends its session; re-enabling it requires a fresh sign-in.

Accounts, permissions, and logs are browser-local. Sign-in state and sample review changes are scoped to the current tab; permission updates synchronize across tabs, but sample edits do not. This is a workflow simulation. It does not enforce security on a server or protect real data.

## Earlier refinements worth reviewing

- Live Monitor keeps the four overview tiles but gives the camera area and latest AI result more visual weight. The camera explicitly says video is not connected. Device connectivity and mock data are presented separately; `GL-003` has an undetermined connection state.
- Simulation is off by default. Live Monitor distinguishes not started, running, and paused. A paused run shows the last generated event time when event times are enabled. Only the super administrator can change automatic refresh.
- A completed request does not imply a correct result. In event `AI-1046`, the OCR request completed, but the recognition result was judged incorrect. The event and its candidate sample share the recognition verdict; sample eligibility and corrections are separate.
- Light and dark themes are available. During a sidebar drag, the open page keeps a subdued marker while the glass capsule previews the pointer target. Releasing outside the menu cancels the change.

## Suggested demo and verification

Run `npm run dev` from the project root and open the address printed in the terminal. The sign-in page can fill the public demo administrator credentials. To see the new flow, register a disposable demo account in one tab, approve it as a Read-Only Observer from a second tab, and sign in as the observer. Grant recognition review alone, reopen or keep the event drawer open, then revoke it. The event should switch between editable and read-only without exposing the sample workspace.

The production build passed. Edge checks covered registration and approval, rejection and reopening, role defaults, an explicit denial overriding a role, cross-tab grant and revocation, and session invalidation after disabling an account. Layout checks included 1440 x 900 in light mode and 1366 x 768 in dark mode.

If screenshots would help, attach `login-light.png`, `admin-accounts-light.png`, and `admin-permissions-dark.png` separately. They are in `artifacts/screenshots/admin-auth/`. This Markdown file works as a handoff on its own; the screenshots are not embedded.

## Questions for Claude

1. Can a first-time viewer tell the difference between submitting an application, approving an account, and granting a specific permission? Where would you change the wording or layout first?
2. Does the permission editor make it clear how role defaults, explicit overrides, and prerequisites interact? Consider allowing sample editing while sample viewing is denied, then changing the account's role.
3. If an operator is redirected after losing permission or sent to sign-in after account deactivation, what should the message explain? Which improvement to the demo would you prioritize, and what evidence would change your recommendation?
