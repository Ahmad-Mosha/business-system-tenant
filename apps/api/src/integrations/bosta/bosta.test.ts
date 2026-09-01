import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BostaService } from './bosta.service';
import { collectPages, type BostaDeliveryRaw } from './bosta.client';

test('collectPages stops on the first short page', async () => {
  const pages = [Array(100).fill(0), Array(100).fill(0), Array(37).fill(0)];
  const seen: number[] = [];
  const all = await collectPages(100, async (page) => {
    seen.push(page);
    return pages[page - 1] ?? [];
  });
  assert.deepEqual(seen, [1, 2, 3]); // did not ask for page 4
  assert.equal(all.length, 237);
});

test('collectPages gives up at maxPages instead of looping forever', async () => {
  let calls = 0;
  const all = await collectPages(
    10,
    async () => {
      calls++;
      return Array(10).fill(0); // never a short page
    },
    5,
  );
  assert.equal(calls, 5);
  assert.equal(all.length, 50);
});

test('collectPages handles an empty first page', async () => {
  const all = await collectPages(100, async () => []);
  assert.deepEqual(all, []);
});

// Sample real delivery response structure from Bosta API
const SAMPLE_DELIVERED_RAW: BostaDeliveryRaw = {
  _id: 'pjqzfNpW3CUydhSGnMmiD',
  trackingNumber: '8755006904',
  state: {
    value: 'Delivered',
    code: 45,
    deliveryTime: '2026-08-16T11:14:29.347Z',
    pickedUpTime: '2026-08-16T07:14:45.972Z',
    receivedAtWarehouse: {
      time: '2026-08-16T03:20:01.271Z',
      warehouse: { name: 'Box-Nasr City Hub' },
    },
    delivering: {
      time: '2026-08-16T11:14:29.347Z',
    },
  },
  maskedState: 'Delivered',
  type: { code: 10, value: 'Send' },
  cod: 4500,
  isDelayed: false,
  receiver: {
    _id: '92eJjqC32sTU8prULeCCC',
    phone: '+201003232305',
    fullName: 'دكتور /عبدالمنعم',
    firstName: 'دكتور /عبدالمنعم',
    lastName: '-',
  },
  dropOffAddress: {
    city: { name: 'Cairo', nameAr: 'القاهره' },
    zone: { name: 'ElMokattam', nameAr: 'المقطم' },
    district: { name: 'ElMokattam - Street 9', nameAr: 'المقطم - شارع ٩' },
    firstLine: 'كمبوند لاجور عمارة B7 شقة 604',
  },
  timeline: [
    { value: 'new', code: 10, done: true, date: '2026-08-15T11:18:07.155Z' },
    { value: 'picked_up', code: 21, done: true, date: '2026-08-15T14:21:55.666Z' },
    { value: 'in_transit', code: 30, done: true, date: '2026-08-16T03:20:01.271Z' },
    { value: 'out_for_delivery', code: 41, done: true, date: '2026-08-16T07:14:45.756Z', desc: '1/3 attempts' },
    { value: 'delivered', code: 45, done: true, date: '2026-08-16T11:14:29.347Z' },
  ],
  specs: {
    packageType: 'Medium',
    packageDetails: {
      itemsCount: 1,
      description: 'جهاز تخسيس كهربائي',
    },
    weight: 1,
  },
  attempts: [
    {
      _id: 'SkQhcxdaEKyqchV4XDacg',
      attemptDate: '2026-08-16T07:14:45.756Z',
      state: 3,
      star: {
        name: 'Alaa Mohamed Abdelaziz',
        phone: '+201063037425',
      },
      warehouse: {
        name: 'Box-Nasr City Hub',
      },
      succeededAt: '2026-08-16T11:14:29.348Z',
    },
  ],
  numberOfAttempts: 1,
  allowToOpenPackage: true,
  createdAt: '2026-08-15T11:18:07.155Z',
  updatedAt: '2026-08-16T14:18:53.000Z',
  scheduledDate: '2026-08-17T20:59:59.999Z',
  // Real cashoutInfo for this same tracking number — an executed payout, the
  // one case that's actually PAID.
  cashoutInfo: {
    expectedCashoutDate: '2026-08-26T00:00:00.000Z',
    oracleTransactionId: 'WEDCOD26AUG26',
  },
  flexShippingInfo: {
    isOrderEligible: true,
    isAmountCollected: false,
    amountToBeCollected: 80,
  },
  whatsAppLastMileActions: {
    orderStatus: 'confirmed',
    consigneeConfirmedDelivery: {
      isConfirmedDelivery: true,
      time: '2026-08-15T18:24:09.299Z',
    },
  },
};

test('normalizes real Bosta delivered payload into Prime Market domain DTO', () => {
  const service = new BostaService(null as any, null as any);
  const dto = service.normalizeBostaDelivery(SAMPLE_DELIVERED_RAW);

  assert.equal(dto.trackingNumber, '8755006904');
  assert.equal(dto.carrier, 'BOSTA');
  assert.equal(dto.status, 'DELIVERED');
  assert.equal(dto.statusLabel, 'Delivered');
  assert.equal(dto.statusCode, 45);
  assert.equal(dto.isDelayed, false);

  assert.equal(dto.receiver.name, 'دكتور /عبدالمنعم');
  assert.equal(dto.receiver.phone, '+201003232305');

  assert.equal(dto.destination.city, 'القاهره');
  assert.equal(dto.destination.zone, 'المقطم');
  assert.equal(dto.destination.district, 'المقطم - شارع ٩');
  assert.equal(dto.destination.address, 'كمبوند لاجور عمارة B7 شقة 604');

  assert.equal(dto.cod.amount, 4500);
  assert.equal(dto.cod.currency, 'EGP');
  // Delivered → the courier collected cash from the customer at the door.
  // This delivery's cashoutInfo carries a real oracleTransactionId — an
  // executed payout, the only case that's genuinely PAID. Verified against
  // Bosta's own dashboard: delivered alone does not mean paid, and a null
  // cod (a return) does not mean paid either — only a completed cashout does.
  assert.equal(dto.cod.isCollected, true);
  assert.equal(dto.cod.collectionStatus, 'PAID');
  assert.equal(dto.cod.collectionStatusLabel, 'مدفوع');
  assert.equal(dto.cod.paymentMethodLabel, 'الدفع عند الاستلام');

  assert.equal(dto.allowOpenPackage, true);
  assert.equal(dto.flexShipFee, 80);
  assert.equal(dto.packageSpecs.type, 'Medium');
  assert.equal(dto.packageSpecs.typeAr, 'توصيل متوسطة');
  assert.equal(dto.packageSpecs.description, 'جهاز تخسيس كهربائي');

  assert.equal(dto.whatsAppConfirmation?.isConfirmed, true);
  assert.equal(dto.whatsAppConfirmation?.confirmedAt, '2026-08-15T18:24:09.299Z');

  // Timeline verification
  assert.equal(dto.timeline.length, 5);
  assert.equal(dto.timeline[0].key, 'NEW');
  assert.equal(dto.timeline[0].isDone, true);
  assert.equal(dto.timeline[4].key, 'DELIVERED');
  assert.equal(dto.timeline[4].isDone, true);
  assert.equal(dto.timeline[3].description, '1/3 attempts');

  // Attempts verification
  assert.equal(dto.attempts.count, 1);
  assert.equal(dto.attempts.max, 3);
  assert.equal(dto.attempts.list.length, 1);
  assert.equal(dto.attempts.list[0].driverName, 'Alaa Mohamed Abdelaziz');
  assert.equal(dto.attempts.list[0].succeeded, true);
});

test('"Pickup requested" (code 10) is NEW, not picked up', () => {
  const service = new BostaService(null as any, null as any);
  const dto = service.normalizeBostaDelivery({
    trackingNumber: '9482725368',
    state: { value: 'Pickup requested', code: 10 },
    type: { code: 10, value: 'Send' },
    cod: 510,
    receiver: { fullName: 'العساف', phone: '+201042812537' },
  });
  assert.equal(dto.status, 'NEW');
  assert.equal(dto.statusLabel, 'Created');
  // No cashout record yet → collection is pending, not unpaid.
  assert.equal(dto.cod.collectionStatus, 'PENDING');
});

test('a delivered shipment with a cashout record but no payout is UNPAID', () => {
  const service = new BostaService(null as any, null as any);
  const dto = service.normalizeBostaDelivery({
    trackingNumber: '684744877',
    state: { value: 'Delivered', code: 45 },
    type: { code: 10, value: 'Send' },
    cod: 4260,
    cashoutInfo: { expectedCashoutDate: '2026-09-09T00:00:00.000Z' },
    receiver: { fullName: 'شريهان', phone: '+201552711456' },
  });
  assert.equal(dto.status, 'DELIVERED');
  assert.equal(dto.cod.collectionStatus, 'UNPAID');
  assert.equal(dto.cod.collectionStatusLabel, 'غير مدفوع');
});

test('normalizes an in-transit Bosta delivery correctly', () => {
  const service = new BostaService(null as any, null as any);
  const inTransitRaw: BostaDeliveryRaw = {
    trackingNumber: '1234567890',
    state: {
      value: 'In Transit',
      code: 30,
      pickedUpTime: '2026-08-18T10:00:00Z',
    },
    cod: 1200,
    isDelayed: true,
    receiver: {
      firstName: 'Ahmed',
      lastName: 'Ali',
      phone: '+201100000000',
    },
    timeline: [
      { value: 'new', code: 10, done: true, date: '2026-08-17T09:00:00Z' },
      { value: 'picked_up', code: 21, done: true, date: '2026-08-18T10:00:00Z' },
      { value: 'in_transit', code: 30, done: true, date: '2026-08-18T14:00:00Z' },
      { value: 'out_for_delivery', code: 41, done: false },
      { value: 'delivered', code: 45, done: false },
    ],
  };

  const dto = service.normalizeBostaDelivery(inTransitRaw);
  assert.equal(dto.status, 'IN_TRANSIT');
  assert.equal(dto.statusLabel, 'In Transit');
  assert.equal(dto.isDelayed, true);
  assert.equal(dto.receiver.name, 'Ahmed Ali');
  assert.equal(dto.timeline[2].isDone, true);
  assert.equal(dto.timeline[3].isDone, false);
  assert.equal(dto.timeline[4].isDone, false);
});
