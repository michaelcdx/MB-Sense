# MB Sense

MB Sense is a mobile-first smart mobility web app for the Mercedes-Benz Tech Malaysia Vibathon 2026 AI Defined Vehicle challenge.

The app combines a React/Vite frontend with a Node/Express backend for AI-assisted mobility features such as schedule analysis, route advice, vehicle status mockups, voice assistant support, and Gemini-powered chat.

## Project Structure

```txt
MBSense/
├── frontend/   # React + Vite + TypeScript mobile web app
├── backend/    # Express API server + Gemini integrations
└── MASTER_PROMPT.md
```

## Requirements

- Node.js 22+
- npm
- Gemini API key for AI features

## Environment

Create `backend/.env` from `backend/.env.example`:

```env
GEMINI_API_KEY="your_api_key"
APP_URL="http://localhost:5173"
```

Optional frontend map key:

```env
VITE_GOOGLE_MAPS_PLATFORM_KEY="your_google_maps_key"
```

Do not commit real `.env` files.

## Install

```powershell
cd backend
npm install

cd ..\frontend
npm install
```

## Run Locally

Start the backend:

```powershell
cd backend
npm run build
npm start
```

Start the frontend in a second terminal:

```powershell
cd frontend
npm run dev
```

Open the Vite URL shown in the terminal, usually:

```txt
http://localhost:5173
```

The frontend proxies `/api` and `/live` to `http://localhost:8000`.

## Build

```powershell
cd backend
npm run build

cd ..\frontend
npm run build
```

## Notes

- `AGENT_MEMORY.md` is local-only and ignored by git.
- `Vibathon26AIDVStudentGuide.pdf` is local-only and ignored by git.
- Backend build output is generated in `backend/dist/` and ignored by git.
- Frontend build output is generated in `frontend/dist/` and ignored by git.
