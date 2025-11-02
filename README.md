# jh-mock-interview Cloudflare Worker

This project contains a Cloudflare Worker that simulates a mock interview session. It exposes a WebSocket endpoint for streaming deterministic transcription data along with interview prompts and scoring criteria, plus a lightweight web dashboard for visual verification.

## Features

- **Durable Object WebSocket hub** (`/ws`) that streams:
  - Interview question and scoring rubric on connect
  - Timed transcription chunks to emulate real-time speech-to-text
  - Completion notification and error propagation helpers
- **Interactive front-end** (`/`) that connects to the WebSocket, renders live transcript updates, and logs all payloads in the browser console.
- **OpenAPI documentation** available in both JSON (`/openapi.json`) and YAML (`/openapi.yaml`) formats for agent tooling integration.

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```
3. Visit [http://localhost:8787](http://localhost:8787) to open the dashboard and observe the streaming transcript.
4. For direct WebSocket testing, you can use `wscat` or similar tools:
   ```bash
   wscat -c ws://localhost:8787/ws
   ```

## Deployment

Deploy to Cloudflare Workers using Wrangler:

```bash
npm run deploy
```

Ensure that your account is authenticated with `wrangler login` prior to deployment.

## OpenAPI Examples

Retrieve the machine-readable specs:

```bash
curl http://localhost:8787/openapi.json
curl http://localhost:8787/openapi.yaml
```

These documents describe the WebSocket upgrade contract and available helper routes so that GPT-based agents can integrate quickly.
