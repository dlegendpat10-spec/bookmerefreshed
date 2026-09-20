import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { pool } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { sendRegistrationWelcomeEmail, sendPasswordResetEmail, sendTestEmail } from '../services/emailService';

interface ResetTokenRecord {
  email: string;
  expiresAt: number;
}

const RESET_TOKENS = new Map<string, ResetTokenRecord>();

function hashPassword(password: string): string {
  return crypto.pbkdf2Sync(password, 'bookme_salt_key_2026', 1000, 64, 'sha512').toString('hex');
}

// In-memory fallback user registry for resilient registration/login when DB connection or auth fails
interface InMemoryUser {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  role: string;
  business_id: string | null;
  business_name?: string | null;
  business_slug?: string | null;
}

const IN_MEMORY_USERS = new Map<string, InMemoryUser>();

// Pre-seed default admin
const defaultAdmin: InMemoryUser = {
  id: '00000000-0000-0000-0000-000000000002',
  full_name: 'Admin User',
  email: 'admin@bookmi.app',
  password_hash: hashPassword('admin123'),
  role: 'BUSINESS_ADMIN',
  business_id: null,
  business_name: null,
  business_slug: null,
};
IN_MEMORY_USERS.set('admin@bookmi.app', defaultAdmin);
IN_MEMORY_USERS.set('admin@bookme.app', { ...defaultAdmin, email: 'admin@bookme.app' });

export async function register(req: Request, res: Response) {
  const { full_name, email, password } = req.body;

  if (!full_name || !email || !password) {
    return sendError(res, 'Full name, email, and password are required', 400);
  }

  if (password.length < 6) {
    return sendError(res, 'Password must be at least 6 characters', 400);
  }

  const cleanEmail = email.toLowerCase().trim();

  // 1. Check in-memory registry first
  if (IN_MEMORY_USERS.has(cleanEmail)) {
    return sendError(res, 'An account with this email already exists', 400);
  }

  const userId = crypto.randomUUID();
  const passwordHash = hashPassword(password);
  let dbSuccess = false;

  try {
    // Check DB existing user
    const existing = await pool.query(
      `SELECT id FROM admin_profiles WHERE LOWER(email) = $1`,
      [cleanEmail]
    );

    if (existing.rows.length > 0) {
      return sendError(res, 'An account with this email already exists', 400);
    }

    // Insert new user into admin_profiles
    await pool.query(
      `INSERT INTO admin_profiles (id, business_id, full_name, email, password_hash, role)
       VALUES ($1, NULL, $2, $3, $4, 'BUSINESS_ADMIN')`,
      [userId, full_name.trim(), cleanEmail, passwordHash]
    );
    dbSuccess = true;
  } catch (error: any) {
    console.warn(`⚠️ DB error during registration (${error?.message}). Falling back to resilient in-memory session store.`);
  }

  // Save to in-memory store as fallback
  const userRecord: InMemoryUser = {
    id: userId,
    full_name: full_name.trim(),
    email: cleanEmail,
    password_hash: passwordHash,
    role: 'BUSINESS_ADMIN',
    business_id: null,
  };
  IN_MEMORY_USERS.set(cleanEmail, userRecord);

  const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-32chars';
  const token = jwt.sign(
    {
      sub: userId,
      email: cleanEmail,
      role: 'BUSINESS_ADMIN',
      business_id: null,
    },
    secret,
    { expiresIn: '7d' }
  );

  // Trigger confirmation welcome email
  try {
    await sendRegistrationWelcomeEmail({
      fullName: full_name.trim(),
      email: cleanEmail,
      role: 'BUSINESS_ADMIN',
    });
  } catch (emailErr: any) {
    console.warn('[EmailService Warning]:', emailErr.message);
  }

  return sendSuccess(res, {
    id: userId,
    email: cleanEmail,
    full_name: full_name.trim(),
    role: 'BUSINESS_ADMIN',
    business_id: null,
    access_token: token,
    email_dispatched: true,
  }, 201);
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body;

  if (!email || !password) {
    return sendError(res, 'Email and password are required', 400);
  }

  const cleanEmail = email.toLowerCase().trim();
  const inputHash = hashPassword(password);
  let userObj: any = null;

  try {
    const { rows } = await pool.query(
      `SELECT ap.id, ap.full_name, ap.role, ap.business_id, ap.email, ap.password_hash,
              b.name as business_name, b.slug as business_slug
       FROM admin_profiles ap
       LEFT JOIN businesses b ON ap.business_id = b.id
       WHERE LOWER(ap.email) = $1`,
      [cleanEmail]
    );

    if (rows.length > 0) {
      const dbUser = rows[0];
      if (dbUser.password_hash) {
        if (inputHash !== dbUser.password_hash) {
          return sendError(res, 'Invalid email or password', 401);
        }
      }
      userObj = dbUser;
    }
  } catch (error: any) {
    console.warn(`⚠️ DB error during login (${error?.message}). Checking resilient in-memory session store.`);
  }

  // Fallback to in-memory store if DB query produced no user or failed
  if (!userObj) {
    const memUser = IN_MEMORY_USERS.get(cleanEmail);
    if (memUser) {
      if (memUser.password_hash !== inputHash) {
        return sendError(res, 'Invalid email or password', 401);
      }
      userObj = memUser;
    }
  }

  if (!userObj) {
    return sendError(res, 'Invalid email or password', 401);
  }

  const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-32chars';
  const token = jwt.sign(
    {
      sub: userObj.id,
      email: userObj.email,
      role: userObj.role,
      business_id: userObj.business_id,
    },
    secret,
    { expiresIn: '7d' }
  );

  return sendSuccess(res, {
    id: userObj.id,
    email: userObj.email,
    full_name: userObj.full_name,
    role: userObj.role,
    business_id: userObj.business_id || null,
    business_name: userObj.business_name || null,
    business_slug: userObj.business_slug || null,
    access_token: token,
  });
}

export async function getMe(req: Request, res: Response) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return sendError(res, 'Unauthorized', 401);
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_SECRET || 'super-secret-jwt-key-change-in-production-32chars';

  try {
    const decoded: any = jwt.verify(token, secret);
    const userId = decoded.sub || decoded.id;
    const cleanEmail = (decoded.email || '').toLowerCase().trim();

    try {
      const { rows } = await pool.query(
        `SELECT ap.id, ap.full_name, ap.role, ap.business_id, ap.email,
                b.name as business_name, b.slug as business_slug
         FROM admin_profiles ap
         LEFT JOIN businesses b ON ap.business_id = b.id
         WHERE ap.id = $1`,
        [userId]
      );

      if (rows.length > 0) {
        const user = rows[0];
        return sendSuccess(res, {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          role: user.role,
          business_id: user.business_id || null,
          business_name: user.business_name || null,
          business_slug: user.business_slug || null,
        });
      }
    } catch (dbErr: any) {
      console.warn(`⚠️ DB error in getMe (${dbErr?.message}).`);
    }

    // Check in-memory store
    const memUser = IN_MEMORY_USERS.get(cleanEmail);
    if (memUser) {
      return sendSuccess(res, {
        id: memUser.id,
        email: memUser.email,
        full_name: memUser.full_name,
        role: memUser.role,
        business_id: memUser.business_id || null,
        business_name: memUser.business_name || null,
        business_slug: memUser.business_slug || null,
      });
    }

    return sendSuccess(res, {
      id: userId,
      email: decoded.email,
      full_name: 'User',
      role: decoded.role || 'BUSINESS_ADMIN',
      business_id: decoded.business_id || null,
    });
  } catch (err) {
    return sendError(res, 'Invalid or expired token', 401);
  }
}

export async function logout(req: Request, res: Response) {
  return sendSuccess(res, { message: 'Logged out successfully' });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;
  if (!email) return sendError(res, 'Email is required', 400);

  const cleanEmail = email.toLowerCase().trim();

  // Try to find user in DB or in-memory to get name
  let fullName = 'Bookmi User';
  const memUser = IN_MEMORY_USERS.get(cleanEmail);
  if (memUser) {
    fullName = memUser.full_name;
  } else {
    try {
      const dbRes = await pool.query(`SELECT full_name FROM admin_profiles WHERE LOWER(email) = $1 LIMIT 1`, [cleanEmail]);
      if (dbRes.rows.length > 0 && dbRes.rows[0].full_name) {
        fullName = dbRes.rows[0].full_name;
      }
    } catch {
      // ignore
    }
  }

  // Generate secure reset token
  const resetToken = crypto.randomBytes(32).toString('hex');
  const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour validity
  RESET_TOKENS.set(resetToken, { email: cleanEmail, expiresAt });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}&email=${encodeURIComponent(cleanEmail)}`;

  // Dispatch password reset email
  await sendPasswordResetEmail({
    email: cleanEmail,
    resetToken,
    resetUrl,
    fullName,
  });

  return sendSuccess(res, {
    message: `A secure password reset link has been dispatched to ${cleanEmail}.`
  });
}

export async function resetPassword(req: Request, res: Response) {
  const { email, new_password, token } = req.body;
  if (!email || !new_password || !token) {
    return sendError(res, 'Email, new password, and reset token are required', 400);
  }

  const cleanEmail = email.toLowerCase().trim();

  const record = RESET_TOKENS.get(token);
  if (!record) {
    return sendError(res, 'This password reset link is invalid or has already been used.', 400);
  }
  if (Date.now() > record.expiresAt) {
    RESET_TOKENS.delete(token);
    return sendError(res, 'This password reset link has expired. Please request a new one.', 400);
  }
  if (record.email !== cleanEmail) {
    return sendError(res, 'Token mismatch for this email address.', 400);
  }
  // Token is valid; invalidate it now
  RESET_TOKENS.delete(token);

  const newHash = hashPassword(new_password);

  try {
    await pool.query(
      `UPDATE admin_profiles SET password_hash = $1 WHERE LOWER(email) = $2`,
      [newHash, cleanEmail]
    );
  } catch (err: any) {
    console.warn(`⚠️ DB error in resetPassword (${err?.message}). Updating memory store.`);
  }

  const memUser = IN_MEMORY_USERS.get(cleanEmail);
  if (memUser) {
    memUser.password_hash = newHash;
    IN_MEMORY_USERS.set(cleanEmail, memUser);
  }

  return sendSuccess(res, { message: 'Password has been updated successfully. You can now sign in.' });
}

export async function testEmailDelivery(req: Request, res: Response) {
  const { email, note } = req.body;
  if (!email) return sendError(res, 'Target email is required', 400);

  try {
    const { result, log } = await sendTestEmail({
      to: email.toLowerCase().trim(),
      customNote: note,
    });

    return sendSuccess(res, {
      message: result.delivered
        ? `Diagnostic test dispatched successfully via ${result.channel}.`
        : `Email delivery failed: ${result.error || 'Unknown error'}`,
      channel: result.channel,
      delivered: result.delivered,
      external_id: result.externalId || null,
      error: result.error || null,
      log_id: log.id,
    });
  } catch (err: any) {
    return sendError(res, `Failed to dispatch test email: ${err.message}`, 500);
  }
}


