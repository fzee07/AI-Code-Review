# Auto AI Code Review API — Event-Driven Code Intelligence

An enterprise-grade automated code review system that listens for GitHub Pull Request events via webhooks, fetches code diffs, sends them to Gemini for AI-powered review, and posts structured review comments directly on the PR — built with TypeScript, Google Gemini, GitHub API, and MongoDB.

## Key Features

- **Webhook-Driven**: Automatically triggers when PRs are opened/updated on GitHub
- **HMAC Signature Verification**: Cryptographic verification that requests are from GitHub
- **AI Code Review**: Gemini analyzes diffs for bugs, security issues, performance, and style
- **GitHub Integration**: Posts summary and inline comments directly on PRs
- **Configurable Rules**: Per-repo review strictness, focus areas, and ignore patterns
- **Background Processing**: Responds to GitHub instantly, reviews asynchronously
- **TypeScript**: Full type safety across all modules

## Tech Stack

| Technology | Purpose |
|---|---|
| TypeScript | Type-safe development |
| Express.js | HTTP server + webhook endpoint |
| MongoDB | Repositories, reviews, comments |
| Google Gemini 2.5 Flash | Code analysis and review |
| GitHub REST API v3 | Fetch diffs, post review comments |
| HMAC-SHA256 | Webhook signature verification |
| JWT | User authentication |
| Docker | Containerized deployment |

## Event-Driven Flow

```
Developer opens PR on GitHub
      ↓
GitHub POSTs webhook → /api/webhooks/github
      ↓
Server verifies HMAC signature
      ↓
Server responds 200 immediately (< 10 seconds)
      ↓  (background)
Fetch PR diff via GitHub API
      ↓
Send diff to Gemini for review
      ↓
Post review comments back to GitHub PR
```

## API Endpoints

### Auth
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register |
| POST | `/api/auth/login` | Login → JWT |

### Webhooks
| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/api/webhooks/github` | HMAC | GitHub webhook endpoint |
| POST | `/api/webhooks/repos` | JWT | Register a repo |
| GET | `/api/webhooks/repos` | JWT | List registered repos |
| PATCH | `/api/webhooks/repos/:id` | JWT | Update repo rules |
| DELETE | `/api/webhooks/repos/:id` | JWT | Delete repo |

### Reviews
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reviews` | List all reviews |
| GET | `/api/reviews/:id` | Full review details |

## GitHub Webhook Setup

1. Register a repo: `POST /api/webhooks/repos` with `{"githubRepoFullName": "owner/repo"}`
2. Go to `https://github.com/owner/repo/settings/hooks`
3. Add webhook:
   - Payload URL: `https://YOUR_DOMAIN/api/webhooks/github`
   - Content type: `application/json`
   - Secret: Same as your `GITHUB_WEBHOOK_SECRET` env var
   - Events: Select "Pull requests"
4. Open a PR — the bot will review automatically

## Review Rules Configuration

```json
{
  "focusAreas": ["security", "performance", "style", "bugs", "best_practices"],
  "language": "auto",
  "strictness": "standard",
  "maxFileSize": 500,
  "ignorePatterns": ["package-lock.json", "*.min.js", "dist/*"]
}
```

## Setup

```bash
npm install
# Fill .env with GEMINI_API_KEY, GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET, MONGODB_URI
npm run dev
```

Or with Docker:
```bash
docker-compose up
```

## Environment Variables

| Variable | Description |
|---|---|
| `GEMINI_API_KEY` | Google Gemini API key |
| `GITHUB_TOKEN` | GitHub Personal Access Token (needs `repo` scope) |
| `GITHUB_WEBHOOK_SECRET` | Secret used when configuring GitHub webhook |
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | JWT signing secret |

## Project Structure

```
src/
├── config/             # DB, Gemini connections
├── middlewares/
│   ├── auth.ts         # JWT verification
│   └── webhookVerify.ts # HMAC signature verification
├── modules/
│   ├── auth/           # User registration & login
│   ├── webhook/        # GitHub webhook handler, repo management
│   └── review/         # AI review engine, review history
├── utils/
│   └── github.ts       # GitHub API client (fetch diff, post comments)
├── types/              # TypeScript interfaces
└── app.ts              # Express server entry point
```
