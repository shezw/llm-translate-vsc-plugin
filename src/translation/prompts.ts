import { NON_TRANSLATABLE_TOKEN_PATTERN } from '../constants';
import { CommentPattern } from './commentPatterns';

export interface CommentTranslationItem {
  id: string;
  text: string;
  line: number;
}

export interface CommentTranslationResult {
  translations: Array<{
    id: string;
    translatedComment: string;
  }>;
}

export interface PromptMetadata {
  fileName: string;
  extension: string;
  relativePath: string;
}

export const TRANSLATION_SYSTEM_PROMPT = [
  'You are a precise software localization engine.',
  'Return only the translated file content.',
  'Do not wrap the answer in markdown fences.',
  'Preserve original formatting, whitespace, headings, tables, list depth, code fences, placeholders, and file structure.',
  'Never translate URLs, email addresses, filesystem paths, package names, identifiers, API names, versions, hashes, or machine-readable literals.',
  `Treat tokens matching this pattern as non-translatable: ${NON_TRANSLATABLE_TOKEN_PATTERN}`
].join(' ');

export function buildDocumentPrompt(metadata: PromptMetadata, content: string): string {
  return [
    'Translate the full documentation file into Simplified Chinese.',
    'Preserve the original file format exactly and keep code blocks executable.',
    'Translate human-readable prose, headings, tables, alt text, and inline comments inside fenced examples only when they are natural language.',
    'Do not change YAML front matter keys, markdown syntax, HTML tags, URLs, emails, or code identifiers.',
    `File name: ${metadata.fileName}`,
    `Extension: ${metadata.extension || '(none)'}`,
    `Relative path: ${metadata.relativePath}`,
    'Original content starts below:',
    content
  ].join('\n\n');
}

export function buildCodePrompt(metadata: PromptMetadata, content: string, commentPattern: CommentPattern): string {
  return [
    'Translate only comments and documentation text inside the source file into Simplified Chinese.',
    'Keep all executable code, imports, symbols, strings, numbers, URLs, emails, file paths, and configuration literals unchanged.',
    'Preserve comment delimiters, indentation, line breaks, and code layout exactly.',
    'If a comment mixes code tokens with natural language, translate only the natural language portions.',
    `File name: ${metadata.fileName}`,
    `Extension: ${metadata.extension || '(none)'}`,
    `Relative path: ${metadata.relativePath}`,
    `Comment rule dictionary: ${JSON.stringify(commentPattern, null, 2)}`,
    'Original content starts below:',
    content
  ].join('\n\n');
}

export function buildCodeCommentBatchPrompt(
  metadata: PromptMetadata,
  items: CommentTranslationItem[],
  commentPattern: CommentPattern
): string {
  return [
    'Translate only the human-readable parts of the extracted comments into Simplified Chinese.',
    'You are not translating the whole source file. You are translating comment snippets extracted from the file.',
    'Keep comment delimiters, indentation, leading stars, spacing, line breaks, URLs, emails, file paths, identifiers, versions, placeholders, and machine-readable literals unchanged.',
    'Return JSON only with this exact shape: {"translations":[{"id":"...","translatedComment":"..."}]}.',
    'Every input item must appear exactly once in the output. Do not omit or reorder items.',
    `File name: ${metadata.fileName}`,
    `Extension: ${metadata.extension || '(none)'}`,
    `Relative path: ${metadata.relativePath}`,
    `Comment rule dictionary: ${JSON.stringify(commentPattern, null, 2)}`,
    'Extracted comments JSON starts below:',
    JSON.stringify(items, null, 2)
  ].join('\n\n');
}

export function parseCommentTranslationResult(content: string): CommentTranslationResult {
  const trimmed = content.trim();
  const jsonText = extractJsonPayload(trimmed);
  const parsed = JSON.parse(jsonText) as CommentTranslationResult;

  if (!parsed || !Array.isArray(parsed.translations)) {
    throw new Error('LLM response did not contain a valid translations array.');
  }

  return parsed;
}

function extractJsonPayload(content: string): string {
  const firstBrace = content.indexOf('{');
  const lastBrace = content.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    throw new Error('LLM response did not contain JSON content.');
  }

  return content.slice(firstBrace, lastBrace + 1);
}
