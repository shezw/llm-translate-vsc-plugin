import * as vscode from 'vscode';

import { DEFAULT_CACHE_ROOT, EXTENSION_NAMESPACE } from './constants';

export type ProviderMode = 'auto' | 'openai-compatible' | 'ollama';
export type AuthMode = 'none' | 'bearer' | 'header';

export interface LlmTranslateSettings {
  provider: ProviderMode;
  endpoint: string;
  model: string;
  authMode: AuthMode;
  authToken: string;
  authHeaderName: string;
  authHeaderValue: string;
  cacheRoot: string;
  requestTimeoutMs: number;
  temperature: number;
}

export function getSettings(): LlmTranslateSettings {
  const configuration = vscode.workspace.getConfiguration(EXTENSION_NAMESPACE);

  return {
    provider: configuration.get<ProviderMode>('provider', 'auto'),
    endpoint: configuration.get<string>('endpoint', '').trim(),
    model: configuration.get<string>('model', '').trim(),
    authMode: configuration.get<AuthMode>('authMode', 'none'),
    authToken: configuration.get<string>('authToken', '').trim(),
    authHeaderName: configuration.get<string>('authHeaderName', 'Authorization').trim(),
    authHeaderValue: configuration.get<string>('authHeaderValue', '').trim(),
    cacheRoot: configuration.get<string>('cacheRoot', DEFAULT_CACHE_ROOT).trim() || DEFAULT_CACHE_ROOT,
    requestTimeoutMs: configuration.get<number>('requestTimeoutMs', 120000),
    temperature: configuration.get<number>('temperature', 0.1)
  };
}

export function buildAuthHeaders(settings: LlmTranslateSettings): Record<string, string> {
  if (settings.authMode === 'bearer' && settings.authToken) {
    return {
      Authorization: `Bearer ${settings.authToken}`
    };
  }

  if (settings.authMode === 'header' && settings.authHeaderName && settings.authHeaderValue) {
    return {
      [settings.authHeaderName]: settings.authHeaderValue
    };
  }

  return {};
}
