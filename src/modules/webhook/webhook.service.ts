// ============================================================
// Webhook Service — Event-Driven Architecture
// ============================================================
// NEW CONCEPT: WEBHOOKS
//
// In Projects 1-4, the flow was always:
//   User → sends request → YOUR API → processes → responds
//
// In this project, the flow is REVERSED:
//   GitHub → sends event → YOUR API → processes → responds to GitHub
//
// Your API doesn't know WHEN a PR will be opened. It just
// listens on an endpoint and waits. When GitHub fires, your
// API reacts.
//
// HOW WEBHOOKS WORK:
//   1. User registers a repo on your platform
//   2. You (or the user) configures a webhook on GitHub:
//      - URL: https://your-api.com/api/webhooks/github
//      - Secret: a shared secret for signature verification
//      - Events: Pull Request
//   3. When someone opens/updates a PR, GitHub POSTs to your URL
//   4. Your API verifies the signature, finds the repo config,
//      and triggers the AI review pipeline
//
// This is the same pattern used by:
//   - Stripe (payment events → your API)
//   - Slack (message events → your bot)
//   - Twilio (SMS/call events → your handler)
// ============================================================

import Repository from "./repository.model";
import { reviewPR } from "../review/review.service";
import { GitHubPRWebhook } from "../../types";

/**
 * Register a GitHub repository for AI code review
 */
export const registerRepository = async (
  userId: string,
  githubRepoFullName: string,
  reviewRules?: any
) => {
  const existing = await Repository.findOne({
    user: userId,
    githubRepoFullName,
  });

  if (existing) throw new Error("Repository already registered");

  const repo = await Repository.create({
    user: userId,
    githubRepoFullName,
    webhookActive: true,
    ...(reviewRules ? { reviewRules } : {}),
  });

  return {
    id: repo._id,
    githubRepoFullName: repo.githubRepoFullName,
    webhookActive: repo.webhookActive,
    reviewRules: repo.reviewRules,
    webhookUrl: "/api/webhooks/github",
    setupInstructions: {
      step1: `Go to https://github.com/${githubRepoFullName}/settings/hooks`,
      step2: `Click "Add webhook"`,
      step3: `Payload URL: https://YOUR_DOMAIN/api/webhooks/github`,
      step4: `Content type: application/json`,
      step5: `Secret: (same as your GITHUB_WEBHOOK_SECRET env var)`,
      step6: `Events: Select "Pull requests"`,
      step7: `Click "Add webhook"`,
    },
  };
};

/**
 * Handle incoming GitHub webhook event
 */
export const handleWebhook = async (
  event: string,
  payload: GitHubPRWebhook
) => {
  // We only care about Pull Request events
  if (event !== "pull_request") {
    console.log(`[Webhook] Ignoring event type: ${event}`);
    return { action: "ignored", reason: `Event type ${event} not handled` };
  }

  // We only review on these actions (not on close, label, etc.)
  const reviewableActions = ["opened", "synchronize", "reopened"];
  if (!reviewableActions.includes(payload.action)) {
    console.log(`[Webhook] Ignoring PR action: ${payload.action}`);
    return { action: "ignored", reason: `PR action ${payload.action} not reviewable` };
  }

  const repoFullName = payload.repository.full_name;

  console.log(
    `[Webhook] PR ${payload.action}: ${repoFullName}#${payload.number} "${payload.pull_request.title}"`
  );

  // Find the registered repository
  const repo = await Repository.findOne({
    githubRepoFullName: repoFullName,
    webhookActive: true,
  });

  if (!repo) {
    console.warn(`[Webhook] Repository ${repoFullName} not registered or inactive`);
    return { action: "skipped", reason: "Repository not registered" };
  }

  // Trigger the AI review pipeline (async — don't block the webhook response)
  // GitHub expects a response within 10 seconds, so we respond immediately
  // and process in the background
  console.log(`[Webhook] Triggering AI review for ${repoFullName}#${payload.number}`);

  // Fire and forget — respond to GitHub immediately, review runs in background
  reviewPR(payload, repo._id.toString(), repo.user.toString()).catch(
    (error) => {
      console.error(`[Webhook] Background review failed: ${error.message}`);
    }
  );

  return {
    action: "review_triggered",
    repository: repoFullName,
    pullNumber: payload.number,
    prTitle: payload.pull_request.title,
  };
};

/**
 * Get all repositories for a user
 */
export const getUserRepositories = async (userId: string) => {
  return Repository.find({ user: userId }).sort({ createdAt: -1 });
};

/**
 * Update repository review rules
 */
export const updateRepository = async (
  repoId: string,
  userId: string,
  updates: { webhookActive?: boolean; reviewRules?: any }
) => {
  const repo = await Repository.findOne({ _id: repoId, user: userId });
  if (!repo) throw new Error("Repository not found");

  if (updates.webhookActive !== undefined) repo.webhookActive = updates.webhookActive;
  if (updates.reviewRules) repo.reviewRules = { ...repo.reviewRules, ...updates.reviewRules } as any;

  await repo.save();
  return repo;
};

/**
 * Delete a repository
 */
export const deleteRepository = async (repoId: string, userId: string) => {
  const repo = await Repository.findOne({ _id: repoId, user: userId });
  if (!repo) throw new Error("Repository not found");
  await Repository.deleteOne({ _id: repoId });
};
