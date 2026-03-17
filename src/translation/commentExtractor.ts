import { CommentPattern } from './commentPatterns';

export interface ExtractedComment {
  id: string;
  start: number;
  end: number;
  text: string;
  line: number;
}

export function extractComments(content: string, commentPattern: CommentPattern): ExtractedComment[] {
  const segments: ExtractedComment[] = [];
  const occupiedRanges: Array<{ start: number; end: number }> = [];

  for (const blockPattern of commentPattern.block ?? []) {
    const regex = new RegExp(`${escapeForRegex(blockPattern.start)}[\\s\\S]*?${escapeForRegex(blockPattern.end)}`, 'g');
    for (const match of content.matchAll(regex)) {
      const start = match.index;
      const text = match[0];
      if (start === undefined || !text) {
        continue;
      }

      const end = start + text.length;
      occupiedRanges.push({ start, end });
      segments.push({
        id: `comment-${segments.length + 1}`,
        start,
        end,
        text,
        line: countLines(content, start)
      });
    }
  }

  occupiedRanges.sort((left, right) => left.start - right.start);

  const lineMarkers = [...(commentPattern.doc ?? []), ...(commentPattern.singleLine ?? [])]
    .sort((left, right) => right.length - left.length);

  if (lineMarkers.length === 0) {
    return segments.sort((left, right) => left.start - right.start);
  }

  let offset = 0;
  for (const line of content.split(/\r?\n/)) {
    const commentIndex = findLineCommentIndex(line, lineMarkers);
    const nextOffset = offset + line.length + 1;

    if (commentIndex !== -1) {
      const start = offset + commentIndex;
      const end = offset + line.length;
      if (!isInsideOccupiedRange(start, occupiedRanges)) {
        segments.push({
          id: `comment-${segments.length + 1}`,
          start,
          end,
          text: line.slice(commentIndex),
          line: countLines(content, start)
        });
      }
    }

    offset = nextOffset;
  }

  return segments.sort((left, right) => left.start - right.start);
}

export function applyCommentTranslations(
  content: string,
  segments: ExtractedComment[],
  translatedById: Map<string, string>
): string {
  let result = content;

  for (const segment of [...segments].sort((left, right) => right.start - left.start)) {
    const translatedComment = translatedById.get(segment.id);
    if (!translatedComment || translatedComment === segment.text) {
      continue;
    }

    const normalizedComment = normalizeTranslatedComment(segment.text, translatedComment);
    result = `${result.slice(0, segment.start)}${normalizedComment}${result.slice(segment.end)}`;
  }

  return result;
}

function normalizeTranslatedComment(originalComment: string, translatedComment: string): string {
  const normalizedTranslated = translatedComment.trim();
  if (normalizedTranslated.length === 0) {
    return originalComment;
  }

  const linePrefixMatch = originalComment.match(/^((?:\/\/\/|\/\/|###|##|#|--)\s*)/);
  if (linePrefixMatch) {
    const prefix = linePrefixMatch[1];
    const body = stripKnownCommentSyntax(normalizedTranslated);
    return `${prefix}${body.trim()}`;
  }

  const blockSyntax = detectBlockSyntax(originalComment);
  if (blockSyntax) {
    const innerBody = stripWrappedBlockSyntax(normalizedTranslated, blockSyntax.start, blockSyntax.end).trim();
    return rebuildBlockComment(originalComment, innerBody, blockSyntax.start, blockSyntax.end);
  }

  return translatedComment;
}

function detectBlockSyntax(comment: string): { start: string; end: string } | undefined {
  const blockMarkers: Array<{ start: string; end: string }> = [
    { start: '/**', end: '*/' },
    { start: '/*', end: '*/' },
    { start: '<!--', end: '-->' },
    { start: '--[[', end: ']]' }
  ];

  return blockMarkers.find(marker => comment.startsWith(marker.start) && comment.endsWith(marker.end));
}

function rebuildBlockComment(originalComment: string, translatedBody: string, startToken: string, endToken: string): string {
  if (!originalComment.includes('\n')) {
    const compactBody = translatedBody.replace(/\s+/g, ' ').trim();
    return compactBody ? `${startToken} ${compactBody} ${endToken}` : `${startToken}${endToken}`;
  }

  const originalLines = originalComment.split(/\r?\n/);
  const translatedLines = translatedBody.length > 0 ? translatedBody.split(/\r?\n/) : [''];
  const starPrefixMatch = originalComment.match(/\n([ \t]*\* ?)/);
  const closingLine = originalLines[originalLines.length - 1];
  const closingIndent = closingLine.slice(0, Math.max(0, closingLine.indexOf(endToken)));

  if (starPrefixMatch) {
    return [
      startToken,
      ...translatedLines.map(line => `${starPrefixMatch[1]}${line.trim()}`),
      `${closingIndent}${endToken}`
    ].join('\n');
  }

  const innerIndent = detectInnerIndent(originalLines);
  return [
    startToken,
    ...translatedLines.map(line => `${innerIndent}${line.trim()}`),
    `${closingIndent}${endToken}`
  ].join('\n');
}

function detectInnerIndent(lines: string[]): string {
  for (let index = 1; index < lines.length - 1; index += 1) {
    const match = lines[index].match(/^([ \t]+)/);
    if (match) {
      return match[1];
    }
  }

  return '  ';
}

function stripKnownCommentSyntax(content: string): string {
  return content
    .replace(/^((?:\/\/\/|\/\/|###|##|#|--)\s*)/, '')
    .replace(/^\/\*+/, '')
    .replace(/\*\/$/, '')
    .replace(/^<!--/, '')
    .replace(/-->$/, '')
    .replace(/^--\[\[/, '')
    .replace(/\]\]$/, '')
    .trim();
}

function stripWrappedBlockSyntax(content: string, startToken: string, endToken: string): string {
  let value = content;
  if (value.startsWith(startToken)) {
    value = value.slice(startToken.length);
  }
  if (value.endsWith(endToken)) {
    value = value.slice(0, value.length - endToken.length);
  }

  return value
    .split(/\r?\n/)
    .map(line => line.replace(/^[ \t]*\* ?/, ''))
    .join('\n');
}

export function splitCommentsIntoBatches(segments: ExtractedComment[], maxBatchChars: number): ExtractedComment[][] {
  const batches: ExtractedComment[][] = [];
  let currentBatch: ExtractedComment[] = [];
  let currentChars = 0;

  for (const segment of segments) {
    const nextChars = currentChars + segment.text.length;
    if (currentBatch.length > 0 && nextChars > maxBatchChars) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }

    currentBatch.push(segment);
    currentChars += segment.text.length;
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

function findLineCommentIndex(line: string, markers: string[]): number {
  const trimmed = line.trimStart();
  if (trimmed.startsWith('#!')) {
    return -1;
  }

  let bestIndex = -1;
  for (const marker of markers) {
    let searchFrom = 0;
    while (searchFrom < line.length) {
      const index = line.indexOf(marker, searchFrom);
      if (index === -1) {
        break;
      }

      if (isValidLineCommentIndex(line, marker, index)) {
        if (bestIndex === -1 || index < bestIndex) {
          bestIndex = index;
        }
        break;
      }

      searchFrom = index + marker.length;
    }
  }

  return bestIndex;
}

function isValidLineCommentIndex(line: string, marker: string, index: number): boolean {
  const previous = index > 0 ? line[index - 1] : '';

  if (marker === '//') {
    return previous !== ':';
  }

  if (marker === '#') {
    return index === 0 || /\s/.test(previous);
  }

  return true;
}

function isInsideOccupiedRange(index: number, ranges: Array<{ start: number; end: number }>): boolean {
  return ranges.some(range => index >= range.start && index < range.end);
}

function countLines(content: string, endOffset: number): number {
  return content.slice(0, endOffset).split(/\r?\n/).length;
}

function escapeForRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
