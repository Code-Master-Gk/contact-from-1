# Production Deployment & Integration Guide

This guide provides step-by-step instructions to take your Contact Form live on your existing website and connect it to send real enquiries to **gopalkumahto3@gmail.com**.

---

## 1. Quick Architecture Overview

```
[ Visitor on Your Website ]
           │
           ▼
  [ HTML / CSS / Vanilla JS Contact Form ]
           │
           ▼ (HTTPS POST /api/contact)
  [ Secure Server / Serverless API Endpoint ]
           │  ├── Spam Honeypot Check
           │  ├── Server-Side Input Validation
           │  └── IP Rate Limiter
           │
           ▼ (Nodemailer / SMTP Transport)
  [ Email Delivery Service ]
           │
           ▼
[ gopalkumahto3@gmail.com ]
```

---

## 2. Environment Variables Configuration

Create a `.env` file on your server (or add these to your hosting provider's Environment Variables settings such as Vercel, Netlify, Render, Cloud Run, or AWS Lambda).

```env
# Destination email address for receiving form enquiries
CONTACT_DESTINATION_EMAIL="gopalkumahto3@gmail.com"

# SMTP Configuration (Recommended: Gmail App Password, Resend, SendGrid, or Mailgun)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT="587"
SMTP_SECURE="false"
SMTP_USER="gopalkumahto3@gmail.com"
SMTP_PASS="xxxx-xxxx-xxxx-xxxx"   # 16-character Gmail App Password
SMTP_FROM="gopalkumahto3@gmail.com"
```

> **Security Note**: Never commit actual passwords or API keys to GitHub or public repositories. Store them exclusively in server environment variables.

---

## 3. How to Set Up Gmail App Password for SMTP

If using Gmail (`smtp.gmail.com`):
1. Enable **2-Step Verification** on your Google Account (`gopalkumahto3@gmail.com`).
2. Go to **Google Account Settings** → **Security** → **App passwords**.
3. Create a new App password named `Contact Form` and copy the generated 16-character code (e.g. `abcd efgh ijkl mnop`).
4. Paste it as `SMTP_PASS` in your environment variables.

*(Alternatively, you can use transactional email services like **Resend**, **SendGrid**, or **Postmark** with standard SMTP or API keys).*

---

## 4. Embedding the Form into Your Existing Website

### Step A: Include the CSS Styles
Add `contact-form.css` into your existing website's `<head>` section:
```html
<link rel="stylesheet" href="/contact-form.css">
```

### Step B: Paste the HTML Markup
Copy the `<section class="contact-section">...</section>` block from `contact-form.html` and paste it into the desired page location on your website.

### Step C: Include the JavaScript File
Add `contact-form.js` before the closing `</body>` tag:
```html
<script src="/contact-form.js"></script>
```

> **Cross-Domain Setup Note**: If your backend server is hosted on a different domain or subdomain (e.g., `https://api.yourdomain.com`), update line 192 of `contact-form.js` to point to the full URL:
> ```js
> const response = await fetch('https://api.yourdomain.com/api/contact', { ... });
> ```

---

## 5. Deployment Options

### Option 1: Deploy as Node.js Application (Cloud Run, Render, Railway, DigitalOcean)
1. Run `npm install` to install dependencies (`express`, `nodemailer`, etc.).
2. Run `npm run build` to compile the Express server bundle.
3. Run `npm start` to launch the server on port 3000.

### Option 2: Deploy Backend to Vercel Serverless Functions
Create `/api/contact.js` in your Vercel project with the following serverless handler:
```javascript
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fullName, workEmail, phoneNumber, companyName, enquiryType, subject, message, privacyConsent, _website_url_hp } = req.body;

  // Anti-Spam Honeypot check
  if (_website_url_hp) {
    return res.status(200).json({ success: true, message: "Enquiry received." });
  }

  // Basic Validation
  if (!fullName || !workEmail || !enquiryType || !subject || !message || !privacyConsent) {
    return res.status(400).json({ success: false, error: "Missing required fields." });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  const emailText = `New Contact Form Enquiry\n\n` +
    `Name: ${fullName}\n` +
    `Email: ${workEmail}\n` +
    `Phone: ${phoneNumber || 'N/A'}\n` +
    `Company: ${companyName || 'N/A'}\n` +
    `Enquiry Type: ${enquiryType}\n` +
    `Subject: ${subject}\n\n` +
    `Message:\n${message}\n`;

  try {
    await transporter.sendMail({
      from: `"${fullName}" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
      replyTo: workEmail,
      to: process.env.CONTACT_DESTINATION_EMAIL || 'gopalkumahto3@gmail.com',
      subject: `New Contact Form Enquiry: ${subject}`,
      text: emailText,
    });

    return res.status(200).json({ success: true, message: "Enquiry received." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, error: "Email delivery failed." });
  }
}
```

---

## 6. Testing Your Deployed Form

1. Fill out all required fields (`Full Name`, `Work Email`, `Enquiry Type`, `Subject`, `Message`, and `Privacy Checkbox`).
2. Click **Send Enquiry**. Verify the button changes to **Sending...** with a spinner.
3. Verify the success notification appears:
   > **Thank you! Your enquiry has been received. I'll get back to you shortly.**
4. Check your inbox at **gopalkumahto3@gmail.com** for the incoming enquiry.
5. Test anti-spam honeypot or missing required fields to verify inline error feedback works without triggering alerts.
