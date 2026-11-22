# GenAI-ViP / PaVIAGen — backend

Node.js/Express API with Socket.IO real-time messaging, JWT authentication, SQLite persistence via Sequelize, and OpenAI integration. This repository is an October 2026 pre-Study-5 source snapshot with 10 evaluator scenarios and the voice module. It excludes the later Study 5 implementation.

## Local installation: text-based GenAI-ViP

**Requirements:** Node.js 22.x, npm, an OpenAI API key for live responses, and a local terminal.

```bash
npm ci
```

Create the directory `storage/` in the repository root. Copy `.env.template` to `.env` and edit the following values. Generate a private JWT secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`:

```ini
PORT=3000
NODE_ENV=development
JWT_SECRET=replace_with_a_long_random_secret
JWT_EXPIRES_IN=7d
OPENAI_API_KEY=replace_with_your_own_api_key
```

The Study 5 module is **not included** in this archived source snapshot. Voice functions require additional media-specific settings and a compatible OpenAI account.

Start the server:

```bash
npm run dev
# alternatively: npm start
```

The default API base is `http://localhost:3000/api/v1`; Socket.IO shares port 3000. The default SQLite file is `storage/database.sqlite`. Do not copy historical/private SQLite databases into the public build.

## Create local accounts

General self-registration (API `/api/v1/auth/register`) creates only a `user` role. Privileged evaluator and administrator accounts must be created through an authorized admin flow or the supplied local script:

```bash
node src/scripts/createUser.js --email student@example.test --username student_demo --role user
node src/scripts/createUser.js --email evaluator@example.test --username evaluator_demo --role evaluator
node src/scripts/createUser.js --email admin@example.test --username admin_demo --role admin
```

The script prompts for a password when `PAVIAGEN_NEW_USER_PASSWORD` is not set. Run these commands using demonstration accounts only. Never commit passwords or `.env` files.

## Main endpoints

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/v1/auth/register` | Create ordinary user account |
| `POST` | `/api/v1/auth/login` | Authenticate and obtain JWT |
| `GET` | `/api/v1/auth/profile` | Authenticated profile |
| `GET`, `POST` | `/api/v1/chat/conversations` | List/create text conversations |
| `GET` | `/api/v1/chat/conversations/:conversationId` | Read conversation |
| `POST` | `/api/v1/chat/conversations/:conversationId/messages` | Send a new message |
| `GET` | `/api/v1/evaluator/consent` | Read evaluator consent |
| `POST` | `/api/v1/evaluator/attempts` | Start evaluation attempt |

Most application APIs require `Authorization: Bearer <JWT>`. For additional routes see `API_README.md` and `src/routes/`.

## Evaluator workflow and tests

The expert-evaluator interface supports 10 synthetic smoking-cessation personas, consent/profile forms, individual dialogue sessions, session questionnaires, and an overall evaluation.

```bash
node test_evaluator_study.js
```

The developer reported 118/118 evaluator checks passed in a separate study verification. This clean release has not been validated against a live API in this environment. The separate `test_chatbot_prompts.js` was designed for an earlier 15-scenario set and is **not** a passing regression suite for the current 10 personas. Neither script constitutes a live OpenAI end-to-end validation.

## Important release cautions

- **Do not push the supplied `.git` history:** historical SQLite objects include account and conversation data. Use a new sanitized repository history.
- No genuine `.env`, personal data, participant transcripts, audio or exports in the release.
- This public-source preparation removes the JWT fallback and implements conversation-ownership checks for Socket.IO auxiliary rooms. Independent penetration testing and live end-to-end validation are not claimed.
- Verify the behavior and retention of SQLite soft-deletion and external AI processing before collecting research data.

A clean install and a live API smoke test were not performed while preparing this documentation.

## Source provenance

