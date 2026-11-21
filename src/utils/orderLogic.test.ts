import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BLUEPRINT_LIMITS,
  CUSTOMER_CODE_REGEX,
  calculateAdminDashboardStats,
  calculateCartTotals,
  calculateStoreDashboardStats,
  computeFraudDetectionAlerts,
  filterAdminCustomers,
  formatAppErrorMessage,
  generateUniqueCustomerCode,
  getOrderStatusLabel,
  isValidCustomerCodeFormat,
  normalizeEgyptPhoneOrEmpty,
  validateCheckoutForm,
  validateCustomErrandInput,
  validatePharmacyPrescriptionInput,
} from './orderLogic';
import { isValidUploadedImageUrl } from './imageUpload';
import type {
  CartItem,
  CourierRecord,
  CustomerDirectoryEntry,
  OrderRecord,
} from '../types/edkawi';

test('normalizeEgyptPhoneOrEmpty converts Arabic-Indic digits and +20 prefixes', () => {
  assert.equal(normalizeEgyptPhoneOrEmpty('٠١٠١٢٣٤٥٦٧٨'), '01012345678');
  assert.equal(normalizeEgyptPhoneOrEmpty('+20 11 2345 6789'), '01123456789');
  assert.equal(normalizeEgyptPhoneOrEmpty('00201234567890'), '01234567890');
  assert.equal(normalizeEgyptPhoneOrEmpty('1555555555'), '01555555555');
});

test('calculateCartTotals computes exact integers and guards against NaN/malformed cart values', () => {
  const validCart: CartItem[] = [
    {
      storeId: 'store_edku_1',
      storeName: 'أسماك المعدية',
      deliveryFee: 20,
      quantity: 2,
      item: {
        id: 'prod_1',
        name: 'وجبة جمبري مشوي',
        description: 'طازج يومياً',
        price: 150,
        category: 'أسماك وبحريات',
      },
    },
  ];
  const res = calculateCartTotals(validCart, {
    code: 'EDK10',
    discountPercent: 10,
    maxDiscountEgp: 50,
    minOrderEgp: 100,
    description: 'خصم ١٠٪',
  });
  assert.equal(res.subtotal, 300);
  assert.equal(res.discountAmount, 30);
  assert.equal(res.deliveryFee, 20);
  assert.equal(res.totalAmount, 290);

  const malformedCart: CartItem[] = [
    {
      storeId: 'store_edku_1',
      storeName: 'متجر تجريبي',
      deliveryFee: Number.NaN,
      quantity: Number.NaN,
      item: {
        id: 'bad id with spaces!',
        name: 'منتج',
        description: 'وصف',
        price: Number.NaN,
        category: 'سوبر ماركت',
      },
    },
  ];
  const safeRes = calculateCartTotals(malformedCart);
  assert.equal(Number.isFinite(safeRes.deliveryFee), true);
  assert.equal(Number.isFinite(safeRes.subtotal), true);
  assert.equal(Number.isFinite(safeRes.totalAmount), true);
  assert.equal(safeRes.deliveryFee, 15);
  assert.equal(safeRes.subtotal, 1);
  assert.equal(safeRes.totalAmount, 21);
  assert.match(safeRes.items[0].productId, /^[a-zA-Z0-9_\-]+$/);
});

test('validateCheckoutForm accepts valid Edku coordinates and rejects out-of-bounds locations', () => {
  const validCheckout = validateCheckoutForm({
    customerName: 'أحمد محمد',
    customerPhone: '01012345678',
    zoneId: 'zone_1',
    deliveryNeighborhood: 'شارع البحر - إدكو',
    deliveryAddress: 'شارع البحر بجوار مسجد المحطة الدور الثاني',
    customerLat: 31.3055,
    customerLng: 30.3005,
    paymentMethod: 'cash',
    notes: '',
  });
  assert.equal(validCheckout.valid, true);

  const cairoCheckout = validateCheckoutForm({
    customerName: 'أحمد محمد',
    customerPhone: '01012345678',
    deliveryNeighborhood: 'شارع البحر',
    deliveryAddress: 'عنوان تجريبي خارج النطاق',
    customerLat: 30.0444,
    customerLng: 31.2357,
    paymentMethod: 'cash',
    notes: '',
  });
  assert.equal(cairoCheckout.valid, false);
  assert.ok(cairoCheckout.errors.deliveryLocation);
});

test('validatePharmacyPrescriptionInput and image ceiling accept up to 750KB Data URLs', () => {
  const largeDataUrl = `data:image/jpeg;base64,${'A'.repeat(320_000)}`;
  assert.equal(isValidUploadedImageUrl(largeDataUrl), true);
  assert.equal(BLUEPRINT_LIMITS.imageUrlMax, 750_000);

  const validRxErr = validatePharmacyPrescriptionInput({
    customerName: 'سارة علي',
    customerPhone: '01234567890',
    deliveryNeighborhood: 'حي المحطة',
    deliveryAddress: 'أمام محطة قطار إدكو عمارة النور',
    customerLat: 31.306,
    customerLng: 30.301,
    prescriptionImageUrl: largeDataUrl,
    medicineRequest: '',
    notes: '',
  });
  assert.equal(validRxErr, null);

  const missingBothErr = validatePharmacyPrescriptionInput({
    customerName: 'سارة علي',
    customerPhone: '01234567890',
    deliveryNeighborhood: 'حي المحطة',
    deliveryAddress: 'أمام محطة قطار إدكو عمارة النور',
    customerLat: 31.306,
    customerLng: 30.301,
    prescriptionImageUrl: '',
    medicineRequest: '',
  });
  assert.notEqual(missingBothErr, null);
});

test('validateCustomErrandInput enforces Edku service area and errand details', () => {
  const okErrand = validateCustomErrandInput({
    customerName: 'محمود إدكاوي',
    customerPhone: '01198765432',
    errandDescription: 'إحضار أوراق رسمية وشنطة مستلزمات من وسط البلد',
    errandPickupAddress: 'وسط البلد بجوار البريد',
    deliveryNeighborhood: 'كوبري شربت',
    deliveryAddress: 'كوبري شربت بجوار صيدلية الشفاء',
    customerLat: 31.304,
    customerLng: 30.299,
  });
  assert.equal(okErrand, null);
});

test('formatAppErrorMessage extracts structured FirestoreErrorInfo JSON cleanly', () => {
  const wrappedJsonErr = new Error(
    JSON.stringify({
      error: 'Missing or insufficient permissions.',
      operationType: 'create',
      path: 'orders',
    })
  );
  assert.equal(
    formatAppErrorMessage(wrappedJsonErr),
    'تعذر تنفيذ العملية حالياً بسبب صلاحيات الحساب أو تحديث حالة الطلب من طرف آخر.'
  );
});

test('generateUniqueCustomerCode produces valid EDK-USR-XXXX codes and avoids collisions', () => {
  const existing = new Set<string>(['EDK-USR-1000', 'EDK-USR-9999']);
  for (let i = 0; i < 25; i += 1) {
    const code = generateUniqueCustomerCode(existing);
    assert.match(code, CUSTOMER_CODE_REGEX);
    assert.equal(isValidCustomerCodeFormat(code), true);
    assert.equal(existing.has(code), false);
    existing.add(code);
  }
  assert.equal(isValidCustomerCodeFormat('EDK-USR-123'), false);
  assert.equal(isValidCustomerCodeFormat('EDK-USR-12345'), false);
});

test('filterAdminCustomers matches name, mobile phone, and customerCode', () => {
  const customers: (CustomerDirectoryEntry & { phone?: string })[] = [
    {
      uid: 'u1',
      name: 'مصطفى البحيري',
      customerCode: 'EDK-USR-4821',
      phone: '01099887766',
      points: 120,
      currentStreak: 2,
      freeDeliveryRewards: 0,
      totalDeliveredOrders: 5,
      updatedAtIso: '2026-11-03T10:00:00.000Z',
    },
    {
      uid: 'u2',
      name: 'هدى سالم',
      customerCode: 'EDK-USR-7304',
      phone: '01211223344',
      points: 40,
      currentStreak: 1,
      freeDeliveryRewards: 0,
      totalDeliveredOrders: 2,
      updatedAtIso: '2026-11-03T10:00:00.000Z',
    },
  ];

  assert.equal(filterAdminCustomers(customers, 'مصطفى').length, 1);
  assert.equal(filterAdminCustomers(customers, 'edk-usr-7304')[0]?.uid, 'u2');
  assert.equal(filterAdminCustomers(customers, '٠١٠٩٩٨٨٧٧٦٦')[0]?.uid, 'u1');
});

test('computeFraudDetectionAlerts flags >3 daily cancellations, <1min rapid orders, and courier repeated cancellations', () => {
  const baseOrder = (
    overrides: Partial<OrderRecord> & { id: string }
  ): OrderRecord => {
    const { id, ...rest } = overrides;
    return {
      id,
      customerId: rest.customerId ?? 'cust_1',
      storeId: 'store_1',
      storeName: 'مشويات إدكو',
      customerName: rest.customerName ?? 'كريم عادل',
      customerPhone: rest.customerPhone ?? '01011112222',
      deliveryNeighborhood: 'شارع البحر',
      deliveryAddress: 'شارع البحر بجوار المسجد',
      items: [],
      itemsSummary: 'وجبة مشويات',
      itemNames: ['وجبة مشويات'],
      itemCount: 1,
      subtotal: 150,
      deliveryFee: 20,
      totalAmount: 170,
      paymentMethod: 'cash',
      status: rest.status ?? 'pending',
      notes: '',
      createdAtIso: rest.createdAtIso ?? '2026-11-03T10:00:00.000Z',
      ...rest,
    };
  };

  const orders: OrderRecord[] = [
    // 4 cancelled orders on the same day for cust_1 -> triggers excessive_daily_cancellations
    baseOrder({
      id: 'o1',
      customerId: 'cust_1',
      status: 'cancelled',
      createdAtIso: '2026-11-03T09:00:00.000Z',
    }),
    baseOrder({
      id: 'o2',
      customerId: 'cust_1',
      status: 'cancelled',
      createdAtIso: '2026-11-03T10:00:00.000Z',
    }),
    baseOrder({
      id: 'o3',
      customerId: 'cust_1',
      status: 'cancelled',
      createdAtIso: '2026-11-03T11:00:00.000Z',
    }),
    baseOrder({
      id: 'o4',
      customerId: 'cust_1',
      status: 'cancelled',
      createdAtIso: '2026-11-03T12:00:00.000Z',
    }),
    // 2 orders 25s apart for cust_2 -> triggers rapid_consecutive_orders
    baseOrder({
      id: 'o5',
      customerId: 'cust_2',
      customerName: 'طارق فوزي',
      customerPhone: '01122223333',
      createdAtIso: '2026-11-03T14:00:00.000Z',
    }),
    baseOrder({
      id: 'o6',
      customerId: 'cust_2',
      customerName: 'طارق فوزي',
      customerPhone: '01122223333',
      createdAtIso: '2026-11-03T14:00:25.000Z',
    }),
  ];

  const customers: (CustomerDirectoryEntry & { phone?: string })[] = [
    {
      uid: 'cust_1',
      name: 'كريم عادل',
      customerCode: 'EDK-USR-1122',
      phone: '01011112222',
      points: 0,
      currentStreak: 0,
      freeDeliveryRewards: 0,
      totalDeliveredOrders: 0,
      updatedAtIso: '2026-11-03T12:00:00.000Z',
    },
    {
      uid: 'cust_2',
      name: 'طارق فوزي',
      customerCode: 'EDK-USR-3344',
      phone: '01122223333',
      points: 10,
      currentStreak: 1,
      freeDeliveryRewards: 0,
      totalDeliveredOrders: 1,
      updatedAtIso: '2026-11-03T14:00:25.000Z',
    },
  ];

  const couriers: CourierRecord[] = [
    {
      id: 'cour_99',
      name: 'حسن المندوب',
      phone: '01544445555',
      vehicleType: 'دراجة نارية',
      neighborhood: 'حي المحطة',
      isAvailable: true,
      approvalStatus: 'approved',
      completedDeliveries: 10,
      cancelledDeliveries: 3,
      updatedBy: 'cour_99',
      updatedAtIso: '2026-11-03T15:00:00.000Z',
    },
  ];

  const alerts = computeFraudDetectionAlerts({
    orders,
    customers,
    couriers,
  });

  assert.equal(alerts.length, 3);
  assert.ok(
    alerts.some(
      (a) =>
        a.entityId === 'cust_1' &&
        a.violationType === 'excessive_daily_cancellations' &&
        a.customerCode === 'EDK-USR-1122'
    )
  );
  assert.ok(
    alerts.some(
      (a) =>
        a.entityId === 'cust_2' &&
        a.violationType === 'rapid_consecutive_orders' &&
        a.customerCode === 'EDK-USR-3344'
    )
  );
  assert.ok(
    alerts.some(
      (a) =>
        a.entityId === 'cour_99' &&
        a.violationType === 'courier_repeated_cancellations'
    )
  );
});

test('calculateCartTotals handles small-order fees, zone overrides, free-delivery rewards, expired/min-order coupons, and variants', () => {
  const smallCart: CartItem[] = [
    {
      storeId: 'store_bakery_1',
      storeName: 'فطائر إدكو',
      deliveryFee: 15,
      quantity: 1,
      item: {
        id: 'prod_feteer',
        name: 'فطير مشلتت',
        description: 'سمن بلدي',
        price: 40,
        category: 'مخبوزات',
      },
      selectedVariant: {
        variantId: 'var_small',
        name: 'حجم وسط',
        price: 45,
        stock: 10,
      },
    },
  ];

  // Subtotal 45 (< 50) triggers 5 EGP smallOrderFee even when free delivery reward zeros deliveryFee
  const withReward = calculateCartTotals(
    smallCart,
    {
      code: 'EXPIRED',
      discountPercent: 20,
      maxDiscountEgp: 50,
      minOrderEgp: 20,
      description: 'منتهي',
      expiryDateIso: '2020-01-01T00:00:00.000Z',
    },
    { zoneDeliveryFee: 25, useFreeDeliveryReward: true }
  );
  assert.equal(withReward.subtotal, 45);
  assert.equal(withReward.smallOrderFee, 5);
  assert.equal(withReward.baseZoneFee, 25);
  assert.equal(withReward.deliveryFee, 0);
  assert.equal(withReward.discountAmount, 0);
  assert.equal(withReward.totalAmount, 50);
  assert.equal(withReward.items[0].name, 'فطير مشلتت (حجم وسط)');

  // Order >= 50 waives smallOrderFee; coupon below minOrderEgp grants 0 discount
  const largerCart: CartItem[] = [{ ...smallCart[0], quantity: 2 }]; // 90 EGP
  const highMinCoupon = calculateCartTotals(
    largerCart,
    {
      code: 'BIG100',
      discountPercent: 30,
      maxDiscountEgp: 40,
      minOrderEgp: 100,
      description: 'للـ ١٠٠ فأكثر',
    },
    { zoneDeliveryFee: 20, useFreeDeliveryReward: false }
  );
  assert.equal(highMinCoupon.subtotal, 90);
  assert.equal(highMinCoupon.smallOrderFee, 0);
  assert.equal(highMinCoupon.discountAmount, 0);
  assert.equal(highMinCoupon.totalAmount, 110);

  // Coupon above minOrderEgp is capped by maxDiscountEgp
  const validCoupon = calculateCartTotals(
    [{ ...smallCart[0], quantity: 4 }], // 180 EGP
    {
      code: 'SAVE50',
      discountPercent: 50,
      maxDiscountEgp: 40,
      minOrderEgp: 100,
      description: 'خصم 50% بحد أقصى 40',
    },
    { zoneDeliveryFee: 20 }
  );
  assert.equal(validCoupon.subtotal, 180);
  assert.equal(validCoupon.discountAmount, 40);
  assert.equal(validCoupon.totalAmount, 160);
});

test('validateCheckoutForm rejects unexpected inputs: missing zone, Visa payment, past schedule, bad phone, long notes', () => {
  const invalidResult = validateCheckoutForm({
    customerName: 'أ',
    customerPhone: '01900000000', // Invalid Egypt prefix
    zoneId: 'unknown_zone' as never,
    deliveryNeighborhood: '',
    deliveryAddress: 'قصير',
    customerLat: 31.3055,
    customerLng: 30.3005,
    paymentMethod: 'visa',
    isScheduled: true,
    scheduledForIso: new Date(Date.now() - 60_000).toISOString(),
    notes: 'م'.repeat(210),
  });

  assert.equal(invalidResult.valid, false);
  assert.ok(invalidResult.errors.customerName);
  assert.ok(invalidResult.errors.customerPhone);
  assert.ok(invalidResult.errors.zoneId);
  assert.ok(invalidResult.errors.deliveryNeighborhood);
  assert.ok(invalidResult.errors.paymentMethod);
  assert.ok(invalidResult.errors.scheduledForIso);
  assert.ok(invalidResult.errors.notes);

  const futureSchedule = validateCheckoutForm({
    customerName: 'منى السيد',
    customerPhone: '٠١٢٣٤٥٦٧٨٩٠',
    zoneId: 'zone_2',
    deliveryNeighborhood: 'شارع المصيف',
    deliveryAddress: 'شارع المصيف بجوار مدرسة النيل',
    customerLat: 31.3055,
    customerLng: 30.3005,
    paymentMethod: 'cash',
    isScheduled: true,
    scheduledForIso: new Date(Date.now() + 60 * 60_000).toISOString(),
    notes: 'بدون شطة',
  });
  assert.equal(futureSchedule.valid, true);
});

test('validateCustomErrandInput and validatePharmacyPrescriptionInput reject edge-case invalid inputs', () => {
  const shortErrand = validateCustomErrandInput({
    customerName: 'محمود',
    customerPhone: '01012345678',
    errandDescription: 'طرد',
    errandPickupAddress: 'هنا',
    deliveryNeighborhood: 'شارع البحر',
    deliveryAddress: 'أمام مسجد البحر إدكو',
    customerLat: 31.304,
    customerLng: 30.299,
  });
  assert.notEqual(shortErrand, null);

  const validTextRx = validatePharmacyPrescriptionInput({
    customerName: 'سارة علي',
    customerPhone: '01512345678',
    deliveryNeighborhood: 'سعد زغلول',
    deliveryAddress: 'شارع سعد زغلول بجوار مخبز النور',
    customerLat: 31.306,
    customerLng: 30.301,
    prescriptionImageUrl: '',
    medicineRequest: 'بانادول إكسترا شريط + فيتامين سي',
  });
  assert.equal(validTextRx, null);

  const outOfBoundsRx = validatePharmacyPrescriptionInput({
    customerName: 'سارة علي',
    customerPhone: '01512345678',
    deliveryNeighborhood: 'سعد زغلول',
    deliveryAddress: 'شارع سعد زغلول بجوار مخبز النور',
    customerLat: 29.9,
    customerLng: 31.2,
    prescriptionImageUrl: '',
    medicineRequest: 'بانادول إكسترا',
  });
  assert.notEqual(outOfBoundsRx, null);
});

test('confirmed and pending_payment statuses map cleanly to Arabic labels and store/admin incoming queues', () => {
  assert.equal(getOrderStatusLabel('confirmed'), 'تم تأكيد الطلب');
  assert.equal(getOrderStatusLabel('pending_payment'), 'بانتظار إتمام الدفع');

  const nowIso = new Date().toISOString();
  const sampleOrders: OrderRecord[] = [
    {
      id: 'ord_conf_1',
      customerId: 'cust_1',
      storeId: 'store_1',
      storeName: 'مطعم البحر',
      customerName: 'عميل ١',
      customerPhone: '01012345678',
      deliveryNeighborhood: 'شارع البحر',
      deliveryAddress: 'شارع البحر - إدكو',
      items: [{ productId: 'p1', name: 'وجبة سمك', price: 150, quantity: 1 }],
      itemsSummary: 'وجبة سمك × 1',
      itemNames: ['وجبة سمك (1)'],
      itemCount: 1,
      subtotal: 150,
      deliveryFee: 20,
      totalAmount: 170,
      paymentMethod: 'cash',
      status: 'confirmed',
      notes: '',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
    {
      id: 'ord_pay_2',
      customerId: 'cust_2',
      storeId: 'store_1',
      storeName: 'مطعم البحر',
      customerName: 'عميل ٢',
      customerPhone: '01112345678',
      deliveryNeighborhood: 'شارع البحر',
      deliveryAddress: 'شارع البحر - إدكو',
      items: [{ productId: 'p2', name: 'جمبري مشوي', price: 250, quantity: 1 }],
      itemsSummary: 'جمبري مشوي × 1',
      itemNames: ['جمبري مشوي (1)'],
      itemCount: 1,
      subtotal: 250,
      deliveryFee: 20,
      totalAmount: 270,
      paymentMethod: 'visa',
      status: 'pending_payment',
      notes: '',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
    },
  ];

  const storeStats = calculateStoreDashboardStats(sampleOrders, 'store_1');
  assert.equal(storeStats.pendingOrders.length, 1);
  assert.equal(storeStats.pendingOrders[0].id, 'ord_conf_1');

  const adminStats = calculateAdminDashboardStats(sampleOrders, [], []);
  assert.equal(adminStats.pendingCount, 2);
  assert.equal(adminStats.activeOrdersCount, 2);
});



