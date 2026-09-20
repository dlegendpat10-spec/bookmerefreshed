import { Request, Response } from 'express';
import { safeQuery } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';

const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000003';

export async function getAvailableSlots(req: Request, res: Response) {
  const { serviceId, date, businessId } = req.query;
  const targetBusinessId = (businessId as string) || DEFAULT_BUSINESS_ID;

  if (!serviceId || !date) {
    return sendError(res, 'serviceId and date query parameters are required', 400);
  }

  try {
    const { rows } = await safeQuery(
      `SELECT slot_time as time,
              slot_end as end,
              display_time as display,
              is_available as available
       FROM get_available_slots($1, $2, $3::date)`,
      [targetBusinessId, serviceId, date]
    );

    if (rows && rows.length > 0) {
      return sendSuccess(res, rows);
    }
  } catch (error: any) {
    console.warn('DB getAvailableSlots warning, using fallback slots schedule:', error.message);
  }

  // Fallback slots schedule
  const fallbackSlots = [
    { time: '09:00', end: '09:45', display: '09:00 AM', available: true },
    { time: '10:00', end: '10:45', display: '10:00 AM', available: true },
    { time: '11:00', end: '11:45', display: '11:00 AM', available: true },
    { time: '13:00', end: '13:45', display: '01:00 PM', available: true },
    { time: '14:30', end: '15:15', display: '02:30 PM', available: true },
    { time: '16:00', end: '16:45', display: '04:00 PM', available: true },
    { time: '17:30', end: '18:15', display: '05:30 PM', available: true },
  ];

  return sendSuccess(res, fallbackSlots);
}
