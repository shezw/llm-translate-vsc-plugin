# Change Log

## 0.1.1

- Moved the target language requirement into the system prompt.
- Strengthened prompt rules so the model is explicitly constrained to answer only in the selected target language.

## 0.1.0

- Added a streaming translation preview panel with incremental response updates.
- Added a glowing waiting-state border to the translation preview while the model is responding.
- Reworked preview handling so translation results render in a webview instead of a virtual text document.
- Updated screenshot assets for the extension page.

## 0.0.7

- Removed icon button.
- Added screenshot functionality.

## 0.0.6

- Updated localized context menu labels to use language-specific "translate into" wording.
- Fixed LLM response parsing for wrapped payloads such as `{ "code": 0, "data": { "content": "..." } }`.

## 0.0.5

- Added multi-language translation targets: Simplified Chinese, English, German, French, Japanese, and Korean.
- Added nested `LLM Translate` context menus for language-specific translate and refresh actions.
- Added a default target language setting for the editor title button.
- Changed cache artifacts to be isolated per target language.
- Updated prompts and documentation to include the selected target language.

## 0.0.4

- Added localized right-click menu entry for LLM Translate.
- Improved translation and refresh command icons and refreshed the extension app icon.
- Added bilingual README updates including local deployment quick start and feedback contact information.
- Improved code comment translation flow to keep translated content in valid comment syntax.

## 0.0.1

- Initial scaffold for workspace-aware LLM translation.
