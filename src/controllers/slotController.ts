import { Request, Response } from 'express';
import { safeQuery } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';

const DEFAULT_BUSINESS_ID = '00000000-0000-0000-0000-000000000001';

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

    return sendSuccess(res, rows || []);
  } catch (error: any) {
    console.error('getAvailableSlots error:', error);
    return sendError(res, 'Failed to calculate available slots from database', 500);
  }
}
