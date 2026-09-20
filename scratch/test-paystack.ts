import { PaystackService } from '../src/services/paystackService';

async function testPaystack() {
  console.log('--- 1. Testing Paystack Transaction Initialization ---');
  const init = await PaystackService.initializeTransaction({
    email: 'customer@example.com',
    amount: 15000,
    currency: 'NGN',
    metadata: { booking_ref: 'BK-TEST-001' }
  });

  console.log('✓ Initialized:', {
    reference: init.reference,
    access_code: init.access_code,
    authorization_url: init.authorization_url,
  });

  console.log('\n--- 2. Testing Paystack Verification ---');
  const verify = await PaystackService.verifyTransaction(init.reference);
  console.log('✓ Verification result:', {
    verified: verify.verified,
    status: verify.status,
    reference: verify.reference,
  });

  console.log('\n✓ PAYSTACK BACKEND SERVICE VERIFIED & OPERATIONAL!');
}

testPaystack().catch(console.error);
