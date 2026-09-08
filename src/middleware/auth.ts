import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { pool } from '../db/pool';
import { sendError } from '../utils/response';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
  business?: {
    id: string;
  };
}

export async function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Unauthorized - Missing or malformed token', 401);
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-32chars';

    let decoded: any;
    try {
      decoded = jwt.verify(token, secret);
    } catch (err) {
      return sendError(res, 'Unauthorized - Invalid or expired token', 401);
    }

    // Lookup profile & business
    const { rows } = await pool.query(
      `SELECT id, business_id, full_name, role FROM admin_profiles WHERE id = $1`,
      [decoded.sub || decoded.id]
    );

    if (rows.length === 0) {
      // Fallback for default seed admin if Supabase GoTrue Auth user id matches decoded sub
      req.user = {
        id: decoded.sub || decoded.id || '00000000-0000-0000-0000-000000000002',
        email: decoded.email || 'admin@bookme.app',
        role: decoded.role || 'BUSINESS_ADMIN',
      };
      req.business = {
        id: decoded.business_id || '00000000-0000-0000-0000-000000000001',
      };
      return next();
    }

    const profile = rows[0];
    req.user = {
      id: profile.id,
      email: decoded.email,
      role: profile.role,
    };
    req.business = {
      id: profile.business_id,
    };

    next();
  } catch (error: any) {
    console.error('Auth middleware error:', error);
    return sendError(res, 'Internal Server Error', 500);
  }
}
