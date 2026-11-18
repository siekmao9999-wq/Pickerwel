# Pickerwel Security Specification (With Admin Registration Approval)

## 1. Data Invariants
1. **Admin Approval Gate**: Non-admin users can only create `/users/{userId}` with `role: "user"` and `status: "pending"`. Only verified Admins (`siekmao9999@gmail.com` or UID present in `/admins/{uid}`) may change `status` to `"approved"` or `"rejected"`, or promote `role` to `"admin"`.
2. **Subcollection Master Gate**: Users cannot create, update, get, or delete `/users/{userId}/wheels/*` or `/users/{userId}/spinResults/*` unless their parent `/users/{userId}` document has `status == "approved"`.
3. **PII Isolation**: User emails are stored only inside `/users/{userId}`, where `get` is restricted strictly to `isOwner(userId) || isAdmin()`, and `list` is restricted strictly to `isAdmin()`.
4. **Strict Schema & Bounds**:
   - All document IDs (`userId`, `adminUid`, `wheelId`, `resultId`) match `^[a-zA-Z0-9_\-]+$` with length `1..128`.
   - `entries` on a Wheel is bounded to `<= 200` items, and if non-empty, `entries[0]` must be a string with length `<= 120`.
   - `spinDuration` is bounded between `3` and `10`.
   - `createdAt`, `updatedAt`, `reviewedAt`, and `spunAt` must equal `request.time` when set/modified.
5. **Email Spoofing Defense**: `isAdmin()` mandates `request.auth.token.email_verified == true` alongside email or `/admins/{uid}` check.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Approval on Registration**: Non-admin user creating `/users/u1` with `status: "approved"` -> `PERMISSION_DENIED`.
2. **Self-Admin Role Escalation on Registration**: Non-admin user creating `/users/u1` with `role: "admin"` -> `PERMISSION_DENIED`.
3. **Self-Approval on Update**: Pending user updating `/users/u1` to set `status: "approved"` -> `PERMISSION_DENIED`.
4. **Pending User Cloud Wheel Bypass**: Pending user (`status: "pending"`) creating `/users/u1/wheels/w1` -> `PERMISSION_DENIED` (blocked by `isApprovedUser`).
5. **Non-Admin Listing Users (PII Scrape)**: Regular user calling `list` on `/users` -> `PERMISSION_DENIED`.
6. **Non-Admin Reading Another User**: Regular user calling `get` on `/users/u2` -> `PERMISSION_DENIED`.
7. **Unverified Admin Email Spoof**: User with `email: "siekmao9999@gmail.com"` and `email_verified: false` -> `PERMISSION_DENIED`.
8. **Shadow Field Injection**: User creating `/users/u1` with extra ghost field `bypass: true` -> `PERMISSION_DENIED`.
9. **ID Poisoning**: Creating `/users/u1/wheels/bad$id` -> `PERMISSION_DENIED`.
10. **Entries Array Exhaustion**: Creating a wheel with 201 entries -> `PERMISSION_DENIED`.
11. **Client Timestamp Forgery**: Creating a wheel with a backdated `createdAt` -> `PERMISSION_DENIED`.
12. **Self-Adding to /admins**: Non-admin creating `/admins/u1` -> `PERMISSION_DENIED`.
13. **Passcode Bypass / Inactive Passcode Registration**: Creating `/passcodeMembers/pm_...` using a nonexistent or `active: false` passcode -> `PERMISSION_DENIED`.
14. **Passcode Enumeration**: Non-admin calling `list` on `/passcodes` or `/passcodeMembers` -> `PERMISSION_DENIED`.
15. **Non-Admin Passcode Minting**: Non-admin creating or modifying `/passcodes/{codeId}` -> `PERMISSION_DENIED`.
16. **Unauthorized App Config Write**: Non-admin modifying `/appConfig/public` -> `PERMISSION_DENIED`.


