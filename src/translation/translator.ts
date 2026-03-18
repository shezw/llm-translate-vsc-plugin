import * as fs from 'fs/promises';
import * as path from 'path';
import * as vscode from 'vscode';

import { CacheManager, computeMd5 } from '../cache/cacheManager';
import { LlmClient } from '../llm/client';
import { TranslationPreviewProvider } from '../preview/previewProvider';
import { applyCommentTranslations, extractComments, splitCommentsIntoBatches } from './commentExtractor';
import {
  buildCodeCommentBatchPrompt,
  buildDocumentPrompt,
  parseCommentTranslationResult,
  PromptMetadata,
  TRANSLATION_SYSTEM_PROMPT
} from './prompts';
import { getTranslationPlan } from './fileClassifier';
import { TargetLanguage } from './targetLanguages';

const MAX_COMMENT_BATCH_CHARS = 12000;

export class Translator {
  constructor(
    private readonly cacheManager: CacheManager,
    private readonly llmClient: LlmClient,
    private readonly previewProvider: TranslationPreviewProvider,
    private readonly outputChannel: vscode.OutputChannel
  ) {}

  async translate(sourceDocument: vscode.TextDocument, forceRefresh: boolean, targetLanguage: TargetLanguage): Promise<void> {
    const plan = getTranslationPlan(sourceDocument.uri.fsPath);
    if (plan.mode === 'unsupported') {
      throw new Error(`Unsupported file type: ${plan.extension || path.basename(sourceDocument.uri.fsPath)}`);
    }

    const sourceContent = sourceDocument.getText();
    const sourceHash = computeMd5(sourceContent);
    const artifacts = await this.cacheManager.resolveArtifacts(sourceDocument.uri, targetLanguage);
    const previewUri = await this.previewProvider.openPreview(
      sourceDocument.uri,
      `${path.basename(artifacts.translatedFilePath)}`,
      forceRefresh ? 'Refreshing translation...' : 'Preparing translation...',
      sourceDocument.languageId
    );

    this.previewProvider.update(previewUri, {
      content: '',
      sourceLabel: `${artifacts.relativePath} -> ${targetLanguage}`,
      languageId: sourceDocument.languageId,
      status: forceRefresh ? 'Refreshing translation...' : 'Waiting for model response...',
      isStreaming: true
    });

    if (!forceRefresh && (await this.cacheManager.isUpToDate(sourceDocument.uri, sourceHash, targetLanguage))) {
      const cachedTranslation = await this.cacheManager.readTranslation(sourceDocument.uri, targetLanguage);
      if (cachedTranslation !== undefined) {
        this.previewProvider.update(previewUri, {
          content: cachedTranslation,
          status: 'Loaded from cache',
          isStreaming: false
        });
        this.outputChannel.appendLine(`[cache] reused translation: ${artifacts.translatedFilePath}`);
        return;
      }
    }

    const metadata: PromptMetadata = {
      fileName: path.basename(sourceDocument.uri.fsPath),
      extension: plan.extension,
      relativePath: artifacts.relativePath,
      targetLanguage
    };

    this.previewProvider.update(previewUri, {
      content: '',
      status: 'LLM translation in progress...',
      isStreaming: true
    });
    const translatedContent = plan.mode === 'document'
      ? await this.translateDocument(sourceContent, metadata, previewUri)
      : await this.translateCodeComments(sourceContent, metadata, plan.commentPattern!, previewUri);

    await this.cacheManager.write(sourceDocument.uri, sourceHash, translatedContent, targetLanguage);
    this.previewProvider.update(previewUri, {
      content: translatedContent,
      status: 'Translation ready',
      isStreaming: false
    });
    this.outputChannel.appendLine(`[cache] wrote translation: ${artifacts.translatedFilePath}`);
  }

  async getTranslatedFilePath(sourceUri: vscode.Uri, targetLanguage: TargetLanguage): Promise<string> {
    const artifacts = await this.cacheManager.resolveArtifacts(sourceUri, targetLanguage);
    return artifacts.translatedFilePath;
  }

  async readTranslatedFile(sourceUri: vscode.Uri, targetLanguage: TargetLanguage): Promise<string | undefined> {
    const translatedFilePath = await this.getTranslatedFilePath(sourceUri, targetLanguage);

    try {
      return await fs.readFile(translatedFilePath, 'utf8');
    } catch {
      return undefined;
    }
  }

  private async translateDocument(sourceContent: string, metadata: PromptMetadata, previewUri: vscode.Uri): Promise<string> {
    return this.llmClient.translate({
      systemPrompt: TRANSLATION_SYSTEM_PROMPT,
      userPrompt: buildDocumentPrompt(metadata, sourceContent)
    }, {
      onStart: () => {
        this.previewProvider.update(previewUri, {
          content: '',
          status: 'Streaming translation...',
          isStreaming: true
        });
      },
      onUpdate: content => {
        this.previewProvider.update(previewUri, {
          content,
          status: 'Streaming translation...',
          isStreaming: true
        });
      }
    });
  }

  private async translateCodeComments(
    sourceContent: string,
    metadata: PromptMetadata,
    commentPattern: NonNullable<ReturnType<typeof getTranslationPlan>['commentPattern']>,
    previewUri: vscode.Uri
  ): Promise<string> {
    const segments = extractComments(sourceContent, commentPattern);
    if (segments.length === 0) {
      this.outputChannel.appendLine('[llm] no comment segments found; skipping LLM call');
      this.previewProvider.update(previewUri, {
        content: sourceContent,
        status: 'No comments found to translate',
        isStreaming: false
      });
      return sourceContent;
    }

    const translatedById = new Map<string, string>();
    const batches = splitCommentsIntoBatches(segments, MAX_COMMENT_BATCH_CHARS);

    for (const [index, batch] of batches.entries()) {
      this.previewProvider.update(previewUri, {
        content: applyCommentTranslations(sourceContent, segments, translatedById),
        status: `Translating comment batch ${index + 1}/${batches.length}...`,
        isStreaming: true
      });

      const userPrompt = buildCodeCommentBatchPrompt(
        metadata,
        batch.map(segment => ({
          id: segment.id,
          text: segment.text,
          line: segment.line
        })),
        commentPattern
      );

      const response = await this.llmClient.translate({
        systemPrompt: TRANSLATION_SYSTEM_PROMPT,
        userPrompt
      }, {
        onStart: () => {
          this.previewProvider.update(previewUri, {
            content: applyCommentTranslations(sourceContent, segments, translatedById),
            status: `Waiting for batch ${index + 1}/${batches.length}...`,
            isStreaming: true
          });
        }
      });

      const parsed = parseCommentTranslationResult(response);
      for (const item of parsed.translations) {
        translatedById.set(item.id, item.translatedComment);
      }

      this.previewProvider.update(previewUri, {
        content: applyCommentTranslations(sourceContent, segments, translatedById),
        status: `Applied comment batch ${index + 1}/${batches.length}`,
        isStreaming: index < batches.length - 1
      });
    }

    return applyCommentTranslations(sourceContent, segments, translatedById);
  }
}
