import { Request, Response } from "express";
import * as webhookService from "./webhook.service";
import { AuthRequest } from "../../types";

// ── GitHub Webhook Endpoint (verified by signature middleware) ──

export const handleGitHubWebhook = async (req: Request, res: Response): Promise<void> => {
  try {
    const event = req.headers["x-github-event"] as string;
    const result = await webhookService.handleWebhook(event, req.body);

    // IMPORTANT: Respond to GitHub quickly (within 10 seconds)
    // The actual review runs in the background
    res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    console.error(`[Webhook] Error: ${error.message}`);
    // Still respond 200 to GitHub — otherwise it will retry
    res.status(200).json({ success: false, message: error.message });
  }
};

// ── Repository Management (protected routes) ──

export const registerRepo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { githubRepoFullName, reviewRules } = req.body;
    if (!githubRepoFullName) {
      res.status(400).json({ success: false, message: "Please provide githubRepoFullName (e.g., 'owner/repo')" });
      return;
    }

    // Validate format: "owner/repo"
    if (!githubRepoFullName.includes("/") || githubRepoFullName.split("/").length !== 2) {
      res.status(400).json({ success: false, message: "Invalid format. Use 'owner/repo-name'" });
      return;
    }

    const result = await webhookService.registerRepository(
      req.user!._id.toString(),
      githubRepoFullName,
      reviewRules
    );

    res.status(201).json({
      success: true,
      message: "Repository registered. Follow setup instructions to configure the GitHub webhook.",
      data: result,
    });
  } catch (error: any) {
    const code = error.message === "Repository already registered" ? 409 : 500;
    res.status(code).json({ success: false, message: error.message });
  }
};

export const getAllRepos = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const repos = await webhookService.getUserRepositories(req.user!._id.toString());
    res.status(200).json({ success: true, count: repos.length, data: repos });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export const updateRepo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const repo = await webhookService.updateRepository(
      req.params.id as string,
      req.user!._id.toString(),
      req.body
    );
    res.status(200).json({ success: true, message: "Repository updated", data: repo });
  } catch (error: any) {
    const code = error.message === "Repository not found" ? 404 : 500;
    res.status(code).json({ success: false, message: error.message });
  }
};

export const deleteRepo = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await webhookService.deleteRepository(req.params.id as string, req.user!._id.toString());
    res.status(200).json({ success: true, message: "Repository deleted" });
  } catch (error: any) {
    const code = error.message === "Repository not found" ? 404 : 500;
    res.status(code).json({ success: false, message: error.message });
  }
};
