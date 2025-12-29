# AI Chat Application

A simple chat application with an Express backend using Vercel AI SDK and a React frontend.

## Project Structure

```
vercel/
├── api-server/     # Express backend with AI SDK
└── frontend/       # React frontend with useChat hook
```

## Setup

### 1. API Server

```bash
cd api-server

# Install dependencies
pnpm install

# Copy .env.example to .env and add your OpenAI API key
cp .env.example .env
# Edit .env and add your OPENAI_API_KEY

# Start the server
pnpm dev
```

The API server will run on http://localhost:3001

### 2. Frontend

```bash
cd frontend

# Install dependencies
pnpm install

# Start the development server
pnpm dev
```

The frontend will run on http://localhost:3000

## API Endpoints

### `GET /health`
Health check endpoint.

### `POST /api/chat`
Chat endpoint that streams AI responses.

**Request body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Hello!"
    }
  ]
}
```

## Technologies

- **Backend**: Express, Vercel AI SDK, OpenAI
- **Frontend**: React, Vite, @ai-sdk/react
