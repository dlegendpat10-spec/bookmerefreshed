import {
  sendBookingCreatedEmails,
  sendRegistrationWelcomeEmail,
  sendPasswordResetEmail,
  getDispatchedEmails,
  EMAIL_DISPATCH_LOGS
} from '../src/services/emailService';

async function testEmailService() {
  console.log('--- 1. Testing Registration Welcome Email ---');
  const regEmail = await sendRegistrationWelcomeEmail({
    fullName: 'Test User',
    email: 'test@example.com',
    role: 'CLIENT',
  });
  console.log('✓ Registration Email created:', {
    id: regEmail.id,
    to: regEmail.to,
    subject: regEmail.subject,
    status: regEmail.status,
  });

  console.log('\n--- 2. Testing Password Reset Email ---');
  const resetEmail = await sendPasswordResetEmail({
    email: 'test@example.com',
    resetToken: 'test-token-12345',
    resetUrl: 'http://localhost:5173/auth/reset-password?token=test-token-12345&email=test@example.com',
    fullName: 'Test User',
  });
  console.log('✓ Password Reset Email created:', {
    id: resetEmail.id,
    to: resetEmail.to,
    subject: resetEmail.subject,
    status: resetEmail.status,
  });

  console.log('\n--- 3. Testing Booking Created Emails ---');
  const bookingEmails = await sendBookingCreatedEmails({
    bookingReference: 'BK-99999',
    businessId: '00000000-0000-0000-0000-000000000001',
    businessName: 'Luxe Aesthetics',
    businessEmail: 'contact@luxeaesthetics.com',
    customerName: 'Alice Smith',
    customerEmail: 'alice@example.com',
    serviceName: 'HydraFacial Glow',
    serviceDuration: 60,
    bookingDate: '2026-09-25',
    startTime: '14:00',
    amount: 15000,
    currency: '₦',
  });
  console.log('✓ Booking Client Email:', bookingEmails.clientLog.subject);
  console.log('✓ Booking Admin Email:', bookingEmails.adminLog.subject);

  console.log('\n--- 4. Checking Total Dispatched Queue ---');
  const allLogs = getDispatchedEmails();
  console.log(`Total messages in dispatch log: ${allLogs.length}`);

  if (allLogs.length === 4) {
    console.log('✓ ALL EMAIL SERVICE METHODS ARE FUNCTIONING PROPERLY IN-ENGINE.');
  } else {
    console.error('Mismatch in dispatched logs count.');
  }
}

testEmailService().catch(console.error);
