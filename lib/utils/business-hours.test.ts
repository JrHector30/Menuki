import { describe, it, expect } from 'vitest';
import { calculateOpenStatus } from './business-hours';
import type { StoreOpeningHours } from '@/types/domain';

describe('calculateOpenStatus', () => {
  it('returns status based purely on isOpenManual when openingHours is empty {}', () => {
    expect(calculateOpenStatus({}, true)).toEqual({
      isOpen: true,
      message: 'Abierto para pedidos',
    });

    expect(calculateOpenStatus({}, false)).toEqual({
      isOpen: false,
      message: 'Cerrado temporalmente',
    });
  });

  it('handles 24h schedule (00:00 to 24:00 or 00:00 to 00:00)', () => {
    const hours24: StoreOpeningHours = {
      wednesday: { open: '00:00', close: '24:00', closed: false },
    };
    // 2026-11-04 is a Wednesday. 15:00 Lima = 20:00 UTC
    const date = new Date('2026-11-04T20:00:00Z');
    const result = calculateOpenStatus(hours24, true, date);
    expect(result.isOpen).toBe(true);
    expect(result.message).toBe('Abierto 24 horas');
  });

  it('handles midnight crossover (20:00 - 02:00) evaluated at 22:00 on the same night', () => {
    const overnightHours: StoreOpeningHours = {
      wednesday: { open: '20:00', close: '02:00', closed: false },
      thursday: { open: '20:00', close: '02:00', closed: false },
    };
    // Wednesday 22:30 Lima time (UTC-5) -> 03:30 UTC on Thursday Nov 5
    const dateAt2230 = new Date('2026-11-05T03:30:00Z');
    const result = calculateOpenStatus(overnightHours, true, dateAt2230);
    expect(result.isOpen).toBe(true);
    expect(result.message).toBe('Abierto hasta las 02:00');
  });

  it('handles early morning 01:00 belonging to yesterday overnight shift', () => {
    const overnightHours: StoreOpeningHours = {
      wednesday: { open: '20:00', close: '02:00', closed: false },
      thursday: { open: '12:00', close: '18:00', closed: false },
    };
    // Thursday 01:15 AM Lima time -> 06:15 UTC on Thursday Nov 5
    const dateAt0115 = new Date('2026-11-05T06:15:00Z');
    const result = calculateOpenStatus(overnightHours, true, dateAt0115);
    expect(result.isOpen).toBe(true);
    expect(result.message).toBe('Abierto hasta las 02:00');
  });

  it('correctly shifts UTC timestamp to America/Lima timezone (UTC-5)', () => {
    const standardHours: StoreOpeningHours = {
      wednesday: { open: '08:00', close: '18:00', closed: false },
    };
    // 2026-11-04T22:30:00Z is 17:30 in Lima (before 18:00 close -> OPEN)
    const openDateUtc = new Date('2026-11-04T22:30:00Z');
    expect(calculateOpenStatus(standardHours, true, openDateUtc).isOpen).toBe(true);

    // 2026-11-04T23:30:00Z is 18:30 in Lima (after 18:00 close -> CLOSED)
    const closedDateUtc = new Date('2026-11-04T23:30:00Z');
    expect(calculateOpenStatus(standardHours, true, closedDateUtc).isOpen).toBe(false);
  });
});
