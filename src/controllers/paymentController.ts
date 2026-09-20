import { Request, Response } from 'express';
import { pool } from '../db/pool';
import { sendSuccess, sendError } from '../utils/response';
import { PaystackService, PAYSTACK_PUBLIC_KEY } from '../services/paystackService';
import { IN_MEMORY_BOOKINGS, InMemoryBooking } from './bookingController';

export async function getPaystackConfig(req: Request, res: Response) {
  return sendSuccess(res, {
    public_key: PAYSTACK_PUBLIC_KEY,
    gateway: 'paystack',
    supported_channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
    currency: 'NGN',
  });
}

export async function initializePayment(req: Request, res: Response) {
  const {
    booking_id,
    booking_reference,
    email,
    amount,
    currency,
    callback_url,
    customer_name,
    service_name,
    business_name,
  } = req.body;

  if (!email || !amount) {
    return sendError(res, 'Email and amount are required for payment initialization', 400);
  }

  const numAmount = Number(amount);
  if (isNaN(numAmount) || numAmount <= 0) {
    return sendError(res, 'A valid positive amount is required', 400);
  }

  const customRef = booking_reference
    ? `PSK-${booking_reference}-${Date.now().toString(36)}`
    : undefined;

  try {
    const result = await PaystackService.initializeTransaction({
      email: email.trim().toLowerCase(),
      amount: numAmount,
      currency: currency || 'NGN',
      reference: customRef,
      callbackUrl: callback_url,
      metadata: {
        booking_id,
        booking_reference,
        customer_name,
        service_name,
        business_name,
      },
    });

    return sendSuccess(res, {
      ...result,
      public_key: PAYSTACK_PUBLIC_KEY,
    });
  } catch (err: any) {
    console.error('Error initializing Paystack payment:', err);
    return sendError(res, err?.message || 'Payment initialization failed', 500);
  }
}

export async function verifyPayment(req: Request, res: Response) {
  const { reference } = req.params;

  if (!reference) {
    return sendError(res, 'Payment reference is required', 400);
  }

  try {
    const result = await PaystackService.verifyTransaction(reference);

    if (result.verified) {
      // 1. Update in PostgreSQL
      try {
        await pool.query(
          `UPDATE bookings
           SET payment_status = 'PAID', status = 'CONFIRMED'
           WHERE booking_reference = $1 OR id::text = $1`,
          [reference.split('-')[1] || reference]
        );
      } catch (dbErr: any) {
        console.warn('DB update in verifyPayment warning:', dbErr.message);
      }

      // 2. Update in-memory bookings
      const match = IN_MEMORY_BOOKINGS.find(
        (b: InMemoryBooking) => b.booking_reference === reference ||
             reference.includes(b.booking_reference) ||
             b.id === reference
      );
      if (match) {
        match.payment_status = 'PAID';
        match.status = 'CONFIRMED';
      }

      console.log(`[Paystack] Verified payment reference ${reference} (Status: PAID)`);
      return sendSuccess(res, {
        verified: true,
        reference,
        payment_status: 'PAID',
        booking_status: 'CONFIRMED',
        details: result,
      });
    } else {
      return sendError(res, `Payment verification failed: status is ${result.status}`, 400);
    }
  } catch (err: any) {
    console.error('Error verifying Paystack payment:', err);
    return sendError(res, err?.message || 'Payment verification failed', 500);
  }
}

export async function handleWebhook(req: Request, res: Response) {
  const signature = req.headers['x-paystack-signature'] as string;
  const rawBody = JSON.stringify(req.body);

  if (!PaystackService.verifyWebhookSignature(rawBody, signature)) {
    console.warn('[Paystack Webhook] Invalid signature received.');
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  console.log(`[Paystack Webhook] Received event: ${event.event}`);

  if (event.event === 'charge.success') {
    const ref = event.data.reference;
    const bookingRef = event.data.metadata?.booking_reference || (ref.split('-')[1] || ref);

    try {
      await pool.query(
        `UPDATE bookings SET payment_status = 'PAID', status = 'CONFIRMED' WHERE booking_reference = $1`,
        [bookingRef]
      );
    } catch (err: any) {
      console.warn('DB update in webhook warning:', err.message);
    }

    const match = IN_MEMORY_BOOKINGS.find((b: InMemoryBooking) => b.booking_reference === bookingRef);
    if (match) {
      match.payment_status = 'PAID';
      match.status = 'CONFIRMED';
    }
  }

  return res.status(200).json({ received: true });
}
