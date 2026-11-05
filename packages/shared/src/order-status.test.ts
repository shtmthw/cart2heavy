import { describe, expect, it } from 'vitest';
import {
  canAdminCancel,
  canAdminConfirm,
  canLogisticsMove,
  nextLogisticsStatus,
} from './order-status';

describe('order status rules', () => {
  it('moves one step forward through the logistics flow', () => {
    expect(nextLogisticsStatus('confirmed')).toBe('received');
    expect(nextLogisticsStatus('out_for_delivery')).toBe('delivered');
    expect(nextLogisticsStatus('delivered')).toBeNull();
    expect(nextLogisticsStatus('processing')).toBeNull();
    expect(nextLogisticsStatus('cancelled')).toBeNull();
  });

  it('only lets logistics move forward', () => {
    expect(canLogisticsMove('confirmed', 'received')).toBe(true);
    expect(canLogisticsMove('confirmed', 'delivered')).toBe(true);
    expect(canLogisticsMove('shipped', 'received')).toBe(false);
    expect(canLogisticsMove('shipped', 'shipped')).toBe(false);
    expect(canLogisticsMove('processing', 'confirmed')).toBe(false);
    expect(canLogisticsMove('delivered', 'shipped')).toBe(false);
    expect(canLogisticsMove('cancelled', 'received')).toBe(false);
  });

  it('lets admin confirm only paid, processing orders', () => {
    expect(canAdminConfirm({ status: 'processing', paymentStatus: 'paid' })).toBe(true);
    expect(canAdminConfirm({ status: 'processing', paymentStatus: 'pending' })).toBe(false);
    expect(canAdminConfirm({ status: 'confirmed', paymentStatus: 'paid' })).toBe(false);
  });

  it('lets admin cancel until logistics has the package', () => {
    expect(canAdminCancel({ status: 'processing' })).toBe(true);
    expect(canAdminCancel({ status: 'confirmed' })).toBe(true);
    expect(canAdminCancel({ status: 'received' })).toBe(false);
    expect(canAdminCancel({ status: 'delivered' })).toBe(false);
  });
});
