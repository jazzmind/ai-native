const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

function layout(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; color: #1f2937; background: #f9fafb;">
  <div style="text-align: center; padding: 16px 0; border-bottom: 1px solid #e5e7eb; margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 700; color: #111827; margin: 0;">AIdvisory</h1>
  </div>
  ${content}
  <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; text-align: center; font-size: 12px; color: #9ca3af;">
    <p>AIdvisory — Your AI Advisory Board</p>
    <p><a href="${APP_URL}" style="color: #6b7280;">Visit AIdvisory</a> | <a href="#" style="color: #6b7280;">Unsubscribe</a></p>
  </div>
</body>
</html>`;
}

export function expertApplicationReceived(expert: { displayName: string; email: string; domains: string }) {
  return {
    subject: `New expert application: ${expert.displayName}`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">New Expert Application</h2>
      <p><strong>${expert.displayName}</strong> (${expert.email}) has applied to join the expert network.</p>
      <p><strong>Domains:</strong> ${expert.domains}</p>
      <p><a href="${APP_URL}/admin/experts" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Review Application</a></p>
    `),
  };
}

export function expertApproved(expert: { displayName: string; email: string }) {
  return {
    subject: `Welcome to the AIdvisory Expert Network!`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">You're in, ${expert.displayName}!</h2>
      <p>Your application to the AIdvisory Expert Network has been approved. You can now receive and accept review requests from founders.</p>
      <p><a href="${APP_URL}/expert/dashboard" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Go to Expert Dashboard</a></p>
    `),
  };
}

export function expertNewRequest(expert: { displayName: string }, request: { title: string; domain: string; budgetCents: number; id: string }) {
  return {
    subject: `New review request: ${request.title}`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">New Review Request</h2>
      <p>Hi ${expert.displayName}, a new review request matches your expertise:</p>
      <div style="background: #f3f4f6; border-radius: 8px; padding: 16px; margin: 16px 0;">
        <p style="margin: 0 0 8px;"><strong>${request.title}</strong></p>
        <p style="margin: 0 0 4px; font-size: 14px; color: #6b7280;">Domain: ${request.domain}</p>
        <p style="margin: 0; font-size: 14px; color: #059669; font-weight: 600;">Budget: $${(request.budgetCents / 100).toFixed(0)}</p>
      </div>
      <p><a href="${APP_URL}/expert/dashboard" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View & Accept</a></p>
    `),
  };
}

export function expertAwardConfirmation(expert: { displayName: string }, request: { title: string }, deadline: Date) {
  return {
    subject: `You've been selected: ${request.title}`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">You've been selected!</h2>
      <p>Hi ${expert.displayName}, you've been chosen to review: <strong>${request.title}</strong></p>
      <p><strong>Delivery deadline:</strong> ${deadline.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
      <p><a href="${APP_URL}/expert/dashboard" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Start Review</a></p>
    `),
  };
}

export function userRequestAwarded(user: { name: string }, request: { title: string }, expertName: string) {
  return {
    subject: `Expert matched: ${request.title}`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">Expert Matched!</h2>
      <p>Hi ${user.name}, great news — <strong>${expertName}</strong> has accepted your review request for "${request.title}".</p>
      <p>You'll receive the completed review within 48 hours.</p>
      <p><a href="${APP_URL}/dashboard" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Status</a></p>
    `),
  };
}

export function expertDeliveryConfirmation(expert: { displayName: string }, request: { title: string }) {
  return {
    subject: `Review delivered: ${request.title}`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">Review Delivered</h2>
      <p>Hi ${expert.displayName}, your review for "${request.title}" has been delivered. Payment will be processed to your Stripe account shortly.</p>
      <p><a href="${APP_URL}/expert/dashboard" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Dashboard</a></p>
    `),
  };
}

export function userReviewComplete(user: { name: string }, request: { title: string }, reviewUrl: string) {
  return {
    subject: `Expert review complete: ${request.title}`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">Your Expert Review is Ready</h2>
      <p>Hi ${user.name}, the expert review for "${request.title}" has been completed.</p>
      <p><a href="${APP_URL}${reviewUrl}" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">View Review</a></p>
    `),
  };
}

export function requestExpired(user: { name: string }, request: { title: string }) {
  return {
    subject: `Review request expired: ${request.title}`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">Request Expired</h2>
      <p>Hi ${user.name}, unfortunately no expert was available to review "${request.title}" within the time window. Your payment has been refunded automatically.</p>
      <p>You can post a new request with a higher budget or different domain to increase matches.</p>
      <p><a href="${APP_URL}/dashboard" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Try Again</a></p>
    `),
  };
}

export function paymentFailed(user: { name: string }, org: { name: string }) {
  return {
    subject: `Payment failed for ${org.name}`,
    html: layout(`
      <h2 style="font-size: 18px; color: #111827;">Payment Failed</h2>
      <p>Hi ${user.name}, we were unable to process your subscription payment for ${org.name}.</p>
      <p>Please update your payment method to continue using AIdvisory Pro features.</p>
      <p><a href="${APP_URL}/settings/billing" style="display: inline-block; padding: 10px 20px; background: #2563eb; color: white; text-decoration: none; border-radius: 8px; font-weight: 600;">Update Payment</a></p>
    `),
  };
}
