import * as vscode from 'vscode';

import { PREVIEW_SCHEME } from '../constants';

export class TranslationPreviewProvider implements vscode.TextDocumentContentProvider, vscode.Disposable {
  private readonly emitter = new vscode.EventEmitter<vscode.Uri>();
  private readonly contentByUri = new Map<string, string>();

  readonly onDidChange = this.emitter.event;

  provideTextDocumentContent(uri: vscode.Uri): string {
    return this.contentByUri.get(uri.toString()) ?? 'Preparing translation preview...';
  }

  async openPreview(sourceUri: vscode.Uri, title: string, initialContent: string, languageId: string): Promise<vscode.Uri> {
    const previewUri = this.createPreviewUri(sourceUri, title);
    this.contentByUri.set(previewUri.toString(), initialContent);

    const document = await vscode.workspace.openTextDocument(previewUri);
    await vscode.languages.setTextDocumentLanguage(document, languageId);
    await vscode.window.showTextDocument(document, {
      preview: true,
      preserveFocus: true,
      viewColumn: vscode.ViewColumn.Beside
    });

    return previewUri;
  }

  update(previewUri: vscode.Uri, content: string): void {
    this.contentByUri.set(previewUri.toString(), content);
    this.emitter.fire(previewUri);
  }

  dispose(): void {
    this.contentByUri.clear();
    this.emitter.dispose();
  }

  private createPreviewUri(sourceUri: vscode.Uri, title: string): vscode.Uri {
    const safeTitle = title.replace(/[^a-zA-Z0-9._-]+/g, '-');
    return vscode.Uri.from({
      scheme: PREVIEW_SCHEME,
      path: `/${safeTitle}`,
      query: sourceUri.toString()
    });
  }
}
