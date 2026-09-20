import dotenv from 'dotenv';
dotenv.config();

import { sendTestEmail, EMAIL_DISPATCH_LOGS } from './src/services/emailService';

async function main() {
  console.log('--- Bookmi Outbound Email Service Diagnostics ---');
  console.log(`Node Environment: ${process.env.NODE_ENV}`);
  console.log(`RESEND_API_KEY set: ${Boolean(process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.length > 5)}`);
  console.log(`SMTP_HOST set: ${process.env.SMTP_HOST || '(none)'}`);
  console.log(`SMTP_USER set: ${process.env.SMTP_USER || '(none)'}`);
  
  const targetEmail = process.argv[2] || 'test@example.com';
  console.log(`\nDispatching test diagnostic email to: ${targetEmail}...`);

  const { result, log } = await sendTestEmail({
    to: targetEmail,
    customNote: 'Diagnostics test run from CLI verification script',
  });

  console.log('\n--- Result Summary ---');
  console.log(`Channel Used:   ${result.channel}`);
  console.log(`Delivered:      ${result.delivered}`);
  console.log(`External ID:    ${result.externalId || '(none)'}`);
  if (result.error) {
    console.log(`Error:          ${result.error}`);
  }
  console.log(`Ledger Log ID:  ${log.id}`);
  console.log(`Ledger Status:  ${log.status}`);
  console.log('\nDispatched email log in memory:');
  console.log(JSON.stringify(EMAIL_DISPATCH_LOGS[0], null, 2));
}

main().catch((err) => {
  console.error('Fatal error in email test:', err);
  process.exit(1);
});
