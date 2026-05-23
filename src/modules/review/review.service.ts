// ============================================================
// Review Service — AI-Powered Code Review Pipeline
// ============================================================
// NEW CONCEPT: EVENT-DRIVEN → AI → EXTERNAL API
//
// Previous projects: User calls YOUR API → AI processes → return response
// This project:      GitHub calls YOUR API → AI processes → call GITHUB's API
//
// The flow:
//   1. GitHub webhook triggers (someone opened a PR)
//   2. We fetch the PR diff FROM GitHub
//   3. We filter and clean the diff
//   4. We send the diff to Gemini for code review
//   5. We format Gemini's response as GitHub-compatible review
//   6. We post the review BACK to GitHub as PR comments
//
// Your API is a MIDDLEMAN:
//   GitHub → Your API → Gemini → Your API → GitHub
//
// This is the most production-like pattern of all 5 projects.
// ============================================================

import ai, { CHAT_MODEL } from "../../config/gemini";
import { fetchPRDiff, fetchPRFiles, postPRComment, postPRReview } from "../../utils/github";
import Review from "./review.model";
import Repository from "../webhook/repository.model";
import { IReviewComment, GitHubPRWebhook } from "../../types";

/**
 * Filter diff to remove files that match ignore patterns
 */
const shouldIgnoreFile = (filename: string, ignorePatterns: string[]): boolean => {
  return ignorePatterns.some((pattern) => {
    // Convert glob patterns to simple matching
    if (pattern.startsWith("*.")) {
      return filename.endsWith(pattern.slice(1));
    }
    if (pattern.endsWith("/*")) {
      return filename.startsWith(pattern.slice(0, -2));
    }
    return filename === pattern;
  });
};

/**
 * Parse a unified diff into per-file sections
 */
const parseDiffToFiles = (diff: string): { filename: string; patch: string }[] => {
  const files: { filename: string; patch: string }[] = [];
  const fileSections = diff.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const filenameMatch = section.match(/b\/(.+?)[\s\n]/);
    if (!filenameMatch) continue;
    files.push({ filename: filenameMatch[1], patch: section });
  }

  return files;
};

/**
 * Run the full AI code review pipeline on a PR
 */
export const reviewPR = async (
  webhookPayload: GitHubPRWebhook,
  repositoryId: string,
  userId: string
): Promise<any> => {
  const pr = webhookPayload.pull_request;
  const repoFullName = webhookPayload.repository.full_name;

  // Create review record
  const review = await Review.create({
    user: userId,
    repository: repositoryId,
    pullNumber: pr.number,
    prTitle: pr.title,
    prAuthor: pr.user.login,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    filesChanged: pr.changed_files,
    additions: pr.additions,
    deletions: pr.deletions,
    status: "reviewing",
  });

  try {
    // Get repository review rules
    const repo = await Repository.findById(repositoryId);
    const rules = repo?.reviewRules || {
      focusAreas: ["security", "performance", "style", "bugs", "best_practices"],
      language: "auto",
      strictness: "standard",
      maxFileSize: 500,
      ignorePatterns: ["package-lock.json", "*.min.js", "*.min.css", "dist/*"],
    };

    // ── STEP 1: Fetch PR diff from GitHub ──
    console.log(`[Review] Fetching diff for ${repoFullName}#${pr.number}`);
    const rawDiff = await fetchPRDiff(repoFullName, pr.number);

    // ── STEP 2: Filter and clean the diff ──
    const diffFiles = parseDiffToFiles(rawDiff);
    const filteredFiles = diffFiles.filter(
      (f) => !shouldIgnoreFile(f.filename, rules.ignorePatterns as string[])
    );

    if (filteredFiles.length === 0) {
      review.summary = "No reviewable files in this PR (all matched ignore patterns).";
      review.status = "completed";
      review.overallScore = 100;
      await review.save();
      return review;
    }

    // Truncate very large diffs to stay within Gemini's context window
    const diffText = filteredFiles
      .map((f) => `--- File: ${f.filename} ---\n${f.patch}`)
      .join("\n\n")
      .slice(0, 60000); // ~60K chars max

    console.log(`[Review] Reviewing ${filteredFiles.length} files (${diffText.length} chars)`);

    // ── STEP 3: AI Code Review via Gemini ──
    const strictnessGuide: Record<string, string> = {
      relaxed: "Only flag critical issues and security vulnerabilities. Be lenient on style.",
      standard: "Flag bugs, security issues, performance problems, and notable style issues.",
      strict: "Flag everything including minor style issues, naming conventions, and missing documentation.",
    };

    const response = await ai.models.generateContent({
      model: CHAT_MODEL,
      contents: `You are a senior code reviewer at a top tech company. Review this Pull Request diff thoroughly.

## PR DETAILS:
- Title: ${pr.title}
- Author: ${pr.user.login}
- Branch: ${pr.head.ref} → ${pr.base.ref}
- Files Changed: ${filteredFiles.length}

## REVIEW RULES:
- Focus Areas: ${(rules.focusAreas as string[]).join(", ")}
- Language Context: ${rules.language}
- Strictness: ${rules.strictness} — ${strictnessGuide[rules.strictness as string] || strictnessGuide.standard}

## CODE DIFF:
${diffText}

## INSTRUCTIONS:
Review the code and produce:

1. **Comments**: For each issue found, provide:
   - file: The exact filename (e.g., "src/utils/auth.ts")
   - line: The approximate line number in the diff where the issue exists
   - severity: "critical" (must fix), "warning" (should fix), "suggestion" (nice to have), or "praise" (good practice)
   - category: "security", "performance", "style", "bug", or "best_practice"
   - message: Clear explanation of the issue
   - suggestion: How to fix it (code example if applicable)

2. **Summary**: A brief overall assessment (2-3 sentences)

3. **Overall Score**: 0-100 (100 = perfect code)

Respond ONLY in valid JSON:
{
  "comments": [
    {
      "file": "src/utils/auth.ts",
      "line": 15,
      "severity": "critical",
      "category": "security",
      "message": "Password is logged in plaintext. This exposes sensitive data in log files.",
      "suggestion": "Remove the console.log statement or mask the password: console.log('Auth attempt for:', email)"
    }
  ],
  "summary": "The PR introduces a solid authentication flow but has a critical security issue with plaintext password logging.",
  "overallScore": 65
}

Be thorough but fair. Include praise for good patterns too.`,
      config: { temperature: 0.2 },
    });

    const rawResponse = (response.text || "{}").replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const reviewData = JSON.parse(rawResponse);

    // ── STEP 4: Save review ──
    const comments: IReviewComment[] = (reviewData.comments || []).map((c: any) => ({
      file: c.file || "unknown",
      line: c.line || 0,
      severity: ["critical", "warning", "suggestion", "praise"].includes(c.severity) ? c.severity : "suggestion",
      category: c.category || "general",
      message: c.message || "",
      suggestion: c.suggestion || "",
    }));

    review.comments = comments as any;
    review.summary = reviewData.summary || "Review completed.";
    review.overallScore = reviewData.overallScore || 0;
    review.status = "completed";

    // ── STEP 5: Post review back to GitHub ──
    const severityEmoji: Record<string, string> = {
      critical: "🔴",
      warning: "🟡",
      suggestion: "🔵",
      praise: "🟢",
    };

    // Format the summary comment
    const summaryMarkdown = [
      `## 🤖 AI Code Review — ${review.overallScore}/100`,
      "",
      `> ${review.summary}`,
      "",
      `**Files reviewed:** ${filteredFiles.length} | **Issues found:** ${comments.filter((c) => c.severity !== "praise").length} | **Praises:** ${comments.filter((c) => c.severity === "praise").length}`,
      "",
      "### Findings",
      "",
      ...comments.map(
        (c) =>
          `${severityEmoji[c.severity]} **[${c.severity.toUpperCase()}]** \`${c.file}:${c.line}\` — ${c.message}${c.suggestion ? `\n  > 💡 *${c.suggestion}*` : ""}`
      ),
      "",
      "---",
      "*Reviewed by AI Code Review Bot — powered by Gemini*",
    ].join("\n");

    // Post summary comment on the PR
    const commentId = await postPRComment(repoFullName, pr.number, summaryMarkdown);
    review.githubCommentId = commentId;

    // Also post inline comments on specific lines
    const inlineComments = comments
      .filter((c) => c.line > 0 && c.severity !== "praise")
      .map((c) => ({
        path: c.file,
        line: c.line,
        body: `${severityEmoji[c.severity]} **${c.severity.toUpperCase()}** (${c.category})\n\n${c.message}${c.suggestion ? `\n\n💡 **Suggestion:** ${c.suggestion}` : ""}`,
      }));

    if (inlineComments.length > 0) {
      try {
        await postPRReview(
          repoFullName,
          pr.number,
          pr.head.sha,
          inlineComments,
          `AI Review: ${review.overallScore}/100 — ${comments.length} comments`
        );
      } catch (inlineError: any) {
        // Inline comments can fail if line numbers don't match the diff
        // The summary comment is already posted, so this is non-critical
        console.warn(`[Review] Inline comments failed (non-critical): ${inlineError.message}`);
      }
    }

    await review.save();

    console.log(
      `[Review] Complete: ${review.overallScore}/100, ${comments.length} comments, posted to GitHub`
    );

    return review;
  } catch (error: any) {
    review.status = "failed";
    review.summary = `Review failed: ${error.message}`;
    await review.save();
    throw new Error(`Review pipeline failed: ${error.message}`);
  }
};

/**
 * Get all reviews for a user
 */
export const getUserReviews = async (userId: string) => {
  return Review.find({ user: userId })
    .populate("repository", "githubRepoFullName")
    .select("pullNumber prTitle prAuthor overallScore status createdAt summary")
    .sort({ createdAt: -1 });
};

/**
 * Get full review details
 */
export const getReviewById = async (reviewId: string, userId: string) => {
  const review = await Review.findOne({ _id: reviewId, user: userId })
    .populate("repository", "githubRepoFullName reviewRules");
  if (!review) throw new Error("Review not found");
  return review;
};
