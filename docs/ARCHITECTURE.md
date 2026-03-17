# Architecture

## Goals

- Add a file-level translate action to supported editors.
- Reuse cached translations whenever the source md5 is unchanged.
- Support both document translation and comment-only code translation.
- Support multiple target languages with per-language commands and cache artifacts.
- Allow configurable local or remote LLM endpoints and authentication.

## Main modules

### `src/extension.ts`

Registers commands, preview provider, editor-title actions, and dynamic context keys:

- `llmTranslate.isSupported`
- `llmTranslate.hasTranslation`

The editor title action uses the configured default target language. Context menus expose nested language-specific translate and refresh actions.

### `src/translation/translator.ts`

Coordinates the end-to-end flow:

1. Classify the active file.
2. Compute source md5.
3. Open a side preview.
4. Reuse cached output when available and unchanged.
5. For code files, extract comment snippets and split them into batches.
6. Build the translation prompt.
7. Call the configured LLM.
8. Merge translated comments back into the original source file when needed.
9. Persist the translated output and hash metadata.
10. Update the preview and UI state.

### `src/cache/cacheManager.ts`

Generates the cache directory and filenames, writes hash metadata, and stores translated artifacts.

Naming strategy:

- Hash: `$pwd_$file_$lang.hash`
- Translation: `$pwd_$file_$lang_llm-trans.$ext`

Both files live under `$cacheRoot/$user/`.

### `src/translation/fileClassifier.ts`

Determines whether a file should be handled as:

- `document`
- `code`
- `unsupported`

### `src/translation/commentPatterns.ts`

Contains the comment syntax dictionary for common file types. This dictionary is also passed to the LLM prompt for code translation mode.

### `src/translation/commentExtractor.ts`

Extracts comment snippets from non-document source files, batches them into smaller payloads for the LLM, and applies translated comment text back onto the original source content.

### `src/translation/prompts.ts`

Stores the translation system prompt and specialized document/code prompts.

All prompts include the selected target language so the LLM knows exactly which language to produce.

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
  -> comment extraction for code files
  -> LLM call when needed
  -> merge translated comments for code files
  -> write hash + translated file
  -> update preview
```

## Current constraints

- The extension assumes the target API is either OpenAI-compatible or Ollama chat.
- Document mode still sends the full document to the LLM, so very large documentation files remain constrained by the model context window.
- The refresh icon state is based on whether a translated cache file exists for the currently configured default target language.
- Refresh state is driven by whether a translated cache file already exists for the active source file.
- Translation preview is virtual and read-only; the persisted output is stored in the cache directory.

## Recommended next iterations

1. Add tests around cache naming and prompt generation.
2. Add a tree view for browsing cached translations.
3. Add secret storage support for tokens instead of plain settings.
4. Add diff rendering between source and translated output.
