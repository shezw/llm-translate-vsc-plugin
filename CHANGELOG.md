# Change Log

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
