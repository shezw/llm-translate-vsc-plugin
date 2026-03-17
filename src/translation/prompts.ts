import { NON_TRANSLATABLE_TOKEN_PATTERN } from '../constants';
import { CommentPattern } from './commentPatterns';

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
