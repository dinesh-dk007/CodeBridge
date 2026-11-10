# ContextBridge Backend

The backend stores sanitized ContextBridge portable memory packages in MongoDB and serves short-lived transfer codes. It is intended for local development; it does not provide authentication, encryption, or cloud deployment.

## Requirements and setup

- Node.js and npm
- A reachable MongoDB instance

From the `backend` directory:

```powershell
npm install
Copy-Item .env.example .env
```

Set `MONGODB_URI` in `.env` to the connection URI for your MongoDB instance. Do not commit `.env`; it is ignored by Git. `PORT` is optional and defaults to `3000`.

Compile and start:

```powershell
npm run compile
npm start
```

The backend connects to MongoDB before listening. It exits with a safe startup error when `MONGODB_URI` is missing or the database cannot be reached. The configured database URI is never printed.

## Health check

With the backend running, use:

```powershell
Invoke-RestMethod http://localhost:3000/health
```

When storage is available, the response includes `"status": "ok"` and `"database": "connected"`. If the connection is unavailable after startup, the endpoint responds with HTTP `503` and `"database": "disconnected"`.

## API

- `GET /health` — reports service and MongoDB readiness.
- `POST /api/transfers` — validates a sanitized portable package, stores it, and returns a generated code and expiry timestamp.
- `GET /api/transfers/:code` — retrieves the package for a valid code; expired codes return HTTP `410`, unknown codes return HTTP `404`.
- `DELETE /api/transfers/:code` — consumes a transfer after the extension completes a successful import; unknown codes return HTTP `404`.

Transfer codes expire after 30 minutes. MongoDB has a TTL index on `expiresAt`; its cleanup runs asynchronously and is not guaranteed at the exact expiration second. The API also checks the timestamp on retrieval and rejects and removes expired records itself.

## Storage and safety

Only the existing sanitized ContextBridge portable package is stored. The backend validates package shape and rejects obvious machine-specific paths. Transfer records use an indexed unique code and do not expose MongoDB `_id` or `__v` fields through the API.

This backend requires MongoDB to be running and is not a cloud deployment. Do not put credentials in the package or commit database connection strings.
