const http = require('http');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3457;
const TRACES_DIR = process.env.TRACES_DIR || path.join(os.homedir(), '.agenttrace');

// Simple HTML template
const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AgentTrace Dashboard</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #0f172a;
      color: #e2e8f0;
      min-height: 100vh;
    }
    .header {
      background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
      padding: 20px 30px;
      border-bottom: 1px solid #334155;
    }
    .header h1 {
      font-size: 1.5rem;
      font-weight: 600;
      color: #f59e0b;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .header .subtitle {
      color: #94a3b8;
      font-size: 0.875rem;
      margin-top: 5px;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin-bottom: 30px;
    }
    .stat-card {
      background: #1e293b;
      border-radius: 8px;
      padding: 20px;
      border: 1px solid #334155;
    }
    .stat-card .value {
      font-size: 2rem;
      font-weight: 700;
      color: #f59e0b;
    }
    .stat-card .label {
      color: #94a3b8;
      font-size: 0.875rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .traces-list {
      background: #1e293b;
      border-radius: 8px;
      border: 1px solid #334155;
      overflow: hidden;
    }
    .traces-header {
      background: #334155;
      padding: 15px 20px;
      font-weight: 600;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 100px;
      gap: 10px;
    }
    .trace-item {
      padding: 15px 20px;
      border-bottom: 1px solid #334155;
      display: grid;
      grid-template-columns: 2fr 1fr 1fr 100px;
      gap: 10px;
      align-items: center;
      transition: background 0.2s;
    }
    .trace-item:hover {
      background: #283548;
    }
    .trace-item:last-child {
      border-bottom: none;
    }
    .trace-id {
      font-family: 'Courier New', monospace;
      font-size: 0.875rem;
      color: #60a5fa;
    }
    .session-id {
      color: #94a3b8;
      font-size: 0.875rem;
    }
    .timestamp {
      color: #94a3b8;
      font-size: 0.875rem;
    }
    .view-btn {
      background: #f59e0b;
      color: #0f172a;
      border: none;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      display: inline-block;
      text-align: center;
      font-size: 0.875rem;
    }
    .view-btn:hover {
      background: #fbbf24;
    }
    .empty-state {
      text-align: center;
      padding: 60px 20px;
      color: #64748b;
    }
    .empty-state svg {
      width: 64px;
      height: 64px;
      margin-bottom: 20px;
      opacity: 0.5;
    }
    .back-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      color: #94a3b8;
      text-decoration: none;
      margin-bottom: 20px;
    }
    .back-btn:hover {
      color: #f59e0b;
    }
    .trace-detail {
      background: #1e293b;
      border-radius: 8px;
      border: 1px solid #334155;
      padding: 20px;
    }
    .trace-header {
      margin-bottom: 20px;
      padding-bottom: 20px;
      border-bottom: 1px solid #334155;
    }
    .trace-header h2 {
      color: #f59e0b;
      margin-bottom: 10px;
    }
    .trace-meta {
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .meta-item {
      color: #94a3b8;
      font-size: 0.875rem;
    }
    .meta-item strong {
      color: #e2e8f0;
    }
    .tree-container {
      margin-top: 20px;
    }
    .span-node {
      margin: 10px 0;
      padding: 15px;
      background: #0f172a;
      border-radius: 6px;
      border-left: 3px solid #60a5fa;
    }
    .span-node.status-ok { border-left-color: #10b981; }
    .span-node.status-error { border-left-color: #ef4444; }
    .span-node.status-in_progress { border-left-color: #f59e0b; }
    .span-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .span-name {
      font-weight: 600;
      color: #e2e8f0;
    }
    .span-status {
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 4px;
      text-transform: uppercase;
      font-weight: 600;
    }
    .span-status.ok { background: #10b981; color: #064e3b; }
    .span-status.error { background: #ef4444; color: #fef2f2; }
    .span-status.in_progress { background: #f59e0b; color: #451a03; }
    .span-id {
      font-family: 'Courier New', monospace;
      font-size: 0.75rem;
      color: #64748b;
    }
    .span-time {
      font-size: 0.75rem;
      color: #64748b;
      margin-top: 5px;
    }
    .span-attrs {
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid #334155;
    }
    .attr-item {
      font-size: 0.8rem;
      color: #94a3b8;
      margin: 3px 0;
    }
    .children {
      margin-left: 20px;
      margin-top: 10px;
    }
    pre {
      background: #0f172a;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 0.8rem;
      color: #94a3b8;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔶 AgentTrace Dashboard</h1>
    <div class="subtitle">Structured execution tracing for AI agent sessions</div>
  </div>
  <div class="container">
    {{CONTENT}}
  </div>
</body>
</html>`;

async function getTraces() {
  const traces = [];
  try {
    const entries = await fs.readdir(TRACES_DIR, { withFileTypes: true });
    const dateDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    
    for (const dateDir of dateDirs.sort().reverse()) {
      const dayPath = path.join(TRACES_DIR, dateDir);
      const files = await fs.readdir(dayPath);
      
      for (const file of files) {
        if (!file.endsWith('.jsonl') && !file.endsWith('.json')) continue;
        
        const traceId = file.replace(/\.(json|jsonl)$/, '');
        const filepath = path.join(dayPath, file);
        const stats = await fs.stat(filepath);
        
        // Try to extract session info from first line
        let sessionId = 'unknown';
        let startTime = dateDir;
        try {
          const content = await fs.readFile(filepath, 'utf8');
          const firstLine = content.split('\n')[0];
          if (firstLine) {
            const data = JSON.parse(firstLine);
            if (data.sessionId) sessionId = data.sessionId;
            if (data.startTime) startTime = data.startTime;
          }
        } catch {}
        
        traces.push({
          traceId,
          sessionId,
          startTime,
          date: dateDir,
          size: stats.size,
          filepath
        });
      }
    }
  } catch (err) {
    console.error('Error reading traces:', err.message);
  }
  return traces;
}

async function getTraceDetail(traceId) {
  try {
    const entries = await fs.readdir(TRACES_DIR, { withFileTypes: true });
    const dateDirs = entries.filter(e => e.isDirectory()).map(e => e.name);
    
    for (const dateDir of dateDirs) {
      const dayPath = path.join(TRACES_DIR, dateDir);
      const files = await fs.readdir(dayPath);
      
      for (const file of files) {
        if (file.startsWith(traceId)) {
          const filepath = path.join(dayPath, file);
          const content = await fs.readFile(filepath, 'utf8');
          
          if (file.endsWith('.jsonl')) {
            // Parse JSONL
            const lines = content.split('\n').filter(l => l.trim());
            const records = lines.map(l => JSON.parse(l));
            return { format: 'jsonl', records };
          } else {
            // Parse JSON
            return { format: 'json', data: JSON.parse(content) };
          }
        }
      }
    }
  } catch (err) {
    console.error('Error reading trace:', err.message);
  }
  return null;
}

function buildTraceTree(records) {
  const trace = records.find(r => r.type === 'trace');
  const spans = records.filter(r => r.type === 'span');
  const events = records.filter(r => r.type === 'event');
  
  const spanMap = new Map();
  const rootSpans = [];
  
  for (const span of spans) {
    span.children = [];
    span.events = events.filter(e => e.spanId === span.spanId);
    spanMap.set(span.spanId, span);
  }
  
  for (const span of spans) {
    if (span.parentSpanId && spanMap.has(span.parentSpanId)) {
      spanMap.get(span.parentSpanId).children.push(span);
    } else {
      rootSpans.push(span);
    }
  }
  
  return { trace, rootSpans };
}

function renderSpanNode(span, depth = 0) {
  const status = span.status || 'in_progress';
  const indent = depth * 20;
  
  let attrsHtml = '';
  if (span.attributes && Object.keys(span.attributes).length > 0) {
    attrsHtml = '<div class="span-attrs">' + 
      Object.entries(span.attributes).map(([k, v]) => 
        `<div class="attr-item">${k}: ${JSON.stringify(v)}</div>`
      ).join('') + 
      '</div>';
  }
  
  let eventsHtml = '';
  if (span.events && span.events.length > 0) {
    eventsHtml = '<div style="margin-top:8px;font-size:0.75rem;color:#64748b;">' +
      span.events.map(e => `• ${e.name} @ ${new Date(e.timestamp).toLocaleTimeString()}`).join('<br>') +
      '</div>';
  }
  
  let childrenHtml = '';
  if (span.children && span.children.length > 0) {
    childrenHtml = '<div class="children">' + 
      span.children.map(c => renderSpanNode(c, depth + 1)).join('') + 
      '</div>';
  }
  
  return `
    <div class="span-node status-${status}" style="margin-left: ${indent}px">
      <div class="span-header">
        <span class="span-name">${span.name}</span>
        <span class="span-status ${status}">${status}</span>
      </div>
      <div class="span-id">${span.spanId}</div>
      <div class="span-time">${new Date(span.startTime).toLocaleString()}</div>
      ${attrsHtml}
      ${eventsHtml}
      ${childrenHtml}
    </div>
  `;
}

async function renderDashboard() {
  const traces = await getTraces();
  
  if (traces.length === 0) {
    const content = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 17v-2H4.5A2.5 2.5 0 0 1 2 12.5v-9A2.5 2.5 0 0 1 4.5 1h9A2.5 2.5 0 0 1 16 3.5V9h-2V3.5a.5.5 0 0 0-.5-.5h-9a.5.5 0 0 0-.5.5v9a.5.5 0 0 0 .5.5H9z"/>
          <path d="M20.5 11h-9a2.5 2.5 0 0 0-2.5 2.5v9a2.5 2.5 0 0 0 2.5 2.5h9a2.5 2.5 0 0 0 2.5-2.5v-9a2.5 2.5 0 0 0-2.5-2.5z"/>
        </svg>
        <h3>No traces yet</h3>
        <p>Traces will appear here once you start capturing them with the agenttrace tool.</p>
      </div>
    `;
    return HTML_TEMPLATE.replace('{{CONTENT}}', content);
  }
  
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = traces.filter(t => t.date === today).length;
  
  const statsHtml = `
    <div class="stats">
      <div class="stat-card">
        <div class="value">${traces.length}</div>
        <div class="label">Total Traces</div>
      </div>
      <div class="stat-card">
        <div class="value">${todayCount}</div>
        <div class="label">Today</div>
      </div>
      <div class="stat-card">
        <div class="value">${traces[0]?.date || '-'}</div>
        <div class="label">Latest Date</div>
      </div>
    </div>
  `;
  
  const tracesHtml = traces.slice(0, 50).map(t => `
    <div class="trace-item">
      <div class="trace-id">${t.traceId}</div>
      <div class="session-id">${t.sessionId}</div>
      <div class="timestamp">${new Date(t.startTime).toLocaleString()}</div>
      <a href="/trace/${t.traceId}" class="view-btn">View</a>
    </div>
  `).join('');
  
  const content = statsHtml + `
    <div class="traces-list">
      <div class="traces-header">
        <div>Trace ID</div>
        <div>Session</div>
        <div>Started</div>
        <div>Action</div>
      </div>
      ${tracesHtml}
    </div>
  `;
  
  return HTML_TEMPLATE.replace('{{CONTENT}}', content);
}

async function renderTraceDetail(traceId) {
  const detail = await getTraceDetail(traceId);
  
  if (!detail) {
    return HTML_TEMPLATE.replace('{{CONTENT}}', `
      <a href="/" class="back-btn">← Back to list</a>
      <div class="empty-state">
        <h3>Trace not found</h3>
        <p>Could not find trace with ID: ${traceId}</p>
      </div>
    `);
  }
  
  let content = '';
  
  if (detail.format === 'jsonl') {
    const { trace, rootSpans } = buildTraceTree(detail.records);
    
    content = `
      <a href="/" class="back-btn">← Back to list</a>
      <div class="trace-detail">
        <div class="trace-header">
          <h2>${trace?.traceId || traceId}</h2>
          <div class="trace-meta">
            <div class="meta-item"><strong>Session:</strong> ${trace?.sessionId || 'unknown'}</div>
            <div class="meta-item"><strong>Started:</strong> ${trace?.startTime ? new Date(trace.startTime).toLocaleString() : '-'}</div>
            ${trace?.endTime ? `<div class="meta-item"><strong>Ended:</strong> ${new Date(trace.endTime).toLocaleString()}</div>` : ''}
          </div>
        </div>
        <div class="tree-container">
          <h3 style="margin-bottom: 15px; color: #94a3b8;">Execution Tree</h3>
          ${rootSpans.map(s => renderSpanNode(s)).join('')}
        </div>
      </div>
    `;
  } else {
    content = `
      <a href="/" class="back-btn">← Back to list</a>
      <div class="trace-detail">
        <h2>${traceId}</h2>
        <pre>${JSON.stringify(detail.data, null, 2)}</pre>
      </div>
    `;
  }
  
  return HTML_TEMPLATE.replace('{{CONTENT}}', content);
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  
  if (req.url === '/' || req.url === '/index.html') {
    const html = await renderDashboard();
    res.end(html);
  } else if (req.url.startsWith('/trace/')) {
    const traceId = req.url.split('/')[2];
    const html = await renderTraceDetail(traceId);
    res.end(html);
  } else {
    res.statusCode = 404;
    res.end('<h1>Not Found</h1>');
  }
});

server.listen(PORT, () => {
  console.log(`AgentTrace Dashboard running on http://localhost:${PORT}`);
  console.log(`Trace directory: ${TRACES_DIR}`);
});
