import { Request, Response } from 'express';
import { safeQuery } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';

const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

const DEFAULT_SLOTS = [
  { time: '09:00:00', end: '10:00:00', display: '09:00 AM', available: true },
  { time: '10:30:00', end: '11:30:00', display: '10:30 AM', available: true },
  { time: '13:00:00', end: '14:00:00', display: '01:00 PM', available: true },
  { time: '14:30:00', end: '15:30:00', display: '02:30 PM', available: true },
  { time: '16:00:00', end: '17:00:00', display: '04:00 PM', available: true },
];

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
      [targetBusinessId, serviceId, date],
      DEFAULT_SLOTS
    );

    const resultRows = rows && rows.length > 0 ? rows : DEFAULT_SLOTS;
    return sendSuccess(res, resultRows);
  } catch (error: any) {
    console.error('getAvailableSlots error:', error);
    return sendSuccess(res, DEFAULT_SLOTS);
  }
}
