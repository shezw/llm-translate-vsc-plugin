import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { CacheManager, computeMd5 } from '../cache/cacheManager';
import { LlmClient } from '../llm/client';
import { TranslationPreviewProvider } from '../preview/previewProvider';
import { buildCodePrompt, buildDocumentPrompt, PromptMetadata, TRANSLATION_SYSTEM_PROMPT } from './prompts';
import { getTranslationPlan } from './fileClassifier';

export class Translator {
  constructor(
    private readonly cacheManager: CacheManager,
    private readonly llmClient: LlmClient,
    private readonly previewProvider: TranslationPreviewProvider,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  async translate(sourceDocument: vscode.TextDocument, forceRefresh: boolean): Promise<void> {
    const plan = getTranslationPlan(sourceDocument.uri.fsPath);
    if (plan.mode === 'unsupported') {
      throw new Error(`Unsupported file type: ${plan.extension || path.basename(sourceDocument.uri.fsPath)}`);
    }

    const sourceContent = sourceDocument.getText();
    const sourceHash = computeMd5(sourceContent);
    const artifacts = await this.cacheManager.resolveArtifacts(sourceDocument.uri);
    const previewUri = await this.previewProvider.openPreview(
      sourceDocument.uri,
      `${path.basename(artifacts.translatedFilePath)}`,
      forceRefresh ? 'Refreshing translation...' : 'Preparing translation...',
      sourceDocument.languageId
    );

    if (!forceRefresh && (await this.cacheManager.isUpToDate(sourceDocument.uri, sourceHash))) {
      const cachedTranslation = await this.cacheManager.readTranslation(sourceDocument.uri);
      if (cachedTranslation !== undefined) {
        this.previewProvider.update(previewUri, cachedTranslation);
        this.outputChannel.appendLine(`[cache] reused translation: ${artifacts.translatedFilePath}`);
        return;
      }
    }

    const metadata: PromptMetadata = {
      fileName: path.basename(sourceDocument.uri.fsPath),
      extension: plan.extension,
      relativePath: artifacts.relativePath
    };

    const userPrompt = plan.mode === 'document'
      ? buildDocumentPrompt(metadata, sourceContent)
      : buildCodePrompt(metadata, sourceContent, plan.commentPattern!);

    this.previewProvider.update(previewUri, 'LLM translation in progress...');
    const translatedContent = await this.llmClient.translate({
      systemPrompt: TRANSLATION_SYSTEM_PROMPT,
      userPrompt
    });

    await this.cacheManager.write(sourceDocument.uri, sourceHash, translatedContent);
    this.previewProvider.update(previewUri, translatedContent);
    this.outputChannel.appendLine(`[cache] wrote translation: ${artifacts.translatedFilePath}`);
  }

  async getTranslatedFilePath(sourceUri: vscode.Uri): Promise<string> {
    const artifacts = await this.cacheManager.resolveArtifacts(sourceUri);
    return artifacts.translatedFilePath;
  }

  async readTranslatedFile(sourceUri: vscode.Uri): Promise<string | undefined> {
    const translatedFilePath = await this.getTranslatedFilePath(sourceUri);

    try {
      return await fs.readFile(translatedFilePath, 'utf8');
    } catch {
      return undefined;
    }
  }
}
