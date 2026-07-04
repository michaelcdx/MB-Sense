# MB Sense

## Docker setup

The app can run with Docker Compose as two services:

- `backend`: Node/Express API on port `8000`
- `frontend`: nginx-served React build on port `8080`, proxying `/api` and `/live` to the backend service

Create `backend/.env` from the example if it does not already exist:

```bash
cp backend/.env.example backend/.env
```

Set your Gemini key in `backend/.env`:

```env
GEMINI_API_KEY=your_gemini_api_key_here
APP_URL=http://localhost:8080
```

Build and start everything:

```bash
docker compose up --build
```

Open the app at:

```text
http://localhost:8080
```

The backend health check is available at:

```text
http://localhost:8000/api/health
```

Stop the containers:

```bash
docker compose down
```
