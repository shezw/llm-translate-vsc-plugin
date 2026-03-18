import * as vscode from 'vscode';

import { buildAuthHeaders, getSettings, ProviderMode } from '../config';

interface TranslationRequest {
  systemPrompt: string;
  userPrompt: string;
}

interface TranslationStreamHandlers {
  onStart?: () => void;
  onUpdate?: (content: string) => void;
}

export class LlmClient {
  constructor(private readonly outputChannel: vscode.OutputChannel) {}

  async translate(request: TranslationRequest, handlers?: TranslationStreamHandlers): Promise<string> {
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

      handlers?.onStart?.();

      const streamedText = await tryReadStreamingResponse(provider, response, handlers);
      if (streamedText) {
        return normalizeTranslatedText(streamedText);
      }

      const payload = (await response.json()) as unknown;
      const translatedText = extractResponseText(provider, payload);
      if (!translatedText) {
        throw new Error('LLM response did not contain translated content.');
      }

      return normalizeTranslatedText(translatedText);
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
      stream: true,
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
    stream: true,
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

  const normalizedWrappedPayload = extractWrappedContent(payload);
  if (normalizedWrappedPayload) {
    return normalizedWrappedPayload;
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

async function tryReadStreamingResponse(
  provider: Exclude<ProviderMode, 'auto'>,
  response: Response,
  handlers?: TranslationStreamHandlers
): Promise<string | undefined> {
  if (!response.body) {
    return undefined;
  }

  const contentType = response.headers.get('content-type') ?? '';
  const isOllamaStream = provider === 'ollama';
  const isSse = contentType.includes('text/event-stream');
  const isNdjson = contentType.includes('application/x-ndjson') || contentType.includes('application/jsonl');

  if (!isOllamaStream && !isSse && !isNdjson) {
    return undefined;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulated = '';

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    if (isOllamaStream || isNdjson) {
      ({ buffer, accumulated } = processJsonLines(buffer, accumulated, handlers));
      continue;
    }

    ({ buffer, accumulated } = processSseEvents(buffer, accumulated, handlers));
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    if (isOllamaStream || isNdjson) {
      ({ accumulated } = processJsonLines(`${buffer}\n`, accumulated, handlers));
    } else {
      ({ accumulated } = processSseEvents(`${buffer}\n\n`, accumulated, handlers));
    }
  }

  return accumulated || undefined;
}

function processJsonLines(
  buffer: string,
  accumulated: string,
  handlers?: TranslationStreamHandlers
): { buffer: string; accumulated: string } {
  let workingBuffer = buffer;
  let current = accumulated;

  while (true) {
    const lineBreakIndex = workingBuffer.indexOf('\n');
    if (lineBreakIndex === -1) {
      break;
    }

    const line = workingBuffer.slice(0, lineBreakIndex).trim();
    workingBuffer = workingBuffer.slice(lineBreakIndex + 1);
    if (!line) {
      continue;
    }

    try {
      const payload = JSON.parse(line) as unknown;
      const chunk = extractStreamingChunk(payload);
      if (chunk) {
        current += chunk;
        handlers?.onUpdate?.(current);
      }
    } catch {
      continue;
    }
  }

  return {
    buffer: workingBuffer,
    accumulated: current
  };
}

function processSseEvents(
  buffer: string,
  accumulated: string,
  handlers?: TranslationStreamHandlers
): { buffer: string; accumulated: string } {
  let workingBuffer = buffer;
  let current = accumulated;

  while (true) {
    const eventBreakIndex = workingBuffer.indexOf('\n\n');
    if (eventBreakIndex === -1) {
      break;
    }

    const rawEvent = workingBuffer.slice(0, eventBreakIndex);
    workingBuffer = workingBuffer.slice(eventBreakIndex + 2);
    const payloadLine = rawEvent
      .split(/\r?\n/)
      .find(line => line.startsWith('data:'));

    if (!payloadLine) {
      continue;
    }

    const data = payloadLine.slice(5).trim();
    if (!data || data === '[DONE]') {
      continue;
    }

    try {
      const payload = JSON.parse(data) as unknown;
      const chunk = extractStreamingChunk(payload);
      if (chunk) {
        current += chunk;
        handlers?.onUpdate?.(current);
      }
    } catch {
      continue;
    }
  }

  return {
    buffer: workingBuffer,
    accumulated: current
  };
}

function extractStreamingChunk(payload: unknown): string | undefined {
  if (!isRecord(payload)) {
    return undefined;
  }

  const wrapped = extractWrappedContent(payload);
  if (wrapped) {
    return wrapped;
  }

  if (typeof payload.response === 'string') {
    return payload.response;
  }

  const message = payload.message;
  if (isRecord(message) && typeof message.content === 'string') {
    return message.content;
  }

  const choices = payload.choices;
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0];
    if (isRecord(firstChoice)) {
      const delta = firstChoice.delta;
      if (isRecord(delta) && typeof delta.content === 'string') {
        return delta.content;
      }

      const choiceMessage = firstChoice.message;
      if (isRecord(choiceMessage) && typeof choiceMessage.content === 'string') {
        return choiceMessage.content;
      }
    }
  }

  return undefined;
}

function normalizeTranslatedText(content: string): string {
  const stripped = stripMarkdownFences(content.trim());
  const normalizedWrappedPayload = tryExtractWrappedContentFromString(stripped);
  return normalizedWrappedPayload ?? stripped;
}

function tryExtractWrappedContentFromString(content: string): string | undefined {
  const trimmed = content.trim();
  if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (!isRecord(parsed)) {
      return undefined;
    }

    return extractWrappedContent(parsed);
  } catch {
    return undefined;
  }
}

function extractWrappedContent(payload: Record<string, any>): string | undefined {
  if (typeof payload.content === 'string') {
    return payload.content;
  }

  const data = payload.data;
  if (isRecord(data)) {
    if (typeof data.content === 'string') {
      return data.content;
    }

    const nestedMessage = data.message;
    if (isRecord(nestedMessage) && typeof nestedMessage.content === 'string') {
      return nestedMessage.content;
    }
  }

  const message = payload.message;
  if (isRecord(message) && typeof message.content === 'string') {
    return message.content;
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
