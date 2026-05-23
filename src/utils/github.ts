// ============================================================
// GitHub API Client
// ============================================================
// NEW CONCEPT: EXTERNAL API INTEGRATION
//
// In Projects 1-4, your API only talked to:
//   - AI providers (Gemini, Whisper)
//   - Your own database (MongoDB)
//
// Here, your API talks to GITHUB's API — a third-party service:
//   - Fetch PR diff → GET https://api.github.com/repos/:owner/:repo/pulls/:number
//   - Post comments → POST https://api.github.com/repos/:owner/:repo/issues/:number/comments
//
// This uses GitHub's REST API v3 with a Personal Access Token (PAT).
//
// WHY THIS MATTERS:
// In real production systems, your backend talks to dozens of
// external APIs — Stripe, SendGrid, Twilio, Slack, GitHub.
// This project teaches the pattern: authenticate, call, handle
// errors, and post results back.
// ============================================================

const GITHUB_API = "https://api.github.com";

/**
 * Make an authenticated request to GitHub API
 */
const githubFetch = async (path: string, options: RequestInit = {}) => {
  const url = `${GITHUB_API}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
      "User-Agent": "AI-Code-Review-Bot",
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`GitHub API error (${response.status}): ${error}`);
  }

  return response;
};

/**
 * Fetch the diff of a Pull Request
 * Returns the raw diff text (unified format)
 */
export const fetchPRDiff = async (
  repoFullName: string,
  pullNumber: number
): Promise<string> => {
  console.log(`[GitHub] Fetching diff for ${repoFullName}#${pullNumber}`);

  const response = await fetch(
    `${GITHUB_API}/repos/${repoFullName}/pulls/${pullNumber}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        // This special Accept header tells GitHub to return the raw diff
        Accept: "application/vnd.github.v3.diff",
        "User-Agent": "AI-Code-Review-Bot",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch PR diff: ${response.status}`);
  }

  const diff = await response.text();
  console.log(`[GitHub] Diff fetched: ${diff.length} chars`);
  return diff;
};

/**
 * Fetch the list of files changed in a PR
 */
export const fetchPRFiles = async (
  repoFullName: string,
  pullNumber: number
): Promise<{ filename: string; status: string; additions: number; deletions: number; patch?: string }[]> => {
  const response = await githubFetch(
    `/repos/${repoFullName}/pulls/${pullNumber}/files`
  );
  return response.json() as any;
};

/**
 * Post a comment on a Pull Request (summary comment)
 * Uses the Issues API because PR comments are technically issue comments
 */
export const postPRComment = async (
  repoFullName: string,
  pullNumber: number,
  body: string
): Promise<number> => {
  console.log(`[GitHub] Posting review comment on ${repoFullName}#${pullNumber}`);

  const response = await githubFetch(
    `/repos/${repoFullName}/issues/${pullNumber}/comments`,
    {
      method: "POST",
      body: JSON.stringify({ body }),
    }
  );

  const data = (await response.json()) as any;
  console.log(`[GitHub] Comment posted: ID ${data.id}`);
  return data.id;
};

/**
 * Post inline review comments on specific lines of code
 * Uses the Pull Request Review API for line-level comments
 */
export const postPRReview = async (
  repoFullName: string,
  pullNumber: number,
  commitSha: string,
  comments: { path: string; line: number; body: string }[],
  reviewBody: string
): Promise<void> => {
  console.log(`[GitHub] Posting inline review with ${comments.length} comments`);

  // Filter out comments with invalid line numbers
  const validComments = comments.filter((c) => c.line > 0);

  await githubFetch(
    `/repos/${repoFullName}/pulls/${pullNumber}/reviews`,
    {
      method: "POST",
      body: JSON.stringify({
        commit_id: commitSha,
        body: reviewBody,
        event: "COMMENT", // "COMMENT" | "APPROVE" | "REQUEST_CHANGES"
        comments: validComments.map((c) => ({
          path: c.path,
          line: c.line,
          body: c.body,
        })),
      }),
    }
  );

  console.log(`[GitHub] Inline review posted successfully`);
};
