# User authentication architecture and implementation roadmap

Planning only, following the owner's scope update on 2026-11-12. The Supabase
migration remains priority 1. User authentication is the next major milestone;
this roadmap authorizes no login implementation, schema deployment, identity
provider activation, invitations or production configuration change.

Migration acceptance must preserve the existing API restrictions, LINE signature
verification and database privileges. If those controls do not adequately protect
production activation, the migration assessment remains **NO-GO**. Deferring this
milestone does not waive that security gate or authorize weakening the current
production refusal. See the separate [migration runbook](../database-migration.md).

## Existing boundary

The PostgreSQL adapter currently requires an isolated staging identity and shared
server-side bearer token; `stagingSettings()` refuses `VERCEL_ENV=production`.
The token identifies an allowed staging caller, not an individual staff member,
role or shop. In PostgreSQL staging the ordinary API wrapper authenticates requests, while only the
explicit LINE entrypoint may use the raw-body HMAC signature path. The database
uses a nonprivileged login, a restricted runtime role and private schemas.

These controls must remain intact during migration. There is no existing
application user/session/role/shop authorization system to certify as complete.
The Sheets branch retains its legacy handlers; this staging wrapper does not add
application authentication to that branch.
Deployment protection and browser-to-API access need their own verified inventory;
an authenticated page alone does not establish that every API is protected.
The migration's metadata inspection found Standard Protection excluding the
production domain, with password protection disabled. Production access-control
adequacy is therefore a current NO-GO, not a completed prerequisite; see the
[separate assessment](../database-migration.md#current-migration-go-no-go-assessment-2026-11-12).

## Proposed architecture

Use a maintained identity provider rather than building password cryptography.
Supabase Auth is the first candidate to evaluate because the project is adopting
Supabase; provider choice, login method, administrator MFA policy, email delivery,
operational cost and recovery ownership need approval before implementation. Its documented
[server-side authentication patterns](https://supabase.com/docs/guides/auth/server-side)
are a reference, not an installed dependency or selected session design.

Keep browser login/session handling in explicit server entrypoints and an
authentication module. Resolve a verified principal and server-owned shop
membership for every protected operation, then pass a narrow authorization context
to feature use cases. UI visibility is a convenience; API authorization is
mandatory. Keep credentials and privileged database keys server-side.

A server-managed session is the proposed default: an opaque session cookie with
Secure, HttpOnly and suitable SameSite settings, bounded idle/absolute lifetimes,
rotation, logout and revocation. Define recovery and any provider refresh-token
storage before choosing SDK plumbing; do not assume a browser SDK automatically
provides HttpOnly sessions. Protect cookie-authenticated writes against CSRF and
check request origin. Existing pending-operation IDs in sessionStorage are not
authentication credentials and must not become authorization evidence.
[OWASP session guidance](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
informs this proposal.

Use explicit permissions plus shop membership, with a deny-by-default policy.
Proposed roles are Owner, Operations Administrator, Shop Manager, Staff and
Read-only Viewer. HR/payroll access is a separately granted sensitive permission;
it must not follow automatically from ordinary shop administration. Owners manage
global access; managers and staff act only in assigned shops and allowed workflows.
The owner must approve the exact operation/role matrix before implementation.
[OWASP authorization guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)
supports checking permissions on every request and preventing guessed-record access.

Maintain a server-owned user profile, role/permission assignments and memberships
keyed to stable shop identities. Resolve the existing distinction between expense
shops and Loyverse accounts explicitly. Orders, shipments, shared expenses and
cross-shop operations need reviewed ownership rules; never infer access from a
display name, a URL parameter or an unverified client claim.

Continue private, server-mediated database access. A shared PostgreSQL login does
not establish an end user's `auth.uid()` or shop membership. Design and test any
transaction-local authorization context and RLS defense before relying on them;
never broaden Data API grants or use an owner/service-role connection to bypass
missing permissions. Bind idempotency replay to the verified actor and authorized
scope so a key cannot reveal another user's stored response.

LINE and background jobs remain separate machine principals. Preserve raw-body
signature verification, event idempotency and provider outcome handling. A LINE
user ID is not automatically a staff account. Any future account linking or job
credential changes require their own reviewed scope.

## Implementation sequence for the next milestone

| Stage | Deliverable | Exit criterion |
| --- | --- | --- |
| 1. Access model | Current page/API/job inventory, ownership mapping, role/operation matrix and provider/session decision | Owner approves policy, recovery ownership, cost and exclusions; ambiguous record ownership is resolved. |
| 2. Login and sessions | Approved login method, private session storage, expiry, rotation, logout and recovery | Invalid, expired and revoked sessions fail closed; no secrets in URLs, client bundles, browser storage or logs. |
| 3. API authorization | Verified principal at every ordinary API and feature boundary; shop and sensitive-data checks | Direct requests, guessed IDs, bulk operations, reports and file access cannot cross the assigned scope. |
| 4. User administration | Authorized invite/disable/access-management flows and session revocation | No self-escalation or loss of the last owner; disabled users lose access within the declared revocation bound. |
| 5. Database defense | Least-privilege permissions and the reviewed authorization/RLS design | Tests prove pooling cannot leak a previous user's context and direct role access remains restricted. |
| 6. Release acceptance | Disposable staging campaign, existing business regressions and controlled rollout/rollback | Security reviewer and owner approve the exact release; migration invariants and LINE behavior remain intact. |

Security event records should contain only the necessary actor, action, target,
decision and time in an approved protected destination. This proposal does not
restore the removed operational audit table or authorize retention of secrets.

## Required acceptance evidence

Verify unauthenticated rejection and forbidden-operation rejection separately,
including direct API calls, altered shop IDs, mixed-shop batches, exports and
image access. Test logout, expiry, revocation, privilege changes, CSRF, concurrent
sessions and recovery. Every rejection must preserve business/journal/provider
state and reveal no protected records.

Retest invalid LINE signatures and forged webhook-path bypass attempts, ordinary
API token restrictions, least-privilege database access, source/target identity
guards and browser bundle boundaries. Include retries and response loss under
distinct users so authorization cannot be bypassed through cached command results.
Rollout approval requires measured session/revocation behavior and an independently
reviewed permission matrix; a successful login screen is insufficient evidence.
