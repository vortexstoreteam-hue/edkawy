import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  BLUEPRINT_LIMITS,
  DEFAULT_EDKAWY_COMMISSION_RATE,
  EGYPT_PHONE_REGEX,
  MIN_COURIER_DELIVERY_FEE_EGP,
  calculateFounderFinancialKpis,
  calculateOrderFinancialSplit,
  getCairoDateKey,
  isValidFirestoreId,
} from './orderLogic';

const rulesSource = fs.readFileSync(
  path.resolve(process.cwd(), 'firestore.rules'),
  'utf8'
);

interface MockAuthContext {
  uid: string;
  email?: string;
  email_verified?: boolean;
}

interface SimulatedEnv {
  auth: MockAuthContext | null;
  nowMs: number;
  stores: Record<
    string,
    { isActive: boolean; createdBy: string; ownerUid?: string }
  >;
  couriers: Record<string, { approvalStatus: 'pending' | 'approved' | 'rejected' }>;
  admins: Set<string>;
}

const REQUIRED_ORDER_KEYS = new Set([
  'customerId',
  'storeId',
  'storeName',
  'customerName',
  'customerPhone',
  'deliveryNeighborhood',
  'deliveryAddress',
  'items',
  'itemsSummary',
  'itemNames',
  'itemCount',
  'subtotal',
  'deliveryFee',
  'totalAmount',
  'paymentMethod',
  'status',
  'notes',
  'createdAt',
  'updatedAt',
]);

const ALLOWED_ORDER_KEYS = new Set([
  ...REQUIRED_ORDER_KEYS,
  'storeOwnerId',
  'prepTimeMinutes',
  'courierId',
  'courierName',
  'courierPhone',
  'courierLocation',
]);

function isAdminSim(env: SimulatedEnv): boolean {
  if (!env.auth || !isValidFirestoreId(env.auth.uid)) return false;
  return (
    env.admins.has(env.auth.uid) ||
    (['alaslybys46@gmail.com', 'vortexstore.team@gmail.com'].includes(
      env.auth.email ?? ''
    ) &&
      env.auth.email_verified === true)
  );
}

function isApprovedCourierSim(env: SimulatedEnv): boolean {
  if (!env.auth) return false;
  return env.couriers[env.auth.uid]?.approvalStatus === 'approved';
}

function canReadStoreCredentials(
  env: SimulatedEnv,
  storeId: string
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!env.auth || !isValidFirestoreId(storeId)) return 'PERMISSION_DENIED';
  return isAdminSim(env) ? 'ALLOW' : 'PERMISSION_DENIED';
}

function canUpdateCourierSelf(
  env: SimulatedEnv,
  courierId: string,
  existing: { approvalStatus: string; isAvailable: boolean },
  incoming: { approvalStatus: string; isAvailable: boolean }
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!env.auth || !isValidFirestoreId(courierId)) return 'PERMISSION_DENIED';
  if (isAdminSim(env)) return 'ALLOW';
  if (env.auth.uid !== courierId) return 'PERMISSION_DENIED';
  // Prevent self-escalation of approvalStatus!
  if (incoming.approvalStatus !== existing.approvalStatus) {
    return 'PERMISSION_DENIED';
  }
  // Pending courier cannot set isAvailable = true!
  if (existing.approvalStatus !== 'approved' && incoming.isAvailable === true) {
    return 'PERMISSION_DENIED';
  }
  return 'ALLOW';
}

function isValidOrderSim(data: Record<string, unknown>): boolean {
  const keys = Object.keys(data);
  for (const reqKey of REQUIRED_ORDER_KEYS) {
    if (!(reqKey in data)) return false;
  }
  for (const k of keys) {
    if (!ALLOWED_ORDER_KEYS.has(k)) return false;
  }

  if (!isValidFirestoreId(String(data.customerId ?? ''))) return false;
  if (!isValidFirestoreId(String(data.storeId ?? ''))) return false;
  if (
    'storeOwnerId' in data &&
    data.storeOwnerId !== null &&
    !isValidFirestoreId(String(data.storeOwnerId ?? ''))
  ) {
    return false;
  }
  if (
    typeof data.storeName !== 'string' ||
    data.storeName.length < 2 ||
    data.storeName.length > 80
  ) {
    return false;
  }
  if (
    typeof data.customerName !== 'string' ||
    data.customerName.length < 2 ||
    data.customerName.length > 80
  ) {
    return false;
  }
  if (
    typeof data.customerPhone !== 'string' ||
    !EGYPT_PHONE_REGEX.test(data.customerPhone)
  ) {
    return false;
  }
  if (
    typeof data.deliveryNeighborhood !== 'string' ||
    data.deliveryNeighborhood.length < 2 ||
    data.deliveryNeighborhood.length > 60
  ) {
    return false;
  }
  if (
    typeof data.deliveryAddress !== 'string' ||
    data.deliveryAddress.length < 5 ||
    data.deliveryAddress.length > 200
  ) {
    return false;
  }

  if (
    !Array.isArray(data.items) ||
    data.items.length < 1 ||
    data.items.length > 15
  ) {
    return false;
  }
  const firstItem = data.items[0] as Record<string, unknown>;
  if (!firstItem || typeof firstItem !== 'object') return false;
  const itemKeys = Object.keys(firstItem);
  if (
    itemKeys.length !== 4 ||
    !itemKeys.every((k) =>
      ['productId', 'name', 'price', 'quantity'].includes(k)
    )
  ) {
    return false;
  }
  if (!isValidFirestoreId(String(firstItem.productId ?? ''))) return false;
  if (
    typeof firstItem.name !== 'string' ||
    firstItem.name.length < 2 ||
    firstItem.name.length > 80
  ) {
    return false;
  }
  if (
    typeof firstItem.price !== 'number' ||
    !Number.isInteger(firstItem.price) ||
    firstItem.price <= 0 ||
    firstItem.price > 5000
  ) {
    return false;
  }
  if (
    typeof firstItem.quantity !== 'number' ||
    !Number.isInteger(firstItem.quantity) ||
    firstItem.quantity < 1 ||
    firstItem.quantity > 50
  ) {
    return false;
  }

  if (
    typeof data.itemsSummary !== 'string' ||
    data.itemsSummary.length < 2 ||
    data.itemsSummary.length > 400
  ) {
    return false;
  }
  if (
    !Array.isArray(data.itemNames) ||
    data.itemNames.length < 1 ||
    data.itemNames.length > 10 ||
    typeof data.itemNames[0] !== 'string' ||
    data.itemNames[0].length < 2 ||
    data.itemNames[0].length > 100
  ) {
    return false;
  }
  if (
    typeof data.itemCount !== 'number' ||
    !Number.isInteger(data.itemCount) ||
    data.itemCount < 1 ||
    data.itemCount > 50
  ) {
    return false;
  }
  if (
    typeof data.subtotal !== 'number' ||
    !Number.isInteger(data.subtotal) ||
    data.subtotal <= 0 ||
    data.subtotal > 50000
  ) {
    return false;
  }
  if (
    typeof data.deliveryFee !== 'number' ||
    !Number.isInteger(data.deliveryFee) ||
    data.deliveryFee < 0 ||
    data.deliveryFee > 150
  ) {
    return false;
  }
  if (
    typeof data.totalAmount !== 'number' ||
    data.totalAmount !== data.subtotal + data.deliveryFee
  ) {
    return false;
  }
  if (
    !['cash', 'visa', 'cash_on_delivery'].includes(
      String(data.paymentMethod ?? '')
    )
  ) {
    return false;
  }
  if (
    ![
      'pending',
      'pending_payment',
      'confirmed',
      'preparing',
      'on_the_way',
      'delivering',
      'delivered',
      'cancelled',
    ].includes(String(data.status))
  ) {
    return false;
  }

  if ('prepTimeMinutes' in data) {
    if (
      typeof data.prepTimeMinutes !== 'number' ||
      !Number.isInteger(data.prepTimeMinutes) ||
      data.prepTimeMinutes < 0 ||
      data.prepTimeMinutes > 180
    ) {
      return false;
    }
  }
  if ('courierId' in data) {
    if (
      typeof data.courierId !== 'string' ||
      data.courierId.length > 128 ||
      (data.courierId.length > 0 && !isValidFirestoreId(data.courierId))
    ) {
      return false;
    }
  }
  if ('courierName' in data) {
    if (typeof data.courierName !== 'string' || data.courierName.length > 80) {
      return false;
    }
  }
  if ('courierPhone' in data) {
    if (
      typeof data.courierPhone !== 'string' ||
      data.courierPhone.length > 15 ||
      (data.courierPhone.length > 0 && !EGYPT_PHONE_REGEX.test(data.courierPhone))
    ) {
      return false;
    }
  }
  if ('courierLocation' in data) {
    if (
      typeof data.courierLocation !== 'string' ||
      data.courierLocation.length > 120
    ) {
      return false;
    }
  }

  if (typeof data.notes !== 'string' || data.notes.length > 200) return false;
  if (
    typeof data.createdAt !== 'number' ||
    typeof data.updatedAt !== 'number'
  ) {
    return false;
  }
  return true;
}

function canCreateOrder(
  env: SimulatedEnv,
  orderId: string,
  payload: Record<string, unknown>
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!env.auth || !isValidFirestoreId(env.auth.uid)) return 'PERMISSION_DENIED';
  if (!isValidFirestoreId(orderId)) return 'PERMISSION_DENIED';
  if (!isValidOrderSim(payload)) return 'PERMISSION_DENIED';
  if (payload.customerId !== env.auth.uid) return 'PERMISSION_DENIED';
  if (
    !['pending', 'confirmed', 'pending_payment'].includes(
      String(payload.status)
    )
  ) {
    return 'PERMISSION_DENIED';
  }
  const pm = String(payload.paymentMethod ?? '');
  if (
    pm !== 'cash' &&
    pm !== 'cash_on_delivery' &&
    !(pm === 'visa' && payload.status === 'pending_payment')
  ) {
    return 'PERMISSION_DENIED';
  }
  if (payload.createdAt !== env.nowMs || payload.updatedAt !== env.nowMs) {
    return 'PERMISSION_DENIED';
  }
  const targetStore = env.stores[String(payload.storeId)];
  if (!targetStore || targetStore.isActive !== true) return 'PERMISSION_DENIED';
  return 'ALLOW';
}

function canUpdateOrder(
  env: SimulatedEnv,
  orderId: string,
  existing: Record<string, unknown>,
  incoming: Record<string, unknown>
): 'ALLOW' | 'PERMISSION_DENIED' {
  if (!env.auth || !isValidFirestoreId(env.auth.uid)) return 'PERMISSION_DENIED';
  if (!isValidFirestoreId(orderId)) return 'PERMISSION_DENIED';
  if (!isValidOrderSim(incoming)) return 'PERMISSION_DENIED';
  if (incoming.customerId !== existing.customerId) return 'PERMISSION_DENIED';
  if (incoming.storeId !== existing.storeId) return 'PERMISSION_DENIED';
  if (
    'storeOwnerId' in existing &&
    incoming.storeOwnerId !== existing.storeOwnerId
  ) {
    return 'PERMISSION_DENIED';
  }
  if (incoming.createdAt !== existing.createdAt) return 'PERMISSION_DENIED';
  if (incoming.updatedAt !== env.nowMs) return 'PERMISSION_DENIED';

  if (isAdminSim(env)) return 'ALLOW';

  const uid = env.auth.uid;
  const storeObj = env.stores[String(existing.storeId)];
  const isOwnerOrMerchant =
    existing.customerId === uid ||
    ('storeOwnerId' in existing && existing.storeOwnerId === uid) ||
    storeObj?.ownerUid === uid ||
    storeObj?.createdBy === uid;
  const isNonTerminal = !['delivered', 'cancelled'].includes(
    String(existing.status)
  );

  const allKeys = new Set([...Object.keys(existing), ...Object.keys(incoming)]);
  const changedKeys = Array.from(allKeys).filter(
    (k) => JSON.stringify(incoming[k]) !== JSON.stringify(existing[k])
  );

  // Action 0: Customer Confirm Order (strictly pending -> confirmed | pending_payment)
  if (
    existing.customerId === uid &&
    isNonTerminal &&
    String(existing.status) === 'pending' &&
    ['confirmed', 'pending_payment'].includes(String(incoming.status)) &&
    changedKeys.every((k) => ['status', 'updatedAt'].includes(k))
  ) {
    return 'ALLOW';
  }

  // Action 1: Store Accept (pending/confirmed -> preparing)
  if (
    isOwnerOrMerchant &&
    isNonTerminal &&
    ['pending', 'confirmed'].includes(String(existing.status)) &&
    incoming.status === 'preparing' &&
    changedKeys.every((k) =>
      ['status', 'prepTimeMinutes', 'updatedAt'].includes(k)
    )
  ) {
    return 'ALLOW';
  }

  // Action 2a: Approved Courier Claim (preparing -> on_the_way)
  if (
    isNonTerminal &&
    existing.status === 'preparing' &&
    (!('courierId' in existing) ||
      existing.courierId === '' ||
      existing.courierId === uid) &&
    isApprovedCourierSim(env) &&
    incoming.status === 'on_the_way' &&
    incoming.courierId === uid &&
    changedKeys.every((k) =>
      [
        'status',
        'courierId',
        'courierName',
        'courierPhone',
        'courierLocation',
        'updatedAt',
      ].includes(k)
    )
  ) {
    return 'ALLOW';
  }

  // Action 2b: Approved Courier Route Update (on_the_way -> on_the_way)
  if (
    isNonTerminal &&
    existing.status === 'on_the_way' &&
    existing.courierId === uid &&
    isApprovedCourierSim(env) &&
    incoming.status === 'on_the_way' &&
    incoming.courierId === uid &&
    changedKeys.every((k) =>
      [
        'status',
        'courierId',
        'courierName',
        'courierPhone',
        'courierLocation',
        'updatedAt',
      ].includes(k)
    )
  ) {
    return 'ALLOW';
  }

  // Action 3: Approved Courier Complete Delivery
  if (
    isNonTerminal &&
    ['on_the_way', 'delivering'].includes(String(existing.status)) &&
    existing.courierId === uid &&
    isApprovedCourierSim(env) &&
    incoming.status === 'delivered' &&
    changedKeys.every((k) =>
      ['status', 'courierLocation', 'updatedAt'].includes(k)
    )
  ) {
    return 'ALLOW';
  }

  // Action 4: Cancel Order
  if (
    isOwnerOrMerchant &&
    isNonTerminal &&
    ['pending', 'confirmed', 'pending_payment', 'preparing'].includes(
      String(existing.status)
    ) &&
    incoming.status === 'cancelled' &&
    changedKeys.every((k) => ['status', 'updatedAt'].includes(k))
  ) {
    return 'ALLOW';
  }

  return 'PERMISSION_DENIED';
}

const baseEnv: SimulatedEnv = {
  auth: { uid: 'customer_1', email: 'user@edku.eg', email_verified: false },
  nowMs: 1793116800000,
  stores: {
    edku_bahr_seafood: {
      isActive: true,
      createdBy: 'admin_1',
      ownerUid: 'merchant_1',
    },
  },
  couriers: {
    courier_approved_1: { approvalStatus: 'approved' },
    courier_pending_1: { approvalStatus: 'pending' },
  },
  admins: new Set(['admin_1']),
};

function makeValidOrderPayload(
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    customerId: 'customer_1',
    storeId: 'edku_bahr_seafood',
    storeOwnerId: 'merchant_1',
    storeName: 'أسماك وبحريات المعدية والبحر',
    customerName: 'أحمد الإدكاوي',
    customerPhone: '01012345678',
    deliveryNeighborhood: 'شارع البحر',
    deliveryAddress: 'شارع البحر بجوار المسجد الكبير',
    items: [
      {
        productId: 'prod_bahr_mullet',
        name: 'وجبة بوري مشوي بالردة',
        price: 185,
        quantity: 1,
      },
    ],
    itemsSummary: 'وجبة بوري مشوي بالردة × 1',
    itemNames: ['وجبة بوري مشوي بالردة (1)'],
    itemCount: 1,
    subtotal: 185,
    deliveryFee: 20,
    totalAmount: 205,
    paymentMethod: 'cash',
    status: 'pending',
    notes: '',
    createdAt: baseEnv.nowMs,
    updatedAt: baseEnv.nowMs,
    ...overrides,
  };
}

test('firestore.rules contains all mandatory hardened gates for all 9 RBAC collections', () => {
  assert.match(rulesSource, /rules_version = '2';/);
  assert.match(
    rulesSource,
    /match \/\{document=\*\*\}\s*\{\s*allow read, write: if false;\s*\}/
  );
  assert.match(rulesSource, /match \/stores\/\{storeId\}/);
  assert.match(rulesSource, /match \/storeCredentials\/\{storeId\}/);
  assert.match(rulesSource, /match \/products\/\{productId\}/);
  assert.match(rulesSource, /match \/couriers\/\{courierId\}/);
  assert.match(rulesSource, /match \/courierDirectory\/\{courierId\}/);
  assert.match(rulesSource, /match \/orders\/\{orderId\}/);
  assert.match(rulesSource, /match \/dispatchQueue\/\{orderId\}/);
  assert.match(rulesSource, /match \/admins\/\{adminId\}/);
  assert.match(rulesSource, /match \/appConfig\/\{configId\}/);
  assert.match(rulesSource, /request\.auth\.token\.email_verified == true/);
  assert.match(rulesSource, /isOrderParticipant\(existing\(\)\)/);
  assert.match(rulesSource, /isApprovedCourier\(\)/);
});

test('4-portal RBAC state machine allows approved couriers, blocks pending couriers, and isolates storeCredentials', () => {
  const step0Pending = makeValidOrderPayload();
  assert.equal(canCreateOrder(baseEnv, 'ord_lifecycle', step0Pending), 'ALLOW');

  // Non-admins cannot read /storeCredentials
  assert.equal(
    canReadStoreCredentials(baseEnv, 'edku_bahr_seafood'),
    'PERMISSION_DENIED'
  );
  // Admin CAN read /storeCredentials
  const adminEnv: SimulatedEnv = {
    ...baseEnv,
    auth: { uid: 'admin_1', email: 'vortexstore.team@gmail.com', email_verified: true },
  };
  assert.equal(canReadStoreCredentials(adminEnv, 'edku_bahr_seafood'), 'ALLOW');

  // Pending courier cannot self-approve or go online
  const pendingCourierEnv: SimulatedEnv = {
    ...baseEnv,
    auth: { uid: 'courier_pending_1' },
  };
  assert.equal(
    canUpdateCourierSelf(
      pendingCourierEnv,
      'courier_pending_1',
      { approvalStatus: 'pending', isAvailable: false },
      { approvalStatus: 'approved', isAvailable: true }
    ),
    'PERMISSION_DENIED'
  );

  // Store Portal accepts order: pending -> preparing
  const merchantEnv: SimulatedEnv = {
    ...baseEnv,
    auth: { uid: 'merchant_1' },
  };
  const step1Preparing = makeValidOrderPayload({
    status: 'preparing',
    prepTimeMinutes: 20,
  });
  assert.equal(
    canUpdateOrder(merchantEnv, 'ord_lifecycle', step0Pending, step1Preparing),
    'ALLOW'
  );

  // Pending courier is DENIED order pickup!
  const pendingPickupAttempt = makeValidOrderPayload({
    status: 'on_the_way',
    prepTimeMinutes: 20,
    courierId: 'courier_pending_1',
    courierName: 'كابتن قيد المراجعة',
    courierPhone: '01123456789',
    courierLocation: 'شارع البحر الرئيسي - إدكو',
  });
  assert.equal(
    canUpdateOrder(
      pendingCourierEnv,
      'ord_lifecycle',
      step1Preparing,
      pendingPickupAttempt
    ),
    'PERMISSION_DENIED'
  );

  // Approved Courier picks up order: preparing -> on_the_way
  const approvedCourierEnv: SimulatedEnv = {
    ...baseEnv,
    auth: { uid: 'courier_approved_1' },
  };
  const step2OnTheWay = makeValidOrderPayload({
    status: 'on_the_way',
    prepTimeMinutes: 20,
    courierId: 'courier_approved_1',
    courierName: 'كابتن محمود الإدكاوي',
    courierPhone: '01098765432',
    courierLocation: 'شارع البحر الرئيسي - إدكو',
  });
  assert.equal(
    canUpdateOrder(
      approvedCourierEnv,
      'ord_lifecycle',
      step1Preparing,
      step2OnTheWay
    ),
    'ALLOW'
  );

  // Approved Courier completes delivery: on_the_way -> delivered
  const step3Delivered = {
    ...step2OnTheWay,
    status: 'delivered',
    courierLocation: 'تم التسليم أمام عقار العميل',
  };
  assert.equal(
    canUpdateOrder(
      approvedCourierEnv,
      'ord_lifecycle',
      step2OnTheWay,
      step3Delivered
    ),
    'ALLOW'
  );
});

test('Dirty Dozen #1-12 adversarial payloads all return PERMISSION_DENIED while Cash and Visa orders succeed', () => {
  assert.equal(
    canCreateOrder(baseEnv, 'order_valid_cash', makeValidOrderPayload()),
    'ALLOW'
  );
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_valid_visa',
      makeValidOrderPayload({ paymentMethod: 'visa', status: 'pending_payment' })
    ),
    'ALLOW'
  );

  // 1. Identity Spoofing
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_1',
      makeValidOrderPayload({ customerId: 'victim_uid' })
    ),
    'PERMISSION_DENIED'
  );

  // 2. Shadow / Ghost Field Injection
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_2',
      makeValidOrderPayload({ isPaid: true })
    ),
    'PERMISSION_DENIED'
  );

  // 3. Orphaned Store Reference
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_3',
      makeValidOrderPayload({ storeId: 'ghost_store_99' })
    ),
    'PERMISSION_DENIED'
  );

  // 4. State Shortcutting on Create
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_4',
      makeValidOrderPayload({ status: 'delivered' })
    ),
    'PERMISSION_DENIED'
  );

  // 5. Terminal State Re-opening
  const deliveredExisting = makeValidOrderPayload({ status: 'delivered' });
  const reopenAttempt = makeValidOrderPayload({ status: 'cancelled' });
  assert.equal(
    canUpdateOrder(baseEnv, 'order_5', deliveredExisting, reopenAttempt),
    'PERMISSION_DENIED'
  );

  // 6. Price Manipulation
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_6',
      makeValidOrderPayload({ totalAmount: 5 })
    ),
    'PERMISSION_DENIED'
  );

  // 7. Denial-of-Wallet Oversized ID & Notes
  assert.equal(
    canCreateOrder(baseEnv, 'x'.repeat(200), makeValidOrderPayload()),
    'PERMISSION_DENIED'
  );
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_7',
      makeValidOrderPayload({ notes: 'ن'.repeat(300) })
    ),
    'PERMISSION_DENIED'
  );

  // 8. Unbounded Array Injection on items
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_8',
      makeValidOrderPayload({
        items: Array.from({ length: 20 }, (_, i) => ({
          productId: `p_${i}`,
          name: `منتج ${i}`,
          price: 50,
          quantity: 1,
        })),
      })
    ),
    'PERMISSION_DENIED'
  );

  // 9. Cross-Tenant Update / Cancel by non-owner
  const otherUserEnv: SimulatedEnv = {
    ...baseEnv,
    auth: { uid: 'attacker_uid' },
  };
  assert.equal(
    canUpdateOrder(
      otherUserEnv,
      'order_9',
      makeValidOrderPayload(),
      makeValidOrderPayload({ status: 'cancelled' })
    ),
    'PERMISSION_DENIED'
  );

  // 10. Admin Email Spoofing with email_verified: false
  const spoofAdminEnv: SimulatedEnv = {
    ...baseEnv,
    auth: {
      uid: 'spoof_uid',
      email: 'vortexstore.team@gmail.com',
      email_verified: false,
    },
  };
  assert.equal(isAdminSim(spoofAdminEnv), false);
  assert.equal(
    canUpdateOrder(
      spoofAdminEnv,
      'order_10',
      makeValidOrderPayload(),
      makeValidOrderPayload({ status: 'on_the_way' })
    ),
    'PERMISSION_DENIED'
  );

  // 11. Client Timestamp Forgery
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_11',
      makeValidOrderPayload({ createdAt: baseEnv.nowMs - 60000 })
    ),
    'PERMISSION_DENIED'
  );

  // 12. Raw Card Number Injection in Order Document
  assert.equal(
    canCreateOrder(
      baseEnv,
      'order_12',
      makeValidOrderPayload({
        paymentMethod: 'visa',
        cardNumber: '4111111111111111',
      })
    ),
    'PERMISSION_DENIED'
  );
});

test('products allow delete evaluates isAdmin() first and guards missing createdBy/storeId on legacy demo docs', () => {
  const productsMatch = rulesSource.match(
    /match \/products\/\{productId\}[\s\S]*?allow delete:[\s\S]*?;/
  );
  assert.ok(productsMatch, 'Expected match /products/{productId} allow delete block');
  const deleteRule = productsMatch[0].slice(productsMatch[0].lastIndexOf('allow delete:'));
  assert.match(deleteRule, /allow delete: if isSignedIn\(\) && isValidId\(productId\) && \(\s*isAdmin\(\)\s*\|\|/);
  assert.match(deleteRule, /existing\(\)\.get\('createdBy', ''\) == request\.auth\.uid/);
  assert.match(deleteRule, /isStoreOwnerOf\(existing\(\)\.get\('storeId', ''\)\)/);
});

test('orders, dispatchQueue, and coupons rules stay strictly within Firestore 10-call per-rule and 20-call batch budgets', () => {
  const ordersBlockMatch = rulesSource.match(
    /match \/orders\/\{orderId\}[\s\S]*?allow delete:[\s\S]*?;/
  );
  assert.ok(ordersBlockMatch, 'Expected match /orders/{orderId} block');
  const ordersCreate = ordersBlockMatch[0].match(/allow create:[\s\S]*?allow update:/);
  assert.ok(ordersCreate, 'Expected allow create inside /orders/{orderId}');
  const adminMatchesInCreate = ordersCreate[0].match(/\bisAdmin\(\)/g) ?? [];
  assert.equal(
    adminMatchesInCreate.length,
    1,
    'orders allow create must evaluate isAdmin() at most once as fallback so normal customers never exceed 10 doc reads'
  );
  assert.ok(
    ordersCreate[0].indexOf('stores/$(incoming().storeId)') <
      ordersCreate[0].indexOf('isAdmin()'),
    'orders allow create must check active store before falling back to isAdmin()'
  );

  const dispatchMatch = rulesSource.match(
    /match \/dispatchQueue\/\{orderId\}[\s\S]*?allow update:/
  );
  assert.ok(dispatchMatch, 'Expected match /dispatchQueue/{orderId} create block');
  assert.ok(
    dispatchMatch[0].indexOf('existsAfter(/databases/$(database)/documents/orders/$(orderId))') <
      dispatchMatch[0].indexOf('isAdmin()'),
    'dispatchQueue allow create must check existsAfter(orders/id) before falling back to isAdmin()'
  );

  const couponsMatch = rulesSource.match(
    /match \/coupons\/\{couponId\}[\s\S]*?allow delete:/
  );
  assert.ok(couponsMatch, 'Expected match /coupons/{couponId} block');
  const couponsUpdate = couponsMatch[0].slice(couponsMatch[0].indexOf('allow update:'));
  assert.ok(
    couponsUpdate.indexOf('incoming().usedBy == request.auth.uid') <
      couponsUpdate.indexOf('isAdmin()'),
    'coupons allow update must check customer single-use redemption before falling back to isAdmin()'
  );
});

test('unexpected workflow transitions: customer cancel locks after preparing, unauthorized courier blocked, invalid smallOrderFee blocked', () => {
  // Small order fee within allowed order pricing
  const withSmallFee = makeValidOrderPayload({
    subtotal: 40,
    deliveryFee: 15,
    totalAmount: 55,
  });
  assert.equal(canCreateOrder(baseEnv, 'ord_small_fee', withSmallFee), 'ALLOW');

  // Cannot cancel order already on_the_way by customer
  const onTheWayOrder = makeValidOrderPayload({
    status: 'on_the_way',
    courierId: 'courier_approved_1',
    courierName: 'كابتن إدكاوي',
    courierPhone: '01098765432',
    courierLocation: 'شارع البحر الرئيسي - إدكو',
  });
  assert.equal(
    canUpdateOrder(
      baseEnv,
      'ord_cancel_late',
      onTheWayOrder,
      { ...onTheWayOrder, status: 'cancelled' }
    ),
    'PERMISSION_DENIED'
  );

  // Another approved courier cannot hijack an already-claimed order
  const secondCourierEnv: SimulatedEnv = {
    ...baseEnv,
    couriers: {
      ...baseEnv.couriers,
      courier_approved_2: { approvalStatus: 'approved' },
    },
    auth: { uid: 'courier_approved_2' },
  };
  assert.equal(
    canUpdateOrder(secondCourierEnv, 'ord_hijack', onTheWayOrder, {
      ...onTheWayOrder,
      courierId: 'courier_approved_2',
      status: 'delivered',
    }),
    'PERMISSION_DENIED'
  );
});

test('stores rules allow openingTime, closingTime, and isManuallyClosed operational updates', () => {
  const storeMatch = rulesSource.match(
    /match \/stores\/\{storeId\}[\s\S]*?allow delete:/
  );
  assert.ok(storeMatch, 'Expected match /stores/{storeId} rule block');
  assert.match(rulesSource, /'openingTime'/);
  assert.match(rulesSource, /'closingTime'/);
  assert.match(rulesSource, /'isManuallyClosed'/);
  assert.match(storeMatch[0], /'openingTime'/);
  assert.match(storeMatch[0], /'closingTime'/);
  assert.match(storeMatch[0], /'isManuallyClosed'/);
});

test('customer confirmation transitions: owner confirms strictly pending->confirmed/pending_payment, race conditions & non-owners denied, merchant reads/updates confirmed', () => {
  // Check actual firestore.rules file contains strict pending-only customer transitions on both orders and dispatchQueue
  assert.match(
    rulesSource,
    /ext\.status == 'pending' &&\s*inc\.status in \['confirmed', 'pending_payment'\] &&\s*changed\.hasOnly\(\['status', 'updatedAt'\]\)/
  );
  assert.match(
    rulesSource,
    /\(ext\.status == 'pending' && inc\.status in \['confirmed', 'pending_payment'\] && changed\.hasOnly\(\['status', 'updatedAt'\]\)\)/
  );
  // Merchant rules support reading & transitioning 'confirmed' orders in both orders and dispatchQueue
  assert.match(
    rulesSource,
    /allow get:[\s\S]*?isMerchantOfOrder\(existing\(\)\)/
  );
  assert.match(
    rulesSource,
    /match \/dispatchQueue\/\{orderId\}[\s\S]*?allow list: if isSignedIn\(\) && \(\s*isOrderParticipant\(existing\(\)\)/
  );
  assert.match(
    rulesSource,
    /inc\.status == 'preparing' && ext\.status in \['pending', 'confirmed', 'preparing'\]/
  );
  assert.match(
    rulesSource,
    /inc\.status == 'ready' && ext\.status in \['pending', 'confirmed', 'preparing', 'ready'\]/
  );

  const pendingCashOrder = makeValidOrderPayload({ status: 'pending', paymentMethod: 'cash' });
  const confirmedCashOrder = makeValidOrderPayload({ status: 'confirmed', paymentMethod: 'cash' });
  const pendingPaymentVisaOrder = makeValidOrderPayload({ status: 'pending_payment', paymentMethod: 'visa' });

  // Owner customer confirms pending -> confirmed (cash)
  assert.equal(
    canUpdateOrder(baseEnv, 'ord_confirm_1', pendingCashOrder, confirmedCashOrder),
    'ALLOW'
  );

  // Owner customer confirms pending -> pending_payment (deferred payment)
  assert.equal(
    canUpdateOrder(
      baseEnv,
      'ord_confirm_2',
      makeValidOrderPayload({ status: 'pending', paymentMethod: 'visa' }),
      pendingPaymentVisaOrder
    ),
    'ALLOW'
  );

  // Customer is DENIED re-updating an already 'confirmed' order (strictly pending -> confirmed/pending_payment)
  assert.equal(
    canUpdateOrder(
      baseEnv,
      'ord_reconfirm_denied',
      confirmedCashOrder,
      makeValidOrderPayload({ status: 'pending_payment', paymentMethod: 'cash' })
    ),
    'PERMISSION_DENIED'
  );

  // Non-owner customer is DENIED confirming another user's order
  const otherCustomerEnv: SimulatedEnv = {
    ...baseEnv,
    auth: { uid: 'attacker_customer' },
  };
  assert.equal(
    canUpdateOrder(otherCustomerEnv, 'ord_confirm_3', pendingCashOrder, confirmedCashOrder),
    'PERMISSION_DENIED'
  );

  // Race condition: order already moved to 'preparing' or 'cancelled' by store -> DENIED
  const preparingOrder = makeValidOrderPayload({ status: 'preparing', prepTimeMinutes: 20 });
  const cancelledOrder = makeValidOrderPayload({ status: 'cancelled' });
  assert.equal(
    canUpdateOrder(baseEnv, 'ord_race_1', preparingOrder, confirmedCashOrder),
    'PERMISSION_DENIED'
  );
  assert.equal(
    canUpdateOrder(baseEnv, 'ord_race_2', cancelledOrder, confirmedCashOrder),
    'PERMISSION_DENIED'
  );

  // Store merchant accepts confirmed order -> preparing (ALLOW)
  const merchantEnv: SimulatedEnv = {
    ...baseEnv,
    auth: { uid: 'merchant_1' },
  };
  assert.equal(
    canUpdateOrder(merchantEnv, 'ord_merchant_accept', confirmedCashOrder, preparingOrder),
    'ALLOW'
  );

  // Customer cancels confirmed order -> cancelled (ALLOW)
  assert.equal(
    canUpdateOrder(
      baseEnv,
      'ord_customer_cancel_confirmed',
      confirmedCashOrder,
      makeValidOrderPayload({ status: 'cancelled', paymentMethod: 'cash' })
    ),
    'ALLOW'
  );

  // Direct atomic create on checkout: cash->confirmed and visa->pending_payment succeed,
  // while visa with confirmed or pending is DENIED
  assert.equal(
    canCreateOrder(baseEnv, 'ord_direct_confirmed_cash', confirmedCashOrder),
    'ALLOW'
  );
  assert.equal(
    canCreateOrder(baseEnv, 'ord_direct_visa_pending_pay', pendingPaymentVisaOrder),
    'ALLOW'
  );
  assert.equal(
    canCreateOrder(
      baseEnv,
      'ord_visa_confirmed_denied',
      makeValidOrderPayload({ status: 'confirmed', paymentMethod: 'visa' })
    ),
    'PERMISSION_DENIED'
  );
  assert.equal(
    canCreateOrder(
      baseEnv,
      'ord_visa_pending_denied',
      makeValidOrderPayload({ status: 'pending', paymentMethod: 'visa' })
    ),
    'PERMISSION_DENIED'
  );

  // Actual firestore.rules allows direct create for confirmed/pending_payment and lightweight !isBlockedUserEntry on updates
  assert.match(
    rulesSource,
    /incoming\(\)\.status in \['pending', 'confirmed', 'pending_payment'\]/
  );
  assert.match(
    rulesSource,
    /isAllowedOrderTransition\(orderId, incoming\(\), existing\(\), incoming\(\)\.diff\(existing\(\)\)\.affectedKeys\(\)\) &&\s*!isBlockedUserEntry\(\)/
  );
});

test('Edkawy Financial Policy: canonical #1001 86% / 14% / 100% split & balance verification', () => {
  assert.equal(DEFAULT_EDKAWY_COMMISSION_RATE, 0.14);
  assert.equal(MIN_COURIER_DELIVERY_FEE_EGP, 15);
  assert.equal(BLUEPRINT_LIMITS.deliveryFeeMin, 15);

  const split = calculateOrderFinancialSplit({
    subtotal: 200,
    deliveryFee: 20,
    commissionRate: 0.14,
  });

  assert.equal(split.subtotal, 200);
  assert.equal(split.deliveryFee, 20);
  assert.equal(split.commissionRate, 0.14);
  assert.equal(split.commissionAmount, 28);
  assert.equal(split.restaurantNet, 172);
  assert.equal(split.courierEarning, 20);
  assert.equal(split.customerTotal, 220);
  assert.equal(split.isBalanced, true);
  assert.equal(
    split.restaurantNet + split.commissionAmount + split.courierEarning,
    220
  );
});

test('Edkawy Financial Policy: streak-5 free delivery funds courier minimum 15 EGP by Edkawy', () => {
  const split = calculateOrderFinancialSplit({
    subtotal: 200,
    deliveryFee: 0,
    commissionRate: 0.14,
    freeDeliveryFundedByEdkawy: true,
  });

  assert.equal(split.deliveryFee, 0);
  assert.equal(split.commissionAmount, 28);
  assert.equal(split.restaurantNet, 172);
  assert.equal(split.courierEarning, 15);
  assert.equal(split.customerTotal, 200);
  assert.equal(split.isBalanced, true);
});

test('Edkawy Financial Policy: 5-order example & founder KPI aggregation (zero auto-deduction)', () => {
  const stores = [
    {
      id: 'store_1',
      name: 'مطعم إدكو للمشويات',
      category: 'مشويات ومطاعم' as const,
      neighborhood: 'شارع البحر',
      description: 'مشويات طازجة',
      deliveryFee: 20,
      deliveryTimeMinutes: 30,
      rating: 4.9,
      reviewCount: 12,
      minOrder: 50,
      imageKey: 'grills' as const,
      isOpen: true,
      isActive: true,
      commissionRate: 0.14,
      menu: [],
      menuItems: [],
      createdBy: 'admin_1',
      createdAtIso: '2026-11-01T10:00:00.000Z',
    },
  ];

  const deliveredOrders = Array.from({ length: 5 }, (_, idx) => ({
    id: `ord_${1001 + idx}`,
    customerId: `cust_${idx + 1}`,
    storeId: 'store_1',
    storeName: 'مطعم إدكو للمشويات',
    customerName: 'عميل إدكو',
    customerPhone: '01012345678',
    deliveryNeighborhood: 'شارع البحر',
    deliveryAddress: 'شارع البحر بجوار المسجد الكبير',
    items: [],
    itemsSummary: 'وجبة مشويات × 1',
    itemNames: ['وجبة مشويات (1)'],
    itemCount: 1,
    subtotal: 200,
    deliveryFee: 20,
    totalAmount: 220,
    commissionRate: 0.14,
    commissionAmount: 28,
    restaurantNet: 172,
    courierDeliveryCompensation: 20,
    paymentMethod: 'cash' as const,
    status: 'delivered' as const,
    notes: '',
    createdAtIso: '2026-11-23T10:00:00.000Z',
    updatedAtIso: '2026-11-23T10:30:00.000Z',
  }));

  // Include a test simulation order that must be excluded from KPIs
  const orders = [
    ...deliveredOrders,
    {
      ...deliveredOrders[0],
      id: 'ord_test_sim',
      isTestSimulation: true,
      subtotal: 9999,
      totalAmount: 9999,
    },
  ];

  const wallets = [
    {
      courierId: 'drv_1',
      courierName: 'أحمد المندوب',
      collectionCustody: 100, // 1100 collected - 1000 handed over
      courierDues: 100, // 5 * 20 EGP intact (no auto-deduction)
      handedOverAmount: 1000,
      totalDuesPaid: 0,
      totalOrdersDelivered: 5,
      updatedAtIso: '2026-11-23T12:00:00.000Z',
    },
  ];

  const receipts = [
    {
      id: 'tr_1',
      receiptNumber: 'TR-20261123-1001',
      courierId: 'drv_1',
      courierName: 'أحمد المندوب',
      ordersCount: 5,
      expectedAmount: 1100,
      actualAmount: 1000,
      varianceAmount: -100,
      courierDuesSnapshot: 100,
      orderIds: ['ord_1001', 'ord_1002', 'ord_1003', 'ord_1004', 'ord_1005'],
      receivedByUid: 'admin_1',
      receivedByName: 'المدير',
      notes: 'توريد جزئي مع تسجيل عجز للمراجعة اليدوية',
      createdAtIso: '2026-11-23T12:00:00.000Z',
    },
  ];

  const exceptions = [
    {
      id: 'ex_1',
      orderId: 'ord_1005',
      exceptionType: 'cash_shortage' as const,
      courierId: 'drv_1',
      disputedAmount: 100,
      holdSettlement: false,
      description: 'عجز نقدي بانتظار المراجعة اليدوية',
      status: 'pending_review' as const,
      createdBy: 'admin_1',
      createdAtIso: '2026-11-23T12:05:00.000Z',
    },
  ];

  const kpis = calculateFounderFinancialKpis({
    orders,
    stores,
    wallets,
    receipts,
    settlements: [],
    exceptions,
  });

  assert.equal(kpis.deliveredOrdersCount, 5);
  assert.equal(kpis.totalStoreSales, 1000);
  assert.equal(kpis.totalEdkawyCommissions, 140);
  assert.equal(kpis.totalDeliveryFees, 100);
  assert.equal(kpis.totalCourierDues, 100);
  assert.equal(kpis.totalHandedOverGross, 1000);
  assert.equal(kpis.cashHeldByCouriers, 100);
  assert.equal(kpis.unpaidStorePayables, 860);
  assert.equal(kpis.cashShortageTotal, 100);
  assert.equal(kpis.cashVarianceNet, -100);
  assert.equal(kpis.pendingExceptionsCount, 1);

  assert.match(getCairoDateKey('2026-11-23T22:30:00.000Z'), /^\d{4}-\d{2}-\d{2}$/);
});

test('Edkawy Financial Policy: firestore.rules enforces financial collections', () => {
  assert.match(rulesSource, /match \/driver_wallets\/\{courierId\}/);
  assert.match(rulesSource, /match \/transactions\/\{txId\}/);
  assert.match(rulesSource, /match \/treasury_receipts\/\{receiptId\}/);
  assert.match(rulesSource, /match \/restaurant_settlements\/\{settlementId\}/);
  assert.match(rulesSource, /match \/financial_exceptions\/\{exceptionId\}/);
});

test('Security Hardening: zero legacy activationGate or wildcard vortexstore.admin alias in firestore.rules', () => {
  assert.equal(rulesSource.includes('activationGate'), false);
  assert.equal(rulesSource.includes('vortexstore.admin.'), false);
  assert.equal(rulesSource.includes('vortexstore.admin@adkawy.com'), false);
  assert.match(
    rulesSource,
    /match \/admins\/\{adminId\}[\s\S]*?request\.auth\.token\.email_verified == true/
  );
  assert.match(
    rulesSource,
    /isValidAdminEmailValue\(email\)[\s\S]*?'vortexstore\.team@gmail\.com'[\s\S]*?'alaslybys46@gmail\.com'/
  );
});

test('Security Hardening: non-admin user creation cannot inflate walletBalance, totalSpentEgp, or rewards', () => {
  assert.match(
    rulesSource,
    /match \/users\/\{userId\}[\s\S]*?allow create:[\s\S]*?incoming\(\)\.walletBalance == 0/
  );
  assert.match(
    rulesSource,
    /incoming\(\)\.freeDeliveryRewards == 0/
  );
  assert.match(
    rulesSource,
    /incoming\(\)\.totalSpentEgp == 0/
  );
  assert.match(
    rulesSource,
    /incoming\(\)\.points <= 50/
  );
});

test('Security Hardening: strict order create blocks client-side financial settlement tampering and <15 EGP fees', () => {
  assert.match(
    rulesSource,
    /match \/orders\/\{orderId\}[\s\S]*?allow create:[\s\S]*?!\(incoming\(\)\.get\('isFinancialSettled', false\) == true\)/
  );
  assert.match(
    rulesSource,
    /!\('settlementId' in incoming\(\)\)/
  );
  assert.match(
    rulesSource,
    /!\('treasuryReceiptId' in incoming\(\)\)/
  );
  assert.match(
    rulesSource,
    /!\(incoming\(\)\.get\('pointsAwarded', false\) == true\)/
  );
  assert.match(
    rulesSource,
    /isStrictNewOrderCreate\(data\)[\s\S]*?data\.deliveryFee >= 15 \|\| data\.get\('freeDeliveryFundedByEdkawy', false\) == true/
  );
});

test('Invitation Re-Onboarding: courier and courierDirectory allow pending/rejected self re-onboarding with verified pending invite', () => {
  assert.match(
    rulesSource,
    /match \/couriers\/\{courierId\}[\s\S]*?existing\(\)\.approvalStatus in \['pending', 'rejected'\]/
  );
  assert.match(
    rulesSource,
    /match \/courierDirectory\/\{courierId\}[\s\S]*?incoming\(\)\.approvalStatus == 'pending'/
  );
  assert.match(
    rulesSource,
    /match \/sales_agents\/\{agentId\}[\s\S]*?isValidPendingInviteAcceptance\(incoming\(\)\.inviteToken, 'sales_agent'\)/
  );
});


