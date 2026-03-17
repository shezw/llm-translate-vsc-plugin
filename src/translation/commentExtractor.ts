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

    result = `${result.slice(0, segment.start)}${translatedComment}${result.slice(segment.end)}`;
  }

  return result;
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
