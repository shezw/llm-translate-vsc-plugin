# Architecture

## Goals

- Add a file-level translate action to supported editors.
- Reuse cached translations whenever the source md5 is unchanged.
- Support both document translation and comment-only code translation.
- Allow configurable local or remote LLM endpoints and authentication.

## Main modules

### `src/extension.ts`

Registers commands, preview provider, editor-title actions, and dynamic context keys:

- `llmTranslate.isSupported`
- `llmTranslate.hasTranslation`

### `src/translation/translator.ts`

Coordinates the end-to-end flow:

1. Classify the active file.
2. Compute source md5.
3. Open a side preview.
4. Reuse cached output when available and unchanged.
5. Build the translation prompt.
6. Call the configured LLM.
7. Persist the translated output and hash metadata.
8. Update the preview and UI state.

### `src/cache/cacheManager.ts`

Generates the cache directory and filenames, writes hash metadata, and stores translated artifacts.

Naming strategy:

- Hash: `$pwd_$file.hash`
- Translation: `$pwd_$file_llm-trans.$ext`

Both files live under `$cacheRoot/$user/`.

### `src/translation/fileClassifier.ts`

Determines whether a file should be handled as:

- `document`
- `code`
- `unsupported`

### `src/translation/commentPatterns.ts`

Contains the comment syntax dictionary for common file types. This dictionary is also passed to the LLM prompt for code translation mode.

### `src/translation/prompts.ts`

Stores the translation system prompt and specialized document/code prompts.

This file is the intended place for later prompt tuning.

### `src/llm/client.ts`

Sends requests to either:

- OpenAI-compatible chat completion endpoints
- Ollama `/api/chat`

The client supports configurable auth headers and strips accidental markdown code fences from LLM output.

### `src/preview/previewProvider.ts`

Creates a side-by-side virtual document with the translation result. The preview is shown immediately and refreshed when the translation finishes.

## Runtime flow

```text
Editor title command
  -> extension command handler
  -> translator
  -> cache md5 check
  -> LLM call when needed
  -> write hash + translated file
  -> update preview
```

## Current constraints

- The extension assumes the target API is either OpenAI-compatible or Ollama chat.
- Refresh state is driven by whether a translated cache file already exists for the active source file.
- Translation preview is virtual and read-only; the persisted output is stored in the cache directory.

## Recommended next iterations

1. Add tests around cache naming and prompt generation.
2. Add a tree view for browsing cached translations.
3. Add secret storage support for tokens instead of plain settings.
4. Add diff rendering between source and translated output.
