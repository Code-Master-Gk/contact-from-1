import express from "express";
import path from "path";
import dotenv from "dotenv";
import nodemailer from "nodemailer";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Simple in-memory Rate Limiting (5 submissions per IP every 15 minutes)
const rateLimitMap = new Map<string, { count: number; firstReset: number }>();

function checkRateLimit(ip: string): { allowed: boolean; remainingMs: number } {
  const now = Date.now();
  const windowMs = 15 * 60 * 1000; // 15 minutes
  const maxRequests = 5;

  const record = rateLimitMap.get(ip);
  if (!record || now - record.firstReset > windowMs) {
    rateLimitMap.set(ip, { count: 1, firstReset: now });
    return { allowed: true, remainingMs: 0 };
  }

  if (record.count >= maxRequests) {
    const remainingMs = windowMs - (now - record.firstReset);
    return { allowed: false, remainingMs };
  }

  record.count += 1;
  return { allowed: true, remainingMs: 0 };
}

// Destination email address
const DESTINATION_EMAIL = process.env.CONTACT_DESTINATION_EMAIL || "gopalkumahto3@gmail.com";

// Helper to create Nodemailer Transporter dynamically
function getEmailTransporter() {
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  if (!user || !pass) {
    return null; // Return null if SMTP credentials are not yet configured
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
  });
}

// POST /api/contact - Secure Contact Form Endpoint
app.post("/api/contact", async (req, res) => {
  try {
    const clientIp = (req.headers["x-forwarded-for"] as string || req.socket.remoteAddress || "127.0.0.1").split(",")[0].trim();

    // 1. Rate Limiting Check
    const rateCheck = checkRateLimit(clientIp);
    if (!rateCheck.allowed) {
      const minutes = Math.ceil(rateCheck.remainingMs / 60000);
      return res.status(429).json({
        success: false,
        error: `Too many submissions from your IP. Please try again in ${minutes} minute(s).`,
      });
    }

    const {
      fullName,
      workEmail,
      phoneNumber,
      companyName,
      enquiryType,
      subject,
      message,
      privacyConsent,
      _website_url_hp, // Spam Honeypot Field
    } = req.body || {};

    // 2. Anti-Spam Honeypot Check
    // If hidden honeypot field is filled out by automated bots, silently return success without sending email
    if (_website_url_hp && _website_url_hp.trim() !== "") {
      console.log(`[SPAM BLOCKED] Honeypot field filled by IP: ${clientIp}`);
      return res.status(200).json({
        success: true,
        message: "Thank you! Your enquiry has been received. I'll get back to you shortly.",
      });
    }

    // 3. Server-side Validation
    const errors: Record<string, string> = {};

    if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
      errors.fullName = "Full name is required (min 2 characters).";
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!workEmail || typeof workEmail !== "string" || !emailRegex.test(workEmail.trim())) {
      errors.workEmail = "Valid work email address is required.";
    }

    if (!enquiryType || typeof enquiryType !== "string" || enquiryType.trim() === "") {
      errors.enquiryType = "Please select an enquiry type.";
    }

    if (!subject || typeof subject !== "string" || subject.trim().length < 3) {
      errors.subject = "Subject is required (min 3 characters).";
    }

    if (!message || typeof message !== "string" || message.trim().length < 10) {
      errors.message = "Message details are required (min 10 characters).";
    }

    if (!privacyConsent) {
      errors.privacyConsent = "You must agree to the Privacy Policy to submit an enquiry.";
    }

    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: "Validation failed. Please correct the fields.",
        details: errors,
      });
    }

    // Sanitize inputs
    const cleanName = fullName.trim();
    const cleanEmail = workEmail.trim();
    const cleanPhone = phoneNumber ? phoneNumber.trim() : "Not provided";
    const cleanCompany = companyName ? companyName.trim() : "Not provided";
    const cleanEnquiryType = enquiryType.trim();
    const cleanSubject = subject.trim();
    const cleanMessage = message.trim();
    const timestamp = new Date().toLocaleString("en-GB", { timeZone: "Asia/Kolkata" });

    // 4. Formatted Email Text
    const formattedEmailText = `New Contact Form Enquiry

Name: ${cleanName}
Email: ${cleanEmail}
Phone: ${cleanPhone}
Company: ${cleanCompany}
Enquiry Type: ${cleanEnquiryType}
Subject: ${cleanSubject}

Message:
${cleanMessage}

----------------------------------------
Submitted at: ${timestamp} (IST)
IP Address: ${clientIp}
`;

    const formattedEmailHtml = `
      <div style="font-family: Arial, sans-serif; color: #172033; max-width: 600px; margin: 0 auto; border: 1px solid #E2E8F0; border-radius: 8px; padding: 24px; background-color: #FFFFFF;">
        <h2 style="color: #0B1F3A; border-bottom: 2px solid #1D4ED8; padding-bottom: 8px; margin-top: 0;">New Contact Form Enquiry</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
          <tr>
            <td style="padding: 8px 0; font-weight: bold; width: 130px; color: #475569;">Name:</td>
            <td style="padding: 8px 0; color: #0B1F3A; font-weight: 600;">${cleanName}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Work Email:</td>
            <td style="padding: 8px 0;"><a href="mailto:${cleanEmail}" style="color: #1D4ED8;">${cleanEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Phone Number:</td>
            <td style="padding: 8px 0; color: #0B1F3A;">${cleanPhone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Company Name:</td>
            <td style="padding: 8px 0; color: #0B1F3A;">${cleanCompany}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Enquiry Type:</td>
            <td style="padding: 8px 0; color: #1D4ED8; font-weight: 600;">${cleanEnquiryType}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; font-weight: bold; color: #475569;">Subject:</td>
            <td style="padding: 8px 0; color: #0B1F3A; font-weight: 600;">${cleanSubject}</td>
          </tr>
        </table>
        
        <div style="margin-top: 20px; padding: 16px; background-color: #F8FAFC; border-left: 4px solid #1D4ED8; border-radius: 4px;">
          <h4 style="margin: 0 0 8px 0; color: #0B1F3A;">Message:</h4>
          <p style="margin: 0; white-space: pre-wrap; line-height: 1.6; color: #334155;">${cleanMessage}</p>
        </div>

        <div style="margin-top: 24px; font-size: 11px; color: #94A3B8; border-top: 1px solid #E2E8F0; padding-top: 12px;">
          Submitted at: ${timestamp} | IP: ${clientIp}
        </div>
      </div>
    `;

    // 5. Send Email via Nodemailer or Dry-run Logger
    const transporter = getEmailTransporter();

    if (transporter) {
      const fromEmail = process.env.SMTP_FROM || process.env.SMTP_USER || DESTINATION_EMAIL;

      await transporter.sendMail({
        from: `"${cleanName} via Contact Form" <${fromEmail}>`,
        replyTo: cleanEmail,
        to: DESTINATION_EMAIL,
        subject: `New Contact Form Enquiry: ${cleanSubject}`,
        text: formattedEmailText,
        html: formattedEmailHtml,
      });

      console.log(`[SUCCESS] Contact enquiry sent to ${DESTINATION_EMAIL} from ${cleanEmail}`);
    } else {
      // Dry-run mode: Log formatted email to console when SMTP keys are pending setup
      console.log(`\n==================================================`);
      console.log(`[DRY-RUN / SMTP PENDING CONFIGURATION]`);
      console.log(`Destination Email: ${DESTINATION_EMAIL}`);
      console.log(`Subject: New Contact Form Enquiry: ${cleanSubject}`);
      console.log(`--------------------------------------------------`);
      console.log(formattedEmailText);
      console.log(`==================================================\n`);
    }

    return res.status(200).json({
      success: true,
      message: "Thank you! Your enquiry has been received. I'll get back to you shortly.",
    });

  } catch (error: any) {
    console.error("[ERROR] Contact form submission failed:", error);
    return res.status(500).json({
      success: false,
      error: "Sorry, something went wrong. Please try again or contact me directly by email.",
    });
  }
});

// Start Server & Vite Middleware Configuration
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.use(express.static(process.cwd()));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "contact-form.html"));
    });
  }

  // Always serve contact-form.html at root
  app.get("/", (req, res) => {
    res.sendFile(path.join(process.cwd(), "contact-form.html"));
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Contact Form Backend running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
