# Agent Overview

- **Name:** TranscriptRoom
- **Purpose:** Hosts a hibernating Durable Object that simulates an OpenAI-powered interviewer by streaming prompts, scoring criteria, and real-time transcription data over WebSocket.
- **Class:** `TranscriptRoom`
- **Bindings:** `TRANSCRIPT_ROOM` (Durable Object Namespace)
- **Dependencies:** [Hono](https://hono.dev) for routing. No additional storage services required.
- **Migration Tag:** `v1-transcript-room`
- **Usage Example:** Connect to `/ws` with a WebSocket client. Upon upgrade, the Durable Object sends interview metadata followed by timed transcript chunks and a completion message.

## Worker Surface Area

- `GET /` – Interactive HTML dashboard that visualises the transcription stream in real time.
- `GET /openapi.json` – OpenAPI 3.1 document describing all available endpoints in JSON format.
- `GET /openapi.yaml` – Same OpenAPI definition as YAML for tooling compatibility.
- `GET /ws` – Proxies the WebSocket upgrade to the `TranscriptRoom` Durable Object which emits the mock transcription feed.

## Development Notes

- Run `npm install` followed by `npm run dev` to test locally with Wrangler.
- The Durable Object uses WebSocket hibernation helpers (`this.ctx.acceptWebSocket`) and streams deterministic transcript chunks for verification.
- Any additional Workers features (KV, Queues, etc.) should be documented here alongside corresponding `wrangler.toml` updates.
