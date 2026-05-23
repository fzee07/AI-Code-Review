import { Document } from "mongoose";
import { Request } from "express";

// ── User Types ──────────────────────────────────────────────

export interface IUser extends Document {
  name: string;
  email: string;
  password: string;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

export interface AuthRequest extends Request {
  user?: IUser;
}

// ── Repository Types ────────────────────────────────────────

export interface IRepository extends Document {
  user: string;
  githubRepoFullName: string; // "owner/repo-name"
  webhookActive: boolean;
  reviewRules: IReviewRules;
}

export interface IReviewRules {
  focusAreas: string[]; // ["security", "performance", "style", "bugs", "best_practices"]
  language: string; // "auto" | "javascript" | "typescript" | "python" etc.
  strictness: "relaxed" | "standard" | "strict";
  maxFileSize: number; // Skip files larger than this (in lines)
  ignorePatterns: string[]; // ["*.test.ts", "package-lock.json", "*.min.js"]
}

// ── Review Types ────────────────────────────────────────────

export type ReviewStatus = "pending" | "reviewing" | "completed" | "failed";
export type IssueSeverity = "critical" | "warning" | "suggestion" | "praise";

export interface IReviewComment {
  file: string; // "src/utils/auth.ts"
  line: number; // Line number in the diff
  severity: IssueSeverity;
  category: string; // "security" | "performance" | "style" | "bug" | "best_practice"
  message: string; // The review comment
  suggestion?: string; // Suggested fix (optional)
}

export interface IReview extends Document {
  user: string;
  repository: string;
  pullNumber: number;
  prTitle: string;
  prAuthor: string;
  baseBranch: string; // "main"
  headBranch: string; // "feature/new-login"
  filesChanged: number;
  additions: number;
  deletions: number;
  comments: IReviewComment[];
  summary: string; // Overall review summary
  overallScore: number; // 0-100
  status: ReviewStatus;
  githubCommentId?: number; // ID of the summary comment posted on GitHub
}

// ── Webhook Types ───────────────────────────────────────────

export interface GitHubPRWebhook {
  action: string; // "opened" | "synchronize" | "reopened"
  number: number;
  pull_request: {
    title: string;
    number: number;
    html_url: string;
    diff_url: string;
    user: { login: string };
    base: { ref: string; repo: { full_name: string } };
    head: { ref: string; sha: string };
    changed_files: number;
    additions: number;
    deletions: number;
  };
  repository: {
    full_name: string;
  };
}
