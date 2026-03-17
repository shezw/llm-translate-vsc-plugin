import * as vscode from 'vscode';

import { CacheManager } from './cache/cacheManager';
import { PREVIEW_SCHEME } from './constants';
import { LlmClient } from './llm/client';
import { TranslationPreviewProvider } from './preview/previewProvider';
import { getTranslationPlan } from './translation/fileClassifier';
import { Translator } from './translation/translator';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  const outputChannel = vscode.window.createOutputChannel('LLM Translate');
  const cacheManager = new CacheManager();
  const previewProvider = new TranslationPreviewProvider();
  const llmClient = new LlmClient(outputChannel);
  const translator = new Translator(cacheManager, llmClient, previewProvider, outputChannel);

  context.subscriptions.push(outputChannel);
  context.subscriptions.push(previewProvider);
  context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider(PREVIEW_SCHEME, previewProvider));

  context.subscriptions.push(
    vscode.commands.registerCommand('llmTranslate.translateFile', async (resource?: vscode.Uri) => {
      await runTranslation(translator, cacheManager, resource, false);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('llmTranslate.refreshFile', async (resource?: vscode.Uri) => {
      await runTranslation(translator, cacheManager, resource, true);
    })
  );

  const updateContext = async (editor: vscode.TextEditor | undefined): Promise<void> => {
    const sourceUri = editor?.document.uri;
    if (!sourceUri || sourceUri.scheme !== 'file') {
      await setContext(false, false);
      return;
    }

    const plan = getTranslationPlan(sourceUri.fsPath);
    if (plan.mode === 'unsupported') {
      await setContext(false, false);
      return;
    }

    const hasTranslation = await cacheManager.hasTranslation(sourceUri);
    await setContext(true, hasTranslation);
  };

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(updateContext));
  context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(async document => {
    if (vscode.window.activeTextEditor?.document.uri.toString() === document.uri.toString()) {
      await updateContext(vscode.window.activeTextEditor);
    }
  }));

  await updateContext(vscode.window.activeTextEditor);
}

export function deactivate(): void {}

async function runTranslation(
  translator: Translator,
  cacheManager: CacheManager,
  resource: vscode.Uri | undefined,
  forceRefresh: boolean
): Promise<void> {
  const sourceDocument = await resolveSourceDocument(resource);
  if (!sourceDocument) {
    void vscode.window.showWarningMessage('Open a supported file before running LLM Translate.');
    return;
  }

  try {
    await translator.translate(sourceDocument, forceRefresh);
    const hasTranslation = await cacheManager.hasTranslation(sourceDocument.uri);
    await setContext(true, hasTranslation);

    const translatedFilePath = await translator.getTranslatedFilePath(sourceDocument.uri);
    void vscode.window.setStatusBarMessage(`LLM Translate ready: ${translatedFilePath}`, 5000);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showErrorMessage(`LLM Translate failed: ${message}`);
  }
}

async function resolveSourceDocument(resource: vscode.Uri | undefined): Promise<vscode.TextDocument | undefined> {
  if (resource) {
    return vscode.workspace.openTextDocument(resource);
  }

  return vscode.window.activeTextEditor?.document;
}

async function setContext(isSupported: boolean, hasTranslation: boolean): Promise<void> {
  await vscode.commands.executeCommand('setContext', 'llmTranslate.isSupported', isSupported);
  await vscode.commands.executeCommand('setContext', 'llmTranslate.hasTranslation', hasTranslation);
}
