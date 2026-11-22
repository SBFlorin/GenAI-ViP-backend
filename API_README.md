# PaVIAGen Server API

A comprehensive Node.js REST API with JWT authentication and AI chat functionality using OpenAI integration.

## Features

- **User Authentication**: Registration, login, JWT tokens, profile management
- **AI Chat**: Real-time conversations with OpenAI GPT models
- **Settings Management**: User preferences, health profiles, chat settings
- **Database**: SQLite with Sequelize ORM (ready for Azure Cosmos DB migration)
- **Security**: Bcrypt password hashing, JWT tokens, input validation
- **Error Handling**: Comprehensive error management and logging

## Quick Start

### 1. Environment Setup

```bash
# Copy environment template
cp .env.template .env

# Edit .env file with your configuration
# Especially add your OpenAI API key for chat functionality
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Start Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

### 4. Database

The SQLite database will be automatically created in the `storage/` directory when you first run the server.

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/v1/auth/register` | Register new user | No |
| POST | `/api/v1/auth/login` | User login | No |
| POST | `/api/v1/auth/refresh-token` | Refresh JWT token | No |
| GET | `/api/v1/auth/profile` | Get user profile | Yes |
| PUT | `/api/v1/auth/profile` | Update profile | Yes |

### Chat (AI Conversations)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/chat/conversations` | List user conversations | Yes |
| POST | `/api/v1/chat/conversations` | Create new conversation | Yes |
| GET | `/api/v1/chat/conversations/:id` | Get conversation with messages | Yes |
| PUT | `/api/v1/chat/conversations/:id` | Update conversation | Yes |
| DELETE | `/api/v1/chat/conversations/:id` | Delete conversation | Yes |
| POST | `/api/v1/chat/conversations/:id/messages` | Send message to AI | Yes |

### Settings

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/settings` | Get user settings | Yes |
| PUT | `/api/v1/settings` | Update settings | Yes |
| PATCH | `/api/v1/settings/health-profile` | Update health profile | Yes |
| PATCH | `/api/v1/settings/chat-preferences` | Update chat preferences | Yes |
| POST | `/api/v1/settings/reset` | Reset to defaults | Yes |

### Protected Routes (Examples)

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/v1/protected/` | Protected route example | Yes |
| GET | `/api/v1/protected/dashboard` | Dashboard data | Yes |

## Request/Response Examples

### User Registration

```bash
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "username": "johndoe",
  "password": "securepassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

Response:
```json
{
  "message": "User registered successfully.",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "johndoe",
    "firstName": "John",
    "lastName": "Doe",
    "role": "user",
    "isActive": true,
    "createdAt": "2025-11-10T..."
  },
  "token": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Send Chat Message

```bash
POST /api/v1/chat/conversations/1/messages
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
Content-Type: application/json

{
  "content": "Hello, I need help with quitting smoking."
}
```

Response:
```json
{
  "userMessage": {
    "id": 1,
    "role": "user",
    "content": "Hello, I need help with quitting smoking.",
    "createdAt": "2025-11-10T..."
  },
  "assistantMessage": {
    "id": 2,
    "role": "assistant",
    "content": "I'm here to help you on your journey to quit smoking! It's a wonderful decision for your health...",
    "tokens": 150,
    "createdAt": "2025-11-10T..."
  }
}
```

## Database Models

### User
- Authentication and profile information
- Relationships with Settings and Conversations

### Settings
- User preferences (theme, language, notifications)
- Health profile data
- Chat preferences

### Conversation
- AI chat sessions
- Associated with User and contains Messages

### Message
- Individual chat messages
- User or AI assistant messages
- Token usage tracking

## Environment Variables

| Variable | Description | Required | Default |
|----------|-------------|----------|---------|
| `PORT` | Server port | No | 3000 |
| `JWT_SECRET` | JWT signing secret | Yes | - |
| `JWT_EXPIRES_IN` | Token expiration | No | 7d |
| `OPENAI_API_KEY` | OpenAI API key | Yes* | - |
| `OPENAI_VOICE_MODE` | Voice transport (`realtime` or compatibility `live`) | No | realtime |
| `OPENAI_REALTIME_MODEL` | Realtime speech-to-speech model | No | gpt-realtime-2.1 |
| `OPENAI_REALTIME_VOICE` | Realtime fallback voice when persona sex is unknown | No | marin |
| `OPENAI_REALTIME_VOICE_FEMALE` | Realtime voice for female personas | No | marin |
| `OPENAI_REALTIME_VOICE_MALE` | Realtime voice for male personas | No | cedar |
| `OPENAI_REALTIME_MAX_OUTPUT_TOKENS` | Maximum output tokens per spoken response (clamped to 256–4096, or `inf`) | No | 1200 |
| `OPENAI_TRANSCRIPTION_MODEL` | Model used to persist Romanian voice transcripts | No | gpt-4o-mini-transcribe |
| `OPENAI_VAD_MODE` | Turn detection strategy (`semantic` or `server`) | No | semantic |
| `OPENAI_VAD_EAGERNESS` | Semantic VAD eagerness (`low`, `medium`, `high`, or `auto`) | No | medium |
| `OPENAI_VAD_SILENCE_MS` | Server VAD silence before the doctor’s turn ends (clamped to 200–1200 ms) | No | 450 |
| `OPENAI_VAD_THRESHOLD` | Voice activation threshold (clamped to 0.1–0.9) | No | 0.5 |
| `NODE_ENV` | Environment | No | development |

*Required for chat functionality

## Error Handling

The API returns consistent error responses:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE", // Optional
  "details": {} // Optional additional details
}
```

Common HTTP status codes:
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required/failed)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate data)
- `429` - Rate Limit Exceeded
- `500` - Internal Server Error

## Security Features

- **Password Hashing**: Bcrypt with 12 salt rounds
- **JWT Tokens**: Secure token-based authentication
- **Input Validation**: Request data validation
- **Rate Limiting**: API endpoint protection (planned)
- **CORS**: Cross-origin request control
- **SQL Injection Protection**: Sequelize ORM parameterized queries

## Development

### Project Structure

```
src/
├── controllers/     # Request handlers
├── middleware/      # Authentication, validation
├── models/         # Database models
├── routes/         # API routes
├── services/       # Business logic (OpenAI, etc.)
├── db.js          # Database connection
└── index.js       # Server entry point
```

### Adding New Features

1. Create model in `models/` if needed
2. Add controller in `controllers/`
3. Create routes in `routes/`
4. Update `index.js` to include new routes
5. Test endpoints

### Database Migrations

For schema changes, you may need to delete the existing database file:

```bash
rm storage/database.sqlite
# Restart server to recreate with new schema
```

## Production Deployment

1. Set `NODE_ENV=production`
2. Use strong `JWT_SECRET`
3. Configure proper CORS origins
4. Set up reverse proxy (nginx)
5. Use process manager (PM2)
6. Set up logging and monitoring

## Future Enhancements

- **Real-time Chat**: Socket.IO integration
- **Azure Cosmos DB**: Migration from SQLite
- **Rate Limiting**: Request throttling
- **File Upload**: Profile pictures, attachments
- **Email Verification**: Account verification
- **Password Reset**: Email-based reset
- **2FA**: Two-factor authentication
- **Admin Panel**: User management interface

## License

MIT License
