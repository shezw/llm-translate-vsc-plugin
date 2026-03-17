export interface CommentPattern {
  extensions: string[];
  label: string;
  description: string;
  singleLine?: string[];
  block?: Array<{ start: string; end: string }>;
  doc?: string[];
}

export const COMMENT_PATTERNS: CommentPattern[] = [
  {
    extensions: ['.c', '.h', '.cpp', '.hpp', '.cc', '.hh', '.java', '.js', '.jsx', '.ts', '.tsx', '.go', '.rs', '.swift', '.kt', '.kts'],
    label: 'C-style comments',
    description: 'Translate // line comments, /* block comments */, and doc comments while keeping code syntax untouched.',
    singleLine: ['//'],
    block: [{ start: '/*', end: '*/' }],
    doc: ['/**', '///']
  },
  {
    extensions: ['.py', '.sh', '.rb', '.yaml', '.yml', '.toml', '.ini', '.conf', '.properties'],
    label: 'Hash comments',
    description: 'Translate # comments and inline hash comments. Preserve shebang lines, keys, and values that are machine-readable.',
    singleLine: ['#'],
    doc: ['###']
  },
  {
    extensions: ['.sql'],
    label: 'SQL comments',
    description: 'Translate -- comments and /* block comments */ while preserving SQL statements and identifiers.',
    singleLine: ['--'],
    block: [{ start: '/*', end: '*/' }]
  },
  {
    extensions: ['.lua'],
    label: 'Lua comments',
    description: 'Translate -- line comments and --[[ block comments ]] while preserving symbols and code.',
    singleLine: ['--'],
    block: [{ start: '--[[', end: ']]' }]
  },
  {
    extensions: ['.html', '.xml', '.svg', '.vue'],
    label: 'Markup comments',
    description: 'Translate <!-- --> comments and keep tags, attributes, and inline scripts unchanged.',
    block: [{ start: '<!--', end: '-->' }]
  },
  {
    extensions: ['.css', '.scss', '.less'],
    label: 'Style comments',
    description: 'Translate /* */ comments while preserving selectors, properties, and variable names.',
    block: [{ start: '/*', end: '*/' }]
  }
];

const COMMENT_PATTERN_BY_EXTENSION = new Map<string, CommentPattern>();

for (const pattern of COMMENT_PATTERNS) {
  for (const extension of pattern.extensions) {
    COMMENT_PATTERN_BY_EXTENSION.set(extension, pattern);
  }
}

export function getCommentPattern(extension: string): CommentPattern | undefined {
  return COMMENT_PATTERN_BY_EXTENSION.get(extension.toLowerCase());
}
