import * as vscode from 'vscode';

import { buildAuthHeaders, getSettings, ProviderMode } from '../config';

interface TranslationRequest {
  systemPrompt: string;
  userPrompt: string;
}

export class LlmClient {
  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  async translate(request: TranslationRequest): Promise<string> {
    const settings = getSettings();
    if (!settings.endpoint) {
      throw new Error('Missing llmTranslate.endpoint setting.');
    }

    if (!settings.model) {
      throw new Error('Missing llmTranslate.model setting.');
    }

    const provider = resolveProvider(settings.provider, settings.endpoint);
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), settings.requestTimeoutMs);

    try {
      const response = await fetch(settings.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildAuthHeaders(settings)
        },
        body: JSON.stringify(buildRequestBody(provider, settings.model, settings.temperature, request)),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM request failed with ${response.status}: ${errorText}`);
      }

      const payload = (await response.json()) as unknown;
      const translatedText = extractResponseText(provider, payload);
      if (!translatedText) {
        throw new Error('LLM response did not contain translated content.');
      }

      return stripMarkdownFences(translatedText.trim());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.outputChannel.appendLine(`[llm] request failed: ${message}`);
      throw error;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}

function resolveProvider(mode: ProviderMode, endpoint: string): Exclude<ProviderMode, 'auto'> {
  if (mode !== 'auto') {
    return mode;
  }

  if (endpoint.includes('/api/chat')) {
    return 'ollama';
  }

  return 'openai-compatible';
}

function buildRequestBody(
  provider: Exclude<ProviderMode, 'auto'>,
  model: string,
  temperature: number,
  request: TranslationRequest
): Record<string, unknown> {
  if (provider === 'ollama') {
    return {
      model,
      stream: false,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userPrompt }
      ],
      options: {
        temperature
      }
    };
  }

  return {
    model,
    temperature,
    messages: [
      { role: 'system', content: request.systemPrompt },
      { role: 'user', content: request.userPrompt }
    ]
  };
}

function extractResponseText(provider: Exclude<ProviderMode, 'auto'>, payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  if (provider === 'ollama') {
    const message = payload.message;
    if (isRecord(message) && typeof message.content === 'string') {
      return message.content;
    }

    if (typeof payload.response === 'string') {
      return payload.response;
    }

    return undefined;
  }

  const choices = payload.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0];
    if (isRecord(firstChoice)) {
      const message = firstChoice.message;
      if (isRecord(message) && typeof message.content === 'string') {
        return message.content;
      }

      if (typeof firstChoice.text === 'string') {
        return firstChoice.text;
      }
    }
  }

  return undefined;
}

function stripMarkdownFences(content: string): string {
  const trimmed = content.trim();
  if (!trimmed.startsWith('```')) {
    return content;
  }

  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 3 && lines[0].startsWith('```') && lines[lines.length - 1] === '```') {
    return lines.slice(1, -1).join('\n');
  }

  return content;
}

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === 'object' && value !== null;
}
