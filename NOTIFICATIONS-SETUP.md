# Lightroom Productions — Booking & Product Payment Notifications

This version sends a business-owner notification **after Razorpay payment verification succeeds**.

It covers:

- Wedding / event booking payments
- Product / Vowshot orders
- Email notification
- WhatsApp notification

A failed or unconfigured notification channel does **not** make a successfully verified Razorpay payment fail.

## 1. Email — Resend

Create a Resend account and API key. Resend provides a Node.js/REST email API.

Set these Vercel environment variables:

```text
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
RESEND_FROM_EMAIL=Lightroom Productions <your-verified-sender@your-domain.com>
NOTIFICATION_EMAIL_TO=help.lightroomproductions@gmail.com
```

The `RESEND_FROM_EMAIL` sender/domain must be accepted by Resend for production sending.

## 2. WhatsApp — Twilio

Create/activate a Twilio WhatsApp sender. For testing, Twilio provides a WhatsApp Sandbox. For production, use an approved WhatsApp sender and the appropriate WhatsApp template when required.

Set:

```text
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
NOTIFICATION_WHATSAPP_TO=whatsapp:+917044007755
```

The phone number must be in WhatsApp/E.164 format. Change the recipient if another business WhatsApp number should receive alerts.

### Production template option

If your Twilio WhatsApp setup requires an approved Content Template, also set:

```text
TWILIO_WHATSAPP_CONTENT_SID=HXxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_WHATSAPP_CONTENT_VARIABLES_JSON={"1":"Lightroom Productions payment alert"}
```

For a production setup, create the template in Twilio and configure its variables to match the alert format you want.

## 3. Add the variables in Vercel

In the Lightroom Productions Vercel project:

**Settings → Environment Variables**

Add the variables above for the environments you deploy to (normally Production, and Preview if you want to test there).

Then redeploy the latest GitHub commit.

## 4. What you will receive

### Wedding booking

The alert includes:

- Booking ID
- Customer name
- Phone
- Email
- Package
- Event dates
- Venue / city
- Advance or full payment
- Amount paid
- Remaining balance
- Razorpay payment ID

### Product order

The alert includes:

- Customer name
- Phone
- Email
- Items
- Variants/options
- Quantities
- Total paid
- Razorpay order ID
- Razorpay payment ID

## Important security note

Never put Resend API keys, Twilio credentials, Razorpay secret keys, or Supabase service-role keys inside HTML/JavaScript files. Keep them only in Vercel Environment Variables.
