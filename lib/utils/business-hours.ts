import type { StoreOpeningHours } from '@/types/domain';

type WeekDay = 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';

const DAYS_ORDER: WeekDay[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

export interface OpenStatusResult {
  isOpen: boolean;
  message: string;
}

/**
 * Pure function to calculate whether a store is open in America/Lima timezone.
 * - If openingHours has no days configured, status depends solely on isOpenManual.
 * - Supports 24h schedules (00:00 to 24:00 / 00:00).
 * - Supports schedules crossing midnight (e.g. 20:00 to 02:00) including yesterday's shift.
 */
export function calculateOpenStatus(
  openingHours: StoreOpeningHours,
  isOpenManual: boolean,
  targetDate: Date = new Date()
): OpenStatusResult {
  if (!isOpenManual) {
    return { isOpen: false, message: 'Cerrado temporalmente' };
  }

  // If openingHours is empty or has no day defined, status depends purely on isOpenManual
  const configuredDays = Object.keys(openingHours);
  if (configuredDays.length === 0) {
    return { isOpen: true, message: 'Abierto para pedidos' };
  }

  // Extract Lima date/time components using standard Intl API
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Lima',
    weekday: 'long',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });

  const parts = dtf.formatToParts(targetDate);
  const weekdayStr = parts.find((p) => p.type === 'weekday')?.value.toLowerCase() as WeekDay;
  const currentHour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const currentMinute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);
  const currentMinutesTotal = currentHour * 60 + currentMinute;

  const currentDayIndex = DAYS_ORDER.indexOf(weekdayStr);
  const todaySchedule = openingHours[weekdayStr];

  // 1. Check if yesterday's shift crossed midnight into early this morning
  const yesterdayIndex = (currentDayIndex + 6) % 7;
  const yesterdayDay = DAYS_ORDER[yesterdayIndex];
  const yesterdaySchedule = openingHours[yesterdayDay];

  if (yesterdaySchedule && !yesterdaySchedule.closed) {
    const is24hYesterday =
      yesterdaySchedule.open === '00:00' &&
      (yesterdaySchedule.close === '24:00' || yesterdaySchedule.close === '00:00');

    if (!is24hYesterday) {
      const [yOpenH, yOpenM] = yesterdaySchedule.open.split(':').map(Number);
      const [yCloseH, yCloseM] = yesterdaySchedule.close.split(':').map(Number);
      const yOpenTotal = yOpenH * 60 + yOpenM;
      const yCloseTotal = yCloseH * 60 + yCloseM;

      // Crosses midnight if close time < open time
      if (yCloseTotal < yOpenTotal && currentMinutesTotal < yCloseTotal) {
        return { isOpen: true, message: `Abierto hasta las ${yesterdaySchedule.close}` };
      }
    }
  }

  // 2. Check today's schedule
  if (!todaySchedule || todaySchedule.closed) {
    return { isOpen: false, message: 'Cerrado hoy' };
  }

  // Check 24-hour schedule
  const is24hToday =
    todaySchedule.open === '00:00' &&
    (todaySchedule.close === '24:00' || todaySchedule.close === '00:00');
  if (is24hToday) {
    return { isOpen: true, message: 'Abierto 24 horas' };
  }

  const [tOpenH, tOpenM] = todaySchedule.open.split(':').map(Number);
  const [tCloseH, tCloseM] = todaySchedule.close.split(':').map(Number);
  const tOpenTotal = tOpenH * 60 + tOpenM;
  const tCloseTotal = tCloseH * 60 + tCloseM;

  const crossesMidnight = tCloseTotal < tOpenTotal;

  if (crossesMidnight) {
    if (currentMinutesTotal >= tOpenTotal) {
      return { isOpen: true, message: `Abierto hasta las ${todaySchedule.close}` };
    }
    return { isOpen: false, message: `Abre a las ${todaySchedule.open}` };
  }

  // Normal daytime schedule (e.g. 08:00 to 20:00)
  if (currentMinutesTotal >= tOpenTotal && currentMinutesTotal < tCloseTotal) {
    return { isOpen: true, message: `Abierto hasta las ${todaySchedule.close}` };
  }

  if (currentMinutesTotal < tOpenTotal) {
    return { isOpen: false, message: `Abre a las ${todaySchedule.open}` };
  }

  return { isOpen: false, message: `Cerró a las ${todaySchedule.close}` };
}
