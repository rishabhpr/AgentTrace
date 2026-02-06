# AgentTrace OpenClaw Plugin

Capture, store, and query structured execution traces from AI agent sessions.

## Installation

Copy the `extensions/agenttrace` folder to your OpenClaw extensions directory:

```bash
cp -r extensions/agenttrace /path/to/openclaw/extensions/
```

## Configuration

Add to your OpenClaw config:

```json
{
  "extensions": {
    "agenttrace": {
      "storageDir": "~/.agenttrace",
      "defaultFormat": "jsonl",
      "autoCapture": false,
      "retentionDays": 30
    }
  }
}
```

## Usage

### Start a Trace

```json
{
  "tool": "agenttrace",
  "params": {
    "action": "start",
    "sessionId": "session-123",
    "name": "my-workflow",
    "attributes": { "userId": "user-456" }
  }
}
```

### Record a Span

```json
{
  "tool": "agenttrace",
  "params": {
    "action": "record",
    "traceId": "trace_abc123",
    "name": "tool-execution",
    "parentSpanId": "span_xyz",
    "attributes": { "tool": "web_search" }
  }
}
```

### Finalize a Trace

```json
{
  "tool": "agenttrace",
  "params": {
    "action": "finalize",
    "traceId": "trace_abc123",
    "status": "ok"
  }
}
```

### List Traces

```json
{
  "tool": "agenttrace",
  "params": {
    "action": "list",
    "limit": 10
  }
}
```

## Output Formats

- **json** - Pretty-printed JSON with full hierarchy
- **jsonl** - Flattened newline-delimited JSON for streaming
- **html** - Interactive HTML report with tree visualization

## Specification

See [agenttrace-spec.html](agenttrace-spec.html) for the full specification.
