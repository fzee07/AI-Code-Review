// ============================================================
// Webhook Routes
// ============================================================
// This file has TWO types of authentication:
//
// 1. GitHub Webhook (POST /github):
//    - NOT protected by JWT
//    - Protected by HMAC signature verification instead
//    - GitHub doesn't have your JWT — it has a shared secret
//
// 2. Repository Management (POST/GET/PATCH/DELETE /repos):
//    - Protected by JWT (normal auth)
//    - Only the user who registered the repo can manage it
//
// Key insight: different endpoints can use different auth
// strategies. Your webhook endpoint and your user endpoints
// serve different clients (GitHub vs. browser/Postman).
// ============================================================

import { Router } from "express";
import * as webhookController from "./webhook.controller";
import { protect } from "../../middlewares/auth";
import { verifyWebhookSignature } from "../../middlewares/webhookVerify";

const router = Router();

// ── GitHub Webhook (signature-verified, NOT JWT) ──
router.post("/github", verifyWebhookSignature, webhookController.handleGitHubWebhook);

// ── Repository Management (JWT-protected) ──
router.post("/repos", protect, webhookController.registerRepo);
router.get("/repos", protect, webhookController.getAllRepos);
router.patch("/repos/:id", protect, webhookController.updateRepo);
router.delete("/repos/:id", protect, webhookController.deleteRepo);

export default router;
