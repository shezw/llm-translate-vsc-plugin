# LLM Translate

LLM Translate is a VS Code extension for translating workspace files with a configurable local or remote LLM service.

## What it does

- Adds a translate icon to supported file editors.
- Switches the icon to refresh when a translated cache already exists for the active file.
- Translates documentation files such as Markdown, MDX, TXT, RST, and AsciiDoc as full documents.
- Translates code files by targeting comments and documentation blocks only.
- Stores md5 cache files and translated outputs under a user-configurable directory, defaulting to `~/llm-translate/<user>/`.
- Opens a side-by-side preview document while the translation is running and updates the preview when the translation finishes.

## Cache and output layout

For a source file inside the current workspace, the extension writes two files under the configured cache root:

- `$cacheRoot/$user/$pwd_$file.hash`
- `$cacheRoot/$user/$pwd_$file_llm-trans.$ext`

The hash file contains the current source md5. If the md5 matches and a translated output exists, the extension reuses the cached translation instead of calling the LLM again.

## Supported translation modes

### Documentation mode

Full-file translation with format preservation.

Current extensions:

- `.md`
- `.markdown`
- `.mdx`
- `.txt`
- `.rst`
- `.adoc`

### Code mode

Comment-only translation using a built-in comment rule dictionary for common source files.

Current extensions include:

- `.c`, `.h`, `.cpp`, `.hpp`, `.cc`, `.hh`
- `.js`, `.jsx`, `.ts`, `.tsx`
- `.java`, `.go`, `.rs`, `.swift`, `.kt`, `.kts`
- `.py`, `.sh`, `.rb`
- `.sql`, `.lua`
- `.html`, `.xml`, `.svg`, `.vue`
- `.css`, `.scss`, `.less`
- `.yaml`, `.yml`, `.toml`, `.ini`, `.conf`, `.properties`

## Configuration

Open VS Code Settings and search for `LLM Translate`.

Required settings:

- `llmTranslate.endpoint`: LLM HTTP endpoint.
- `llmTranslate.model`: model name.

Optional settings:

- `llmTranslate.provider`: `auto`, `openai-compatible`, or `ollama`.
- `llmTranslate.authMode`: `none`, `bearer`, or `header`.
- `llmTranslate.authToken`
- `llmTranslate.authHeaderName`
- `llmTranslate.authHeaderValue`
- `llmTranslate.cacheRoot`
- `llmTranslate.requestTimeoutMs`
- `llmTranslate.temperature`

Example user settings:

```json
{
  "llmTranslate.provider": "openai-compatible",
  "llmTranslate.endpoint": "https://your-llm.example.com/v1/chat/completions",
  "llmTranslate.model": "gpt-4.1-mini",
  "llmTranslate.authMode": "bearer",
  "llmTranslate.authToken": "<token>",
  "llmTranslate.cacheRoot": "~/llm-translate"
}
```

Example Ollama settings:

```json
{
  "llmTranslate.provider": "ollama",
  "llmTranslate.endpoint": "http://127.0.0.1:11434/api/chat",
  "llmTranslate.model": "qwen2.5:14b",
  "llmTranslate.cacheRoot": "~/llm-translate"
}
```

## Development

```bash
pnpm install
pnpm exec tsc -p ./
```

Press `F5` in VS Code to launch the Extension Development Host.

## Packaging and publish

Before publishing, update the `publisher` field in `package.json` to match your Marketplace publisher id.

```bash
pnpm run package
```

Then publish with your publisher credentials:

```bash
npx vsce publish
```

## Architecture

See the local docs/ARCHITECTURE.md file for the module layout and flow.
