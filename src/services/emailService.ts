export interface EmailMessage {
  id: string;
  to: string;
  recipientRole: 'CLIENT' | 'ADMIN';
  businessId: string;
  bookingReference: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  status: 'SENT' | 'QUEUED';
  sentAt: string;
}

export const EMAIL_DISPATCH_LOGS: EmailMessage[] = [];

function generateEmailTemplate(title: string, subtitle: string, contentHtml: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background: #0b1120; color: #e2e8f0; margin: 0; padding: 24px; }
    .container { max-width: 600px; margin: 0 auto; background: #1e293b; border-radius: 12px; border: 1px solid #334155; overflow: hidden; }
    .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 28px; text-align: center; }
    .header h1 { margin: 0; color: #ffffff; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; }
    .header p { margin: 6px 0 0 0; color: #ecfdf5; font-size: 14px; }
    .content { padding: 32px 28px; line-height: 1.6; }
    .card { background: #0f172a; border-radius: 8px; border: 1px solid #334155; padding: 18px; margin: 20px 0; }
    .footer { text-align: center; padding: 20px; font-size: 12px; color: #94a3b8; border-top: 1px solid #334155; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 99px; font-weight: 700; font-size: 12px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <p>${subtitle}</p>
    </div>
    <div class="content">
      ${contentHtml}
    </div>
    <div class="footer">
      <p>Sent automatically via <strong>BookMe Core Notification Engine</strong>.</p>
    </div>
  </div>
</body>
</html>
  `.trim();
}

export async function sendBookingCreatedEmails(params: {
  bookingReference: string;
  businessId: string;
  businessName: string;
  businessEmail: string;
  businessAddress?: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  serviceName: string;
  serviceDuration: number;
  bookingDate: string;
  startTime: string;
  amount: number;
  currency: string;
  notes?: string;
}) {
  const timestamp = new Date().toISOString();

  // 1. Email to Customer (Client)
  const clientSubject = `Booking Confirmed: ${params.serviceName} at ${params.businessName} [#${params.bookingReference}]`;
  const clientText = `Hi ${params.customerName},\n\nYour appointment for ${params.serviceName} at ${params.businessName} on ${params.bookingDate} at ${params.startTime} has been successfully scheduled.\n\nBooking Reference: #${params.bookingReference}\nDuration: ${params.serviceDuration} mins\nAmount: ${params.currency} ${params.amount.toLocaleString()}\nAddress: ${params.businessAddress || 'Venue'}\n\nThank you for choosing ${params.businessName}!`;

  const clientHtml = generateEmailTemplate(
    'Booking Confirmed!',
    `Your appointment with ${params.businessName} is scheduled`,
    `
      <p>Hi <strong>${params.customerName}</strong>,</p>
      <p>Thank you for scheduling with <strong>${params.businessName}</strong>. Here are your verified booking details:</p>
      <div class="card">
        <p style="margin: 4px 0;"><strong>Booking Reference:</strong> <span style="color: #10b981; font-weight: 800;">#${params.bookingReference}</span></p>
        <p style="margin: 4px 0;"><strong>Service:</strong> ${params.serviceName} (${params.serviceDuration} mins)</p>
        <p style="margin: 4px 0;"><strong>Date & Time:</strong> ${params.bookingDate} at ${params.startTime}</p>
        <p style="margin: 4px 0;"><strong>Venue / Location:</strong> ${params.businessAddress || 'Confirmed upon arrival'}</p>
        <p style="margin: 4px 0;"><strong>Total Price:</strong> ${params.currency} ${params.amount.toLocaleString()}</p>
      </div>
      ${params.notes ? `<p><strong>Special Notes:</strong> ${params.notes}</p>` : ''}
      <p>If you need to reschedule or have any questions, please contact ${params.businessName} at <a href="mailto:${params.businessEmail}" style="color: #10b981;">${params.businessEmail}</a>.</p>
    `
  );

  const clientLog: EmailMessage = {
    id: 'em-' + Date.now() + '-c',
    to: params.customerEmail,
    recipientRole: 'CLIENT',
    businessId: params.businessId,
    bookingReference: params.bookingReference,
    subject: clientSubject,
    textBody: clientText,
    htmlBody: clientHtml,
    status: 'SENT',
    sentAt: timestamp,
  };
  EMAIL_DISPATCH_LOGS.unshift(clientLog);
  console.log(`[EmailService] Dispatched Client Email to ${params.customerEmail}: "${clientSubject}"`);

  // 2. Email to Business Admin
  const adminRecipient = params.businessEmail || 'admin@bookme.local';
  const adminSubject = `New Booking Received: ${params.customerName} - ${params.serviceName} [#${params.bookingReference}]`;
  const adminText = `Hello Team,\n\nA new appointment has been scheduled:\n\nCustomer: ${params.customerName} (${params.customerEmail}, ${params.customerPhone || 'N/A'})\nService: ${params.serviceName}\nDate: ${params.bookingDate} at ${params.startTime}\nReference: #${params.bookingReference}\nNotes: ${params.notes || 'None'}\n\nPlease check your BookMe Admin Dashboard for details.`;

  const adminHtml = generateEmailTemplate(
    'New Customer Booking!',
    `Appointment scheduled for ${params.bookingDate}`,
    `
      <p>Hello <strong>${params.businessName} Admin</strong>,</p>
      <p>A new customer has confirmed an appointment:</p>
      <div class="card">
        <p style="margin: 4px 0;"><strong>Customer Name:</strong> ${params.customerName}</p>
        <p style="margin: 4px 0;"><strong>Customer Email:</strong> <a href="mailto:${params.customerEmail}" style="color: #60a5fa;">${params.customerEmail}</a></p>
        <p style="margin: 4px 0;"><strong>Customer Phone:</strong> ${params.customerPhone || 'Not provided'}</p>
        <p style="margin: 4px 0;"><strong>Service Booked:</strong> ${params.serviceName} (${params.serviceDuration} mins)</p>
        <p style="margin: 4px 0;"><strong>Appointment Slot:</strong> ${params.bookingDate} at ${params.startTime}</p>
        <p style="margin: 4px 0;"><strong>Reference:</strong> #${params.bookingReference}</p>
        <p style="margin: 4px 0;"><strong>Customer Notes:</strong> ${params.notes || 'None'}</p>
      </div>
      <p>Log into your BookMe Portal to manage, reschedule, or communicate with this customer.</p>
    `
  );

  const adminLog: EmailMessage = {
    id: 'em-' + Date.now() + '-a',
    to: adminRecipient,
    recipientRole: 'ADMIN',
    businessId: params.businessId,
    bookingReference: params.bookingReference,
    subject: adminSubject,
    textBody: adminText,
    htmlBody: adminHtml,
    status: 'SENT',
    sentAt: timestamp,
  };
  EMAIL_DISPATCH_LOGS.unshift(adminLog);
  console.log(`[EmailService] Dispatched Admin Email to ${adminRecipient}: "${adminSubject}"`);

  return { clientLog, adminLog };
}

export async function sendBookingStatusChangedEmails(params: {
  bookingReference: string;
  businessId: string;
  businessName: string;
  businessEmail: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  bookingDate: string;
  startTime: string;
  newStatus: string;
  reason?: string;
}) {
  const timestamp = new Date().toISOString();

  // 1. Email to Customer
  const clientSubject = `Booking #${params.bookingReference} Status Update: ${params.newStatus}`;
  const clientText = `Hi ${params.customerName},\n\nThe status of your appointment for ${params.serviceName} with ${params.businessName} on ${params.bookingDate} at ${params.startTime} has been updated to: ${params.newStatus}.\n\nReference: #${params.bookingReference}\n${params.reason ? `Reason / Note: ${params.reason}\n` : ''}\nIf you have any questions, reply to this email or contact ${params.businessEmail}.`;

  const clientHtml = generateEmailTemplate(
    `Booking Update: ${params.newStatus}`,
    `Notice regarding booking #${params.bookingReference}`,
    `
      <p>Hi <strong>${params.customerName}</strong>,</p>
      <p>Your appointment status with <strong>${params.businessName}</strong> has been updated:</p>
      <div class="card">
        <p style="margin: 4px 0;"><strong>Booking Reference:</strong> #${params.bookingReference}</p>
        <p style="margin: 4px 0;"><strong>Service:</strong> ${params.serviceName}</p>
        <p style="margin: 4px 0;"><strong>Scheduled For:</strong> ${params.bookingDate} at ${params.startTime}</p>
        <p style="margin: 4px 0;"><strong>New Status:</strong> <span style="color: #10b981; font-weight: 800;">${params.newStatus}</span></p>
        ${params.reason ? `<p style="margin: 4px 0;"><strong>Note / Reason:</strong> ${params.reason}</p>` : ''}
      </div>
      <p>If you have questions or need to make further adjustments, reach out to <strong>${params.businessName}</strong> at <a href="mailto:${params.businessEmail}" style="color: #10b981;">${params.businessEmail}</a>.</p>
    `
  );

  const clientLog: EmailMessage = {
    id: 'em-' + Date.now() + '-c',
    to: params.customerEmail,
    recipientRole: 'CLIENT',
    businessId: params.businessId,
    bookingReference: params.bookingReference,
    subject: clientSubject,
    textBody: clientText,
    htmlBody: clientHtml,
    status: 'SENT',
    sentAt: timestamp,
  };
  EMAIL_DISPATCH_LOGS.unshift(clientLog);

  // 2. Email to Admin
  const adminRecipient = params.businessEmail || 'admin@bookme.local';
  const adminSubject = `[Status Change] Booking #${params.bookingReference} set to ${params.newStatus}`;
  const adminText = `Booking #${params.bookingReference} for ${params.customerName} (${params.serviceName}) has been updated to ${params.newStatus}.\nCustomer notified at ${params.customerEmail}.`;

  const adminHtml = generateEmailTemplate(
    `Status Changed: ${params.newStatus}`,
    `Booking #${params.bookingReference} updated`,
    `
      <p>Hello <strong>${params.businessName} Admin</strong>,</p>
      <p>The appointment status has been updated:</p>
      <div class="card">
        <p style="margin: 4px 0;"><strong>Reference:</strong> #${params.bookingReference}</p>
        <p style="margin: 4px 0;"><strong>Customer:</strong> ${params.customerName} (${params.customerEmail})</p>
        <p style="margin: 4px 0;"><strong>Status:</strong> <strong>${params.newStatus}</strong></p>
        ${params.reason ? `<p style="margin: 4px 0;"><strong>Reason:</strong> ${params.reason}</p>` : ''}
      </div>
      <p>Automated confirmation was emailed to <strong>${params.customerEmail}</strong>.</p>
    `
  );

  const adminLog: EmailMessage = {
    id: 'em-' + Date.now() + '-a',
    to: adminRecipient,
    recipientRole: 'ADMIN',
    businessId: params.businessId,
    bookingReference: params.bookingReference,
    subject: adminSubject,
    textBody: adminText,
    htmlBody: adminHtml,
    status: 'SENT',
    sentAt: timestamp,
  };
  EMAIL_DISPATCH_LOGS.unshift(adminLog);

  return { clientLog, adminLog };
}

export async function sendCustomResponseEmail(params: {
  bookingReference: string;
  businessId: string;
  businessName: string;
  businessEmail: string;
  customerName: string;
  customerEmail: string;
  message: string;
  senderName?: string;
}) {
  const timestamp = new Date().toISOString();

  // 1. Client Email
  const clientSubject = `Message from ${params.businessName}: Re: Booking #${params.bookingReference}`;
  const clientText = `Hi ${params.customerName},\n\nYou have a new message from ${params.businessName} regarding your booking #${params.bookingReference}:\n\n"${params.message}"\n\nTo respond, please reply directly to this email.`;

  const clientHtml = generateEmailTemplate(
    `Message from ${params.businessName}`,
    `Re: Appointment #${params.bookingReference}`,
    `
      <p>Hi <strong>${params.customerName}</strong>,</p>
      <p><strong>${params.businessName}</strong> has sent you a message regarding your appointment:</p>
      <div class="card" style="border-left: 4px solid #10b981;">
        <p style="font-size: 15px; font-style: italic; margin: 0; color: #f8fafc;">
          "${params.message}"
        </p>
      </div>
      <p>You can reply directly to this email at <a href="mailto:${params.businessEmail}" style="color: #10b981;">${params.businessEmail}</a>.</p>
    `
  );

  const clientLog: EmailMessage = {
    id: 'em-' + Date.now() + '-c',
    to: params.customerEmail,
    recipientRole: 'CLIENT',
    businessId: params.businessId,
    bookingReference: params.bookingReference,
    subject: clientSubject,
    textBody: clientText,
    htmlBody: clientHtml,
    status: 'SENT',
    sentAt: timestamp,
  };
  EMAIL_DISPATCH_LOGS.unshift(clientLog);

  // 2. Admin Copy Email
  const adminRecipient = params.businessEmail || 'admin@bookme.local';
  const adminSubject = `[Sent Copy] Message sent to ${params.customerName} [#${params.bookingReference}]`;
  const adminText = `A message was sent to ${params.customerName} (${params.customerEmail}) regarding booking #${params.bookingReference}:\n\n"${params.message}"`;

  const adminHtml = generateEmailTemplate(
    'Response Sent to Client',
    `Copy for your records`,
    `
      <p>Your message was successfully emailed to <strong>${params.customerName}</strong> (<a href="mailto:${params.customerEmail}">${params.customerEmail}</a>):</p>
      <div class="card">
        <p style="margin: 4px 0;"><strong>Booking Ref:</strong> #${params.bookingReference}</p>
        <p style="margin: 4px 0;"><strong>Message Sent:</strong></p>
        <blockquote style="margin: 8px 0; padding-left: 12px; border-left: 3px solid #60a5fa; color: #e2e8f0;">
          ${params.message}
        </blockquote>
      </div>
    `
  );

  const adminLog: EmailMessage = {
    id: 'em-' + Date.now() + '-a',
    to: adminRecipient,
    recipientRole: 'ADMIN',
    businessId: params.businessId,
    bookingReference: params.bookingReference,
    subject: adminSubject,
    textBody: adminText,
    htmlBody: adminHtml,
    status: 'SENT',
    sentAt: timestamp,
  };
  EMAIL_DISPATCH_LOGS.unshift(adminLog);

  return { clientLog, adminLog };
}

export function getDispatchedEmails(businessId?: string): EmailMessage[] {
  if (businessId) {
    return EMAIL_DISPATCH_LOGS.filter(e => e.businessId === businessId);
  }
  return EMAIL_DISPATCH_LOGS;
}
