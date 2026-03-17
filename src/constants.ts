export const EXTENSION_NAMESPACE = 'llmTranslate';
export const PREVIEW_SCHEME = 'llm-translate-preview';
export const DEFAULT_CACHE_ROOT = '~/llm-translate';

export const DOCUMENT_EXTENSIONS = new Set([
  '.md',
  '.markdown',
  '.mdx',
  '.txt',
  '.rst',
  '.adoc'
]);

export const NON_TRANSLATABLE_TOKEN_PATTERN = String.raw`(?:https?:\/\/\S+|www\.\S+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\b(?:[A-F0-9]{2}:){5}[A-F0-9]{2}\b|\b(?:0x)?[0-9A-F]{8,}\b)`;
