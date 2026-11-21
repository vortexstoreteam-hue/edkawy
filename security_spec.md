# Edkawy Security Specification (Phase 0 TDD)

## 1. Data Invariants
1. **Order & Dispatch Atomicity**: Every creation of `/orders/{orderId}` MUST atomically create `/dispatchQueue/{orderId}` in the same batch (`existsAfter`), and vice versa, without exceeding Firestore's 10-document-lookup batch limit.
2. **Order Types & Transitions**:
   - `standard`: Requires active, open `/stores/{storeId}` and `status == 'pending'`.
   - `pharmacy_prescription`: Requires active, open pharmacy store and `status == 'awaiting_pharmacy_quote'`.
   - `custom_errand`: Uses `storeId == 'edkawy_errands'`, `status == 'awaiting_courier_quote'`; only an approved courier (`isApprovedCourier()`) may quote `deliveryFee` (`10..500`) -> `status == 'awaiting_customer_errand_approval'`, and only `customerId == request.auth.uid` may approve -> `status == 'on_the_way'`.
3. **Zero O(n) Lookups in List Rules**: No `allow list` rule in `firestore.rules` may invoke `get()` or `exists()`. All `allow list` rules strictly evaluate `resource.data` (`existing()`).
4. **Staff RBAC Isolation (`/staff/{staffId}`)**: Only verified Super Admins (`isAdmin()`) can create, update, or toggle `isActive` on `/staff/{staffId}` and `/supportAgentsPool/{staffId}`.
5. **PII Split Isolation for Support (`/support_tickets` vs `/supportTicketIndex`)**:
   - `/support_tickets/{ticketId}` stores user phone/name PII and restricts `get` to ticket creator (`userId`), assigned support agent (`assignedTo`), active support staff (`isSupportStaff()`), or `isAdmin()`.
   - `/supportTicketIndex/{ticketId}` stores non-PII operational metadata (`status`, `category`, `assignedTo`, `hasAdminReply`, `lastUpdated`) for live zero-`get()` Admin queue streaming.
   - `/support_messages/{messageId}` enforces bounded `participants` (`size() >= 1 && size() <= 5`) and verifies `senderId == request.auth.uid`.

## 2. The "Dirty Dozen" Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Shadow Privilege Escalation on `/users/{uid}`**: `{ role: "admin", isSuperAdmin: true, createdAt: SERVER_TIMESTAMP, updatedAt: SERVER_TIMESTAMP }` -> Rejected by `hasOnly(...)` and `isVerifiedSelfRoleAssignment`.
2. **Self-Creation of `/staff/{uid}` by Regular Customer**: `{ id: uid, name: "Hacker", email: "x@y.com", role: "super_admin", isActive: true, openTicketCount: 0, createdBy: uid, createdAt: SERVER_TIMESTAMP, updatedAt: SERVER_TIMESTAMP }` -> Rejected by `isAdmin()`.
3. **Support Ticket Spoofed `userId`**: `{ userId: "victim_uid", userName: "Spoof", ... }` -> Rejected by `incoming().userId == request.auth.uid`.
4. **Support Ticket Status Shortcut on Create**: Creating `/support_tickets/{id}` with `status: "closed"` or `hasAdminReply: true` -> Rejected by `incoming().status == 'open' && incoming().hasAdminReply == false`.
5. **Unbounded Array Poisoning on `/support_messages/{id}`**: `participants` array of 500 UIDs -> Rejected by `data.participants.size() >= 1 && data.participants.size() <= 5`.
6. **1MB String Resource Exhaustion on `/support_messages/{id}`**: `text` with 50,000 chars -> Rejected by `data.text.size() >= 1 && data.text.size() <= 1500`.
7. **Unauthorized PII Read on `/support_tickets/{id}`**: Random customer attempting `getDoc` on another customer's ticket -> Rejected by `existing().userId == request.auth.uid || ...`.
8. **Orphaned Order Write without Dispatch Ticket**: Writing `/orders/{orderId}` alone without `/dispatchQueue/{orderId}` -> Rejected by `existsAfter(/databases/$(database)/documents/dispatchQueue/$(orderId))`.
9. **Unapproved Courier Quoting Custom Errand**: Pending courier (`approvalStatus == 'pending'`) attempting to quote `deliveryFee` on `custom_errand` -> Rejected by `isApprovedCourier()`.
10. **Customer Self-Marking Order `delivered` to Farm Loyalty Points**: Customer updating `status: 'delivered', pointsEarned: 99999` -> Rejected by `isAllowedOrderTransition` requiring `isApprovedCourier()`.
11. **Terminal State Resurrection**: Attempting to transition a `'delivered'` or `'cancelled'` order back to `'on_the_way'` by non-admin -> Rejected by `!(ext.status in ['delivered', 'cancelled'])`.
12. **Client-Spoofed Timestamp**: Passing past/future client `Timestamp` instead of `serverTimestamp()` -> Rejected by `incoming().createdAt == request.time` / `incoming().updatedAt == request.time`.
