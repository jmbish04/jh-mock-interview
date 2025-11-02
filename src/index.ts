import { Hono } from 'hono';

type TranscriptMessage =
  | {
      type: 'meta';
      question: string;
      scoringCriteria: string[];
    }
  | {
      type: 'transcript';
      chunk: string;
      timestamp: string;
    }
  | {
      type: 'complete';
    }
  | {
      type: 'error';
      message: string;
    };

export interface Env {
  TRANSCRIPT_ROOM: DurableObjectNamespace;
}

const FRONTEND_HTML = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Mock Interview Transcription Stream</title>
    <style>
      :root {
        color-scheme: light dark;
        font-family: "Inter", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0b1220;
        color: #f1f5f9;
      }

      body {
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        min-height: 100vh;
      }

      header {
        padding: 1.5rem 2rem;
        background: linear-gradient(135deg, #1e293b, #334155);
        box-shadow: 0 2px 16px rgba(15, 23, 42, 0.4);
      }

      h1 {
        margin: 0;
        font-size: 1.75rem;
      }

      main {
        flex: 1;
        padding: 2rem;
        display: grid;
        gap: 1.5rem;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }

      section {
        background: rgba(15, 23, 42, 0.75);
        border-radius: 1rem;
        padding: 1.5rem;
        border: 1px solid rgba(148, 163, 184, 0.15);
        box-shadow: inset 0 1px 0 rgba(148, 163, 184, 0.05);
      }

      .meta-list {
        list-style: none;
        padding: 0;
        margin: 0;
      }

      .meta-list li {
        margin-bottom: 0.75rem;
        padding: 0.75rem;
        border-radius: 0.75rem;
        background: rgba(94, 234, 212, 0.08);
        border: 1px solid rgba(45, 212, 191, 0.2);
      }

      .transcription {
        font-family: "JetBrains Mono", "Fira Code", Menlo, monospace;
        font-size: 0.95rem;
        white-space: pre-wrap;
        background: rgba(30, 41, 59, 0.85);
        padding: 1rem;
        border-radius: 0.75rem;
        border: 1px solid rgba(100, 116, 139, 0.3);
        max-height: 60vh;
        overflow-y: auto;
      }

      .status {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
        padding: 0.4rem 0.75rem;
        border-radius: 999px;
        background: rgba(37, 99, 235, 0.15);
        border: 1px solid rgba(37, 99, 235, 0.3);
        font-size: 0.85rem;
      }

      footer {
        padding: 1rem 2rem;
        text-align: center;
        font-size: 0.85rem;
        color: rgba(148, 163, 184, 0.8);
      }
    </style>
  </head>
  <body>
    <header>
      <h1>Mock Interview: Real-time Transcription Stream</h1>
      <p class="status" id="status">Connecting to transcription service…</p>
    </header>
    <main>
      <section>
        <h2>Interview Prompt</h2>
        <p id="question">Waiting for question…</p>
        <h3>Scoring Criteria</h3>
        <ul id="criteria" class="meta-list"></ul>
      </section>
      <section>
        <h2>Live Transcript</h2>
        <div id="transcription" class="transcription">No transcription received yet.</div>
      </section>
    </main>
    <footer>
      <small>Cloudflare Worker WebSocket demo for the jh-mock-interview project.</small>
    </footer>
    <script type="module">
      const statusEl = document.getElementById('status');
      const questionEl = document.getElementById('question');
      const criteriaEl = document.getElementById('criteria');
      const transcriptionEl = document.getElementById('transcription');
      const log = [];

      const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = protocol + '//' + location.host + '/ws';
      const socket = new WebSocket(wsUrl);

      function appendTranscript(text) {
        if (transcriptionEl.textContent === 'No transcription received yet.') {
          transcriptionEl.textContent = '';
        }
        transcriptionEl.textContent += text + '\n';
        transcriptionEl.scrollTop = transcriptionEl.scrollHeight;
      }

      socket.addEventListener('open', () => {
        statusEl.textContent = 'Connected – streaming transcription';
        console.info('[worker] websocket open');
      });

      socket.addEventListener('message', (event) => {
        try {
          const payload = JSON.parse(event.data);
          log.push(payload);
          console.log('[worker] message', payload);

          switch (payload.type) {
            case 'meta': {
              questionEl.textContent = payload.question;
              criteriaEl.innerHTML = '';
              payload.scoringCriteria.forEach((criterion) => {
                const li = document.createElement('li');
                li.textContent = criterion;
                criteriaEl.appendChild(li);
              });
              break;
            }
            case 'transcript': {
              appendTranscript(payload.timestamp + ' — ' + payload.chunk);
              break;
            }
            case 'complete': {
              statusEl.textContent = 'Transcription complete';
              break;
            }
            case 'error': {
              statusEl.textContent = 'Error: ' + payload.message;
              appendTranscript('[error] ' + payload.message);
              break;
            }
            default: {
              console.warn('Unknown message type', payload);
            }
          }
        } catch (error) {
          console.error('Failed to parse message', error);
        }
      });

      socket.addEventListener('close', (event) => {
        statusEl.textContent = 'Connection closed (' + event.code + ')';
        console.info('[worker] websocket close', event.code, event.reason);
      });

      socket.addEventListener('error', (error) => {
        statusEl.textContent = 'Connection error';
        console.error('[worker] websocket error', error);
      });

      // Expose the message log for quick inspection in the browser console
      window.transcriptionLog = log;
    </script>
  </body>
</html>`;

const OPEN_API_JSON = {
  openapi: '3.1.0',
  info: {
    title: 'Mock Interview Transcription Service',
    description:
      'WebSocket endpoint that streams mock interview prompts and transcription data for testing AI agent integrations.',
    version: '1.0.0',
  },
  servers: [
    {
      url: 'https://{subdomain}.workers.dev',
      description: 'Default Cloudflare Workers deployment domain',
      variables: {
        subdomain: {
          default: 'your-account',
          description: 'Replace with your Workers.dev subdomain',
        },
      },
    },
  ],
  paths: {
    '/ws': {
      get: {
        summary: 'Upgrade to a WebSocket stream with interview prompts and transcription data',
        description:
          'Initiate a WebSocket connection that streams a mock interview prompt, scoring criteria, and simulated real-time transcription chunks.',
        operationId: 'connectTranscriptionStream',
        responses: {
          '101': {
            description: 'Switching protocols – WebSocket upgrade accepted',
          },
          '426': {
            description: 'Upgrade Required – request did not include an Upgrade: websocket header',
          },
        },
      },
    },
    '/openapi.json': {
      get: {
        summary: 'Retrieve OpenAPI definition (JSON)',
        operationId: 'getOpenApiJson',
        responses: {
          '200': {
            description: 'The OpenAPI document describing this service',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                },
              },
            },
          },
        },
      },
    },
    '/openapi.yaml': {
      get: {
        summary: 'Retrieve OpenAPI definition (YAML)',
        operationId: 'getOpenApiYaml',
        responses: {
          '200': {
            description: 'The OpenAPI document describing this service in YAML format',
            content: {
              'application/yaml': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
    '/': {
      get: {
        summary: 'Interactive transcription viewer',
        operationId: 'getFrontend',
        responses: {
          '200': {
            description: 'HTML dashboard for testing the transcription WebSocket stream',
            content: {
              'text/html': {
                schema: {
                  type: 'string',
                },
              },
            },
          },
        },
      },
    },
  },
  components: {
    schemas: {
      TranscriptMessage: {
        oneOf: [
          {
            type: 'object',
            properties: {
              type: { const: 'meta' },
              question: { type: 'string' },
              scoringCriteria: {
                type: 'array',
                items: { type: 'string' },
              },
            },
            required: ['type', 'question', 'scoringCriteria'],
          },
          {
            type: 'object',
            properties: {
              type: { const: 'transcript' },
              chunk: { type: 'string' },
              timestamp: { type: 'string', format: 'time' },
            },
            required: ['type', 'chunk', 'timestamp'],
          },
          {
            type: 'object',
            properties: {
              type: { const: 'complete' },
            },
            required: ['type'],
          },
          {
            type: 'object',
            properties: {
              type: { const: 'error' },
              message: { type: 'string' },
            },
            required: ['type', 'message'],
          },
        ],
      },
    },
  },
};

const OPEN_API_YAML = `openapi: 3.1.0
info:
  title: Mock Interview Transcription Service
  description: WebSocket endpoint that streams mock interview prompts and transcription data for testing AI agent integrations.
  version: 1.0.0
servers:
  - url: https://{subdomain}.workers.dev
    description: Default Cloudflare Workers deployment domain
    variables:
      subdomain:
        default: your-account
        description: Replace with your Workers.dev subdomain
paths:
  /ws:
    get:
      summary: Upgrade to a WebSocket stream with interview prompts and transcription data
      description: Initiate a WebSocket connection that streams a mock interview prompt, scoring criteria, and simulated real-time transcription chunks.
      operationId: connectTranscriptionStream
      responses:
        '101':
          description: Switching protocols – WebSocket upgrade accepted
        '426':
          description: Upgrade Required – request did not include an Upgrade: websocket header
  /openapi.json:
    get:
      summary: Retrieve OpenAPI definition (JSON)
      operationId: getOpenApiJson
      responses:
        '200':
          description: The OpenAPI document describing this service
          content:
            application/json:
              schema:
                type: object
  /openapi.yaml:
    get:
      summary: Retrieve OpenAPI definition (YAML)
      operationId: getOpenApiYaml
      responses:
        '200':
          description: The OpenAPI document describing this service in YAML format
          content:
            application/yaml:
              schema:
                type: string
  /:
    get:
      summary: Interactive transcription viewer
      operationId: getFrontend
      responses:
        '200':
          description: HTML dashboard for testing the transcription WebSocket stream
          content:
            text/html:
              schema:
                type: string
components:
  schemas:
    TranscriptMessage:
      oneOf:
        - type: object
          properties:
            type:
              const: meta
            question:
              type: string
            scoringCriteria:
              type: array
              items:
                type: string
          required:
            - type
            - question
            - scoringCriteria
        - type: object
          properties:
            type:
              const: transcript
            chunk:
              type: string
            timestamp:
              type: string
              format: time
          required:
            - type
            - chunk
            - timestamp
        - type: object
          properties:
            type:
              const: complete
          required:
            - type
        - type: object
          properties:
            type:
              const: error
            message:
              type: string
          required:
            - type
            - message
`;

export class TranscriptRoom {
  private closed = false;

  constructor(
    private readonly ctx: DurableObjectState,
    private readonly env: Env,
  ) {}

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('Upgrade') === 'websocket') {
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      this.ctx.acceptWebSocket(server);
      return new Response(null, { status: 101, webSocket: client });
    }

    return new Response(
      JSON.stringify({ error: 'Expected WebSocket upgrade request.' }),
      {
        status: 426,
        headers: {
          'content-type': 'application/json',
        },
      },
    );
  }

  async webSocketOpen(ws: WebSocket): Promise<void> {
    const metaMessage: TranscriptMessage = {
      type: 'meta',
      question:
        'Design a rate limiter for an API that scales to millions of requests per minute. Explain your approach, data structures, and trade-offs.',
      scoringCriteria: [
        'Clarity of problem understanding and requirements gathering',
        'Correctness and efficiency of the proposed rate limiting algorithm',
        'Consideration of distributed systems concerns and failure modes',
        'Quality of communication and structure of the explanation',
      ],
    };

    ws.send(JSON.stringify(metaMessage));

    this.ctx.waitUntil(this.streamTranscription(ws));
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string): Promise<void> {
    // Echoing received messages can help validate bidirectional flow when testing.
    try {
      const decoded = typeof message === 'string' ? message : new TextDecoder().decode(message);
      console.log('TranscriptRoom received message from client:', decoded);
      ws.send(
        JSON.stringify({
          type: 'transcript',
          chunk: `Echo: ${decoded}`,
          timestamp: new Date().toISOString().split('T')[1]!,
        } satisfies TranscriptMessage),
      );
    } catch (error) {
      console.error('Failed to echo client message', error);
    }
  }

  async webSocketClose(_ws: WebSocket): Promise<void> {
    this.closed = true;
    console.info('TranscriptRoom WebSocket closed');
  }

  async webSocketError(ws: WebSocket, error: Error): Promise<void> {
    console.error('TranscriptRoom WebSocket error', error);
    this.closed = true;
    try {
      ws.send(
        JSON.stringify({
          type: 'error',
          message: 'An unexpected error occurred in the transcription stream.',
        } satisfies TranscriptMessage),
      );
    } catch (err) {
      console.error('Failed to notify client about error', err);
    }
  }

  private async streamTranscription(ws: WebSocket): Promise<void> {
    const transcriptChunks = [
      'Thanks for the prompt! I would start by clarifying the expected request patterns and the tolerance for burst traffic.',
      'For a global deployment, I would use a token bucket algorithm backed by Redis or Cloudflare Durable Objects to maintain counters per client.',
      'To support millions of requests per minute, sharding keys and leveraging edge caching can help distribute the load effectively.',
      'I would also introduce sliding window analytics to detect abuse patterns and automatically adjust thresholds.',
      'Finally, thorough observability with structured logs and metrics would ensure we can iterate on the policy safely.',
    ];

    for (const chunk of transcriptChunks) {
      if (this.closed) {
        break;
      }

      await this.delay(800);

      if (this.closed) {
        break;
      }

      try {
        ws.send(
          JSON.stringify({
            type: 'transcript',
            chunk,
            timestamp: new Date().toISOString().split('T')[1]!,
          } satisfies TranscriptMessage),
        );
      } catch (error) {
        console.error('Failed to send transcript chunk', error);
        this.closed = true;
        return;
      }
    }

    if (!this.closed) {
      try {
        ws.send(JSON.stringify({ type: 'complete' } satisfies TranscriptMessage));
      } finally {
        ws.close(1000, 'Mock transcription stream completed');
        this.closed = true;
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => c.html(FRONTEND_HTML));

app.get('/openapi.json', (c) => c.json(OPEN_API_JSON));

app.get('/openapi.yaml', (c) =>
  c.text(OPEN_API_YAML, 200, {
    'content-type': 'application/yaml; charset=utf-8',
  }),
);

app.get('/ws', (c) => {
  const id = c.env.TRANSCRIPT_ROOM.idFromName('default-room');
  const stub = c.env.TRANSCRIPT_ROOM.get(id);
  return stub.fetch(c.req.raw);
});

export default {
  fetch: app.fetch,
};
