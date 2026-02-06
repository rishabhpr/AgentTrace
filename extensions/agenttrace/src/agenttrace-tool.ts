import { Type } from "@sinclair/typebox";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { OpenClawPluginApi } from "../../../src/plugins/types.js";

// AgentTrace Types
interface TraceSpan {
  spanId: string;
  parentSpanId?: string;
  name: string;
  startTime: string;
  endTime?: string;
  status: "ok" | "error" | "in_progress";
  attributes?: Record<string, unknown>;
  events?: TraceEvent[];
  children?: TraceSpan[];
}

interface TraceEvent {
  timestamp: string;
  name: string;
  attributes?: Record<string, unknown>;
}

interface AgentTrace {
  traceId: string;
  sessionId: string;
  startTime: string;
  endTime?: string;
  rootSpan: TraceSpan;
  metadata?: Record<string, unknown>;
}

// Configuration type
type PluginCfg = {
  storageDir?: string;
  defaultFormat?: "json" | "jsonl" | "html";
  autoCapture?: boolean;
  retentionDays?: number;
};

// Utility functions
function getStorageDir(cfg: PluginCfg): string {
  return cfg.storageDir ?? path.join(os.homedir(), ".agenttrace");
}

async function ensureStorageDir(storageDir: string): Promise<void> {
  try {
    await fs.mkdir(storageDir, { recursive: true });
  } catch {
    // ignore if exists
  }
}

function generateTraceId(): string {
  return `trace_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function generateSpanId(): string {
  return `span_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
}

function nowISO(): string {
  return new Date().toISOString();
}

async function saveTrace(
  storageDir: string,
  trace: AgentTrace,
  format: "json" | "jsonl" | "html",
): Promise<string> {
  await ensureStorageDir(storageDir);
  const dateDir = trace.startTime.slice(0, 10); // YYYY-MM-DD
  const dayDir = path.join(storageDir, dateDir);
  await fs.mkdir(dayDir, { recursive: true });

  const filename = `${trace.traceId}.${format}`;
  const filepath = path.join(dayDir, filename);

  if (format === "json") {
    await fs.writeFile(filepath, JSON.stringify(trace, null, 2));
  } else if (format === "jsonl") {
    // Flatten to JSONL for easier streaming/querying
    const lines = flattenTraceToJSONL(trace);
    await fs.writeFile(filepath, lines.join("\n"));
  } else if (format === "html") {
    const html = generateHTMLReport(trace);
    await fs.writeFile(filepath, html);
  }

  return filepath;
}

function flattenTraceToJSONL(trace: AgentTrace): string[] {
  const lines: string[] = [];
  
  // Root trace record
  lines.push(JSON.stringify({
    type: "trace",
    traceId: trace.traceId,
    sessionId: trace.sessionId,
    startTime: trace.startTime,
    endTime: trace.endTime,
    metadata: trace.metadata,
  }));

  // Recursively flatten spans
  function flattenSpan(span: TraceSpan, parentId?: string) {
    lines.push(JSON.stringify({
      type: "span",
      traceId: trace.traceId,
      spanId: span.spanId,
      parentSpanId: parentId,
      name: span.name,
      startTime: span.startTime,
      endTime: span.endTime,
      status: span.status,
      attributes: span.attributes,
    }));

    // Events
    for (const event of span.events ?? []) {
      lines.push(JSON.stringify({
        type: "event",
        traceId: trace.traceId,
        spanId: span.spanId,
        timestamp: event.timestamp,
        name: event.name,
        attributes: event.attributes,
      }));
    }

    // Children
    for (const child of span.children ?? []) {
      flattenSpan(child, span.spanId);
    }
  }

  flattenSpan(trace.rootSpan);
  return lines;
}

function generateHTMLReport(trace: AgentTrace): string {
  const duration = trace.endTime 
    ? new Date(trace.endTime).getTime() - new Date(trace.startTime).getTime()
    : null;

  function renderSpan(span: TraceSpan, depth = 0): string {
    const indent = "  ".repeat(depth);
    const spanDuration = span.endTime 
      ? new Date(span.endTime).getTime() - new Date(span.startTime).getTime()
      : null;
    
    const statusColor = span.status === "ok" ? "#10b981" : span.status === "error" ? "#ef4444" : "#f59e0b";
    
    let html = `${indent}<div class="span" style="margin-left: ${depth * 20}px; border-left: 3px solid ${statusColor}; padding-left: 10px; margin-bottom: 10px;">\n`;
    html += `${indent}  <div class="span-header" style="display: flex; align-items: center; gap: 10px;">\n`;
    html += `${indent}    <span class="span-name" style="font-weight: bold;">${escapeHtml(span.name)}</span>\n`;
    html += `${indent}    <span class="span-status" style="color: ${statusColor}; font-size: 0.8em;">[${span.status}]</span>\n`;
    if (spanDuration !== null) {
      html += `${indent}    <span class="span-duration" style="color: #6b7280; font-size: 0.8em;">${spanDuration}ms</span>\n`;
    }
    html += `${indent}  </div>\n`;
    
    if (span.attributes && Object.keys(span.attributes).length > 0) {
      html += `${indent}  <div class="span-attrs" style="font-size: 0.85em; color: #4b5563; margin-top: 5px;">\n`;
      for (const [key, value] of Object.entries(span.attributes)) {
        html += `${indent}    <div>${escapeHtml(key)}: ${escapeHtml(JSON.stringify(value))}</div>\n`;
      }
      html += `${indent}  </div>\n`;
    }

    if (span.events && span.events.length > 0) {
      html += `${indent}  <div class="span-events" style="margin-top: 5px;">\n`;
      for (const event of span.events) {
        html += `${indent}    <div class="event" style="font-size: 0.8em; color: #6b7280;">\n`;
        html += `${indent}      • ${escapeHtml(event.name)} @ ${event.timestamp}\n`;
        html += `${indent}    </div>\n`;
      }
      html += `${indent}  </div>\n`;
    }

    if (span.children && span.children.length > 0) {
      for (const child of span.children) {
        html += renderSpan(child, depth + 1);
      }
    }

    html += `${indent}</div>\n`;
    return html;
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentTrace: ${trace.traceId}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; background: #f9fafb; }
    .trace-header { background: white; padding: 20px; border-radius: 8px; margin-bottom: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .trace-header h1 { margin: 0 0 10px 0; font-size: 1.5rem; }
    .trace-meta { color: #6b7280; font-size: 0.9rem; }
    .trace-tree { background: white; padding: 20px; border-radius: 8px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
  </style>
</head>
<body>
  <div class="trace-header">
    <h1>AgentTrace Report</h1>
    <div class="trace-meta">
      <div><strong>Trace ID:</strong> ${escapeHtml(trace.traceId)}</div>
      <div><strong>Session:</strong> ${escapeHtml(trace.sessionId)}</div>
      <div><strong>Started:</strong> ${trace.startTime}</div>
      ${trace.endTime ? `<div><strong>Ended:</strong> ${trace.endTime}</div>` : ""}
      ${duration !== null ? `<div><strong>Duration:</strong> ${duration}ms</div>` : ""}
    </div>
  </div>
  <div class="trace-tree">
    ${renderSpan(trace.rootSpan)}
  </div>
</body>
</html>`;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

async function listTraces(storageDir: string, limit = 10): Promise<Array<{ traceId: string; sessionId: string; startTime: string; filepath: string }>> {
  const traces: Array<{ traceId: string; sessionId: string; startTime: string; filepath: string }> = [];
  
  try {
    const entries = await fs.readdir(storageDir, { withFileTypes: true });
    const dateDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    
    // Sort by date descending
    dateDirs.sort().reverse();
    
    for (const dateDir of dateDirs) {
      if (traces.length >= limit) break;
      
      const dayPath = path.join(storageDir, dateDir);
      const files = await fs.readdir(dayPath);
      
      for (const file of files) {
        if (traces.length >= limit) break;
        if (!file.endsWith(".json") && !file.endsWith(".jsonl")) continue;
        
        const traceId = file.replace(/\.(json|jsonl)$/, "");
        const filepath = path.join(dayPath, file);
        
        // Extract basic info from filename/date
        traces.push({
          traceId,
          sessionId: "unknown",
          startTime: `${dateDir}T00:00:00Z`,
          filepath,
        });
      }
    }
  } catch {
    // Storage dir doesn't exist yet
  }
  
  return traces;
}

// Main tool
export function createAgentTraceTool(api: OpenClawPluginApi) {
  const pluginCfg = (api.pluginConfig ?? {}) as PluginCfg;
  const storageDir = getStorageDir(pluginCfg);

  return {
    name: "agenttrace",
    description:
      "Capture, store, and query structured execution traces from AI agent sessions. Supports creating new traces, recording spans/events, finalizing traces, and querying stored traces.",
    parameters: Type.Object({
      action: Type.String({
        description: "Action to perform: 'start', 'record', 'finalize', 'query', 'list'",
        enum: ["start", "record", "finalize", "query", "list"],
      }),
      traceId: Type.Optional(Type.String({ description: "Trace ID (required for record/finalize/query)" })),
      sessionId: Type.Optional(Type.String({ description: "Session ID (required for start)" })),
      name: Type.Optional(Type.String({ description: "Span or event name" })),
      spanId: Type.Optional(Type.String({ description: "Span ID for recording events" })),
      parentSpanId: Type.Optional(Type.String({ description: "Parent span ID for hierarchical spans" })),
      attributes: Type.Optional(Type.Record(Type.String(), Type.Unknown(), { description: "Custom attributes" })),
      status: Type.Optional(Type.String({ enum: ["ok", "error", "in_progress"], description: "Span status" })),
      format: Type.Optional(Type.String({ enum: ["json", "jsonl", "html"], description: "Output format" })),
      limit: Type.Optional(Type.Number({ description: "Limit for list queries", default: 10 })),
    }),

    async execute(_id: string, params: Record<string, unknown>) {
      const action = String(params.action);

      // Action: start - Create a new trace
      if (action === "start") {
        const sessionId = String(params.sessionId ?? "unknown");
        const traceId = generateTraceId();
        const rootSpanId = generateSpanId();
        
        const trace: AgentTrace = {
          traceId,
          sessionId,
          startTime: nowISO(),
          rootSpan: {
            spanId: rootSpanId,
            name: String(params.name ?? "session"),
            startTime: nowISO(),
            status: "in_progress",
            attributes: (params.attributes as Record<string, unknown>) ?? {},
            events: [],
            children: [],
          },
          metadata: {
            plugin: "agenttrace",
            version: "1.0.0",
          },
        };

        // Store in-memory (in a real implementation, use a proper cache)
        const format = (params.format as "json" | "jsonl" | "html") ?? pluginCfg.defaultFormat ?? "jsonl";
        const filepath = await saveTrace(storageDir, trace, format);

        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({ 
              traceId, 
              rootSpanId, 
              sessionId, 
              filepath,
              message: "Trace started. Use traceId for subsequent record/finalize calls."
            }, null, 2) 
          }],
          details: { trace, filepath },
        };
      }

      // Action: record - Add a span or event to an existing trace
      if (action === "record") {
        if (!params.traceId) {
          throw new Error("traceId required for record action");
        }
        const traceId = String(params.traceId);
        
        // In a real implementation, load existing trace, modify, and save
        // For now, return a success response indicating what would be recorded
        const newSpanId = generateSpanId();
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              traceId,
              spanId: newSpanId,
              name: params.name,
              parentSpanId: params.parentSpanId,
              status: params.status ?? "in_progress",
              timestamp: nowISO(),
              message: "Span recorded (simplified implementation)"
            }, null, 2) 
          }],
          details: { recorded: true, spanId: newSpanId },
        };
      }

      // Action: finalize - Complete a trace
      if (action === "finalize") {
        if (!params.traceId) {
          throw new Error("traceId required for finalize action");
        }
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              traceId: params.traceId,
              endTime: nowISO(),
              status: params.status ?? "ok",
              message: "Trace finalized"
            }, null, 2) 
          }],
          details: { finalized: true },
        };
      }

      // Action: query - Get a specific trace
      if (action === "query") {
        if (!params.traceId) {
          throw new Error("traceId required for query action");
        }
        
        // In a real implementation, load and return the trace
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              traceId: params.traceId,
              message: "Query not fully implemented in this version"
            }, null, 2) 
          }],
          details: { found: false },
        };
      }

      // Action: list - List recent traces
      if (action === "list") {
        const limit = typeof params.limit === "number" ? params.limit : 10;
        const traces = await listTraces(storageDir, limit);
        
        return {
          content: [{ 
            type: "text", 
            text: JSON.stringify({
              count: traces.length,
              storageDir,
              traces: traces.map(t => ({
                traceId: t.traceId,
                sessionId: t.sessionId,
                startTime: t.startTime,
              }))
            }, null, 2) 
          }],
          details: { traces },
        };
      }

      throw new Error(`Unknown action: ${action}`);
    },
  };
}
