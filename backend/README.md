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

## Production deployment

The backend can be deployed independently from the extension. Configure the service to use the `backend` directory as its working directory, install dependencies with `npm install`, build with `npm run build`, and start with `npm start` (or use the provider's separate build and start command settings). The server listens on the deployment-provided `PORT`, falling back to `3000` for local use, and binds to all network interfaces so a hosting platform can route requests to it.

Set `MONGODB_URI` in the deployment platform's environment-variable or secret settings to a MongoDB database the service can reach. Do not commit `.env` or paste a live connection string into source control. The checked-in `.env.example` contains placeholders only. Confirm deployment health at `/health`; it returns HTTP `200` with `"database": "connected"` only when the MongoDB connection is ready, otherwise HTTP `503`.

Configure the extension's `contextBridge.backendUrl` setting separately when targeting a deployed service. Its default remains `http://localhost:3000`; this milestone does not change it. Configure HTTPS and any network-access restrictions at the hosting platform or reverse proxy. This milestone prepares the service only and does not deploy it.

Transfer packages continue to expire after 30 minutes. MongoDB TTL deletion is asynchronous, and the API also checks expiration explicitly during retrieval.
