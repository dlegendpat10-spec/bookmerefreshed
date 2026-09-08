import { Request, Response, NextFunction } from 'express';
import { pool } from '../db/pool';

export async function checkIdempotency(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;
  if (!idempotencyKey) return next();

  try {
    const { rows } = await pool.query(
      `SELECT response_body, status_code FROM idempotency_keys WHERE key = $1`,
      [idempotencyKey]
    );

    if (rows.length > 0) {
      const { response_body, status_code } = rows[0];
      return res.status(status_code).json(response_body);
    }

    // Capture response for caching
    const originalJson = res.json.bind(res);
    res.json = (body: any) => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        pool.query(
          `INSERT INTO idempotency_keys (key, response_body, status_code) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
          [idempotencyKey, body, res.statusCode]
        ).catch(err => console.error('Idempotency save error:', err));
      }
      return originalJson(body);
    };

    next();
  } catch (error) {
    console.error('Idempotency middleware error:', error);
    next();
  }
}
