import * as vscode from 'vscode';

import { PREVIEW_SCHEME } from '../constants';

interface PreviewUpdate {
  content: string;
  status?: string;
  isStreaming?: boolean;
  sourceLabel?: string;
  languageId?: string;
}

interface PreviewEntry {
  panel: vscode.WebviewPanel;
  title: string;
  state: Required<PreviewUpdate>;
}

export class TranslationPreviewProvider implements vscode.Disposable {
  private readonly panels = new Map<string, PreviewEntry>();
  private readonly disposables: vscode.Disposable[] = [];

  async openPreview(sourceUri: vscode.Uri, title: string, initialContent: string, languageId: string): Promise<vscode.Uri> {
    const previewUri = this.createPreviewUri(sourceUri, title);
    const key = previewUri.toString();
    const existing = this.panels.get(key);

    if (existing) {
      existing.panel.title = title;
      existing.panel.reveal(vscode.ViewColumn.Beside, true);
      this.update(previewUri, {
        content: initialContent,
        languageId,
        sourceLabel: sourceUri.fsPath,
        status: 'Preparing translation preview...',
        isStreaming: true
      });
      return previewUri;
    }

    const panel = vscode.window.createWebviewPanel('llmTranslatePreview', title, {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: true
    }, {
      enableScripts: true,
      retainContextWhenHidden: true
    });

    const state: Required<PreviewUpdate> = {
      content: initialContent,
      status: 'Preparing translation preview...',
      isStreaming: true,
      sourceLabel: sourceUri.fsPath,
      languageId
    };

    panel.webview.html = this.renderHtml(panel.webview, title, state);

    const disposeHandle = panel.onDidDispose(() => {
      this.panels.delete(key);
      disposeHandle.dispose();
    });

    this.panels.set(key, {
      panel,
      title,
      state
    });

    panel.reveal(vscode.ViewColumn.Beside, true);
    return previewUri;
  }

  update(previewUri: vscode.Uri, update: PreviewUpdate): void {
    const entry = this.panels.get(previewUri.toString());
    if (!entry) {
      return;
    }

    entry.state = {
      ...entry.state,
      ...update,
      status: update.status ?? entry.state.status,
      isStreaming: update.isStreaming ?? entry.state.isStreaming,
      sourceLabel: update.sourceLabel ?? entry.state.sourceLabel,
      languageId: update.languageId ?? entry.state.languageId,
      content: update.content
    };

    entry.panel.webview.postMessage({
      type: 'update',
      payload: entry.state
    });
  }

  dispose(): void {
    for (const entry of this.panels.values()) {
      entry.panel.dispose();
    }
    this.panels.clear();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
  }

  private createPreviewUri(sourceUri: vscode.Uri, title: string): vscode.Uri {
    const safeTitle = title.replace(/[^a-zA-Z0-9._-]+/g, '-');
    return vscode.Uri.from({
      scheme: PREVIEW_SCHEME,
      path: `/${safeTitle}`,
      query: sourceUri.toString()
    });
  }

  private renderHtml(webview: vscode.Webview, title: string, state: Required<PreviewUpdate>): string {
    const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const initialState = JSON.stringify(state)
      .replace(/</g, '\\u003c')
      .replace(/>/g, '\\u003e')
      .replace(/&/g, '\\u0026');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #111111;
      --panel: rgba(25, 25, 28, 0.86);
      --panel-border: rgba(255, 255, 255, 0.08);
      --panel-glow: rgba(255, 137, 61, 0.7);
      --text: #f4f5f7;
      --muted: #a4a7ae;
      --accent: #ff8f47;
      --accent-soft: rgba(255, 143, 71, 0.16);
    }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background:
        radial-gradient(circle at top left, rgba(255, 153, 94, 0.18), transparent 28%),
        radial-gradient(circle at bottom right, rgba(255, 112, 55, 0.12), transparent 32%),
        var(--bg);
      color: var(--text);
    }
    .shell {
      min-height: 100vh;
      padding: 18px;
      box-sizing: border-box;
    }
    .card {
      position: relative;
      min-height: calc(100vh - 36px);
      border-radius: 18px;
      border: 1px solid var(--panel-border);
      background: var(--panel);
      overflow: hidden;
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.35);
    }
    .card.streaming::before {
      content: '';
      position: absolute;
      inset: -1px;
      border-radius: 18px;
      pointer-events: none;
      border: 1px solid rgba(255, 162, 82, 0.8);
      box-shadow: 0 0 0 1px rgba(255, 162, 82, 0.25), 0 0 26px 6px var(--panel-glow);
      animation: glow 1.4s ease-in-out infinite alternate;
    }
    @keyframes glow {
      from {
        box-shadow: 0 0 0 1px rgba(255, 162, 82, 0.18), 0 0 18px 2px rgba(255, 143, 71, 0.28);
      }
      to {
        box-shadow: 0 0 0 1px rgba(255, 162, 82, 0.42), 0 0 28px 8px rgba(255, 143, 71, 0.56);
      }
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 14px 18px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      background: rgba(255, 255, 255, 0.03);
    }
    .meta {
      min-width: 0;
    }
    .title {
      font-size: 13px;
      font-weight: 700;
      letter-spacing: 0.02em;
      margin-bottom: 4px;
    }
    .source {
      font-size: 11px;
      color: var(--muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 65vw;
    }
    .badge {
      flex-shrink: 0;
      border-radius: 999px;
      padding: 6px 10px;
      font-size: 11px;
      font-weight: 700;
      color: var(--accent);
      background: var(--accent-soft);
      border: 1px solid rgba(255, 159, 92, 0.24);
    }
    .body {
      padding: 18px;
    }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
      font-size: 13px;
      line-height: 1.6;
      color: var(--text);
    }
  </style>
</head>
<body>
  <div class="shell">
    <section id="card" class="card${state.isStreaming ? ' streaming' : ''}">
      <header class="header">
        <div class="meta">
          <div class="title">${escapeHtml(title)}</div>
          <div id="source" class="source">${escapeHtml(state.sourceLabel)}</div>
        </div>
        <div id="badge" class="badge">${escapeHtml(state.status)}</div>
      </header>
      <div class="body">
        <pre id="content">${escapeHtml(state.content)}</pre>
      </div>
    </section>
  </div>
  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    const state = ${initialState};
    const card = document.getElementById('card');
    const sourceNode = document.getElementById('source');
    const badgeNode = document.getElementById('badge');
    const contentNode = document.getElementById('content');

    function render(next) {
      sourceNode.textContent = next.sourceLabel || '';
      badgeNode.textContent = next.status || '';
      contentNode.textContent = next.content || '';
      card.classList.toggle('streaming', Boolean(next.isStreaming));
    }

    render(state);

    window.addEventListener('message', event => {
      const message = event.data;
      if (!message || message.type !== 'update') {
        return;
      }

      render(message.payload);
    });
  </script>
</body>
</html>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
