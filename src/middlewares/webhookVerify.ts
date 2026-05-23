// ============================================================
// Webhook Signature Verification Middleware
// ============================================================
// NEW CONCEPT: WEBHOOK SECURITY
//
// When GitHub sends a webhook to your API, how do you know
// it's ACTUALLY from GitHub and not some attacker sending
// fake payloads to trigger your pipeline?
//
// Answer: HMAC Signature Verification
//
// HOW IT WORKS:
//   1. You set a "secret" when configuring the webhook on GitHub
//   2. GitHub uses that secret to create an HMAC-SHA256 signature
//      of the request body
//   3. GitHub sends the signature in the X-Hub-Signature-256 header
//   4. Your server recreates the signature using the same secret
//   5. If they match → legitimate request from GitHub
//      If they don't → reject it (someone is faking it)
//
// This is the same pattern used by Stripe webhooks, Slack events,
// Twilio callbacks — any service that sends webhooks to your API.
// ============================================================

import { createHmac, timingSafeEqual } from "crypto";
import { Request, Response, NextFunction } from "express";

export const verifyWebhookSignature = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const signature = req.headers["x-hub-signature-256"] as string;
  const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error("[Webhook] GITHUB_WEBHOOK_SECRET not configured");
    res.status(500).json({ success: false, message: "Webhook secret not configured" });
    return;
  }

  if (!signature) {
    console.warn("[Webhook] Request missing X-Hub-Signature-256 header");
    res.status(401).json({ success: false, message: "Missing signature" });
    return;
  }

  // Recreate the signature using our secret
  const body = JSON.stringify(req.body);
  const expectedSignature =
    "sha256=" + createHmac("sha256", webhookSecret).update(body).digest("hex");

  // Use timingSafeEqual to prevent timing attacks
  // (A regular === comparison leaks info about which characters matched)
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    console.warn("[Webhook] Invalid signature — rejecting request");
    res.status(401).json({ success: false, message: "Invalid signature" });
    return;
  }

  console.log("[Webhook] Signature verified ✓");
  next();
};
