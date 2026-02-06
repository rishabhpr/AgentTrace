# AgentTrace Dashboard

Web dashboard for viewing AgentTrace execution traces.

## Quick Start

```bash
cd agenttrace-dashboard
npm start
```

Then open http://localhost:3457

## Tailscale Serve (Production)

```bash
sudo tailscale serve --bg --https 443 http://localhost:3457
```

## Environment Variables

- `PORT` — Server port (default: 3457)
- `TRACES_DIR` — Trace storage directory (default: ~/.agenttrace)

## Features

- Real-time trace listing
- Hierarchical span visualization
- Status indicators (ok/error/in_progress)
- Event timeline
- Attribute inspection
