import * as path from 'path';

import { DOCUMENT_EXTENSIONS } from '../constants';
import { CommentPattern, getCommentPattern } from './commentPatterns';

export type TranslationMode = 'document' | 'code' | 'unsupported';

export interface TranslationPlan {
  extension: string;
  fileName: string;
  mode: TranslationMode;
  commentPattern?: CommentPattern;
}

export function getTranslationPlan(filePath: string): TranslationPlan {
  const extension = path.extname(filePath).toLowerCase();
  const fileName = path.basename(filePath);

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return {
      extension,
      fileName,
      mode: 'document'
    };
  }

  const commentPattern = getCommentPattern(extension);
  if (commentPattern) {
    return {
      extension,
      fileName,
      mode: 'code',
      commentPattern
    };
  }

  return {
    extension,
    fileName,
    mode: 'unsupported'
  };
}
