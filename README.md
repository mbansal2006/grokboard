# GrokBoard

An interactive course builder that takes markdown files as input and creates comprehensive courses with multiple choice questions and coding exercises using Grok AI.

## Quick Start

### Option 1: Docker (Recommended - Runs Both Frontend & Backend)

1. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and Supabase credentials
   ```

2. **Build and run with Docker Compose:**
   ```bash
   docker-compose up --build
   ```

3. **Access the application:**
   - Frontend: http://localhost:80 (or http://localhost)
   - Backend API: http://localhost:3001

The Docker setup runs both the frontend (served by nginx) and backend (Node.js) in a single container. The frontend automatically proxies `/api` requests to the backend.

### Option 2: Local Development (Separate Frontend & Backend)

1. **Install dependencies:**
   ```bash
   npm run install-all
   ```

2. **Set up environment variables:**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and Supabase credentials
   ```

3. **Run both frontend and backend:**
   ```bash
   npm run dev
   ```

   This will start:
   - Frontend dev server: http://localhost:5173 (Vite default)
   - Backend server: http://localhost:3001

4. **Or run separately:**
   ```bash
   # Terminal 1 - Backend
   npm run server

   # Terminal 2 - Frontend
   npm run client
   ```

## Environment Variables

Create a `.env` file in the root directory with:

```env
ANTHROPIC_API_KEY=your_anthropic_api_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Project Structure

- `client/` - React frontend application (Vite + React)
- `server/` - Express backend API
- `docker-compose.yml` - Docker configuration for running both services
- `Dockerfile` - Multi-stage build for production deployment

## Development

- Frontend uses Vite for fast development
- Backend uses Express with Node.js watch mode
- Both services run concurrently with `npm run dev`