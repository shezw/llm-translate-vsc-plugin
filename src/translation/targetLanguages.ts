export type TargetLanguage = 'zh-CN' | 'en' | 'de' | 'fr' | 'ja' | 'ko';

export interface TargetLanguageDefinition {
  id: TargetLanguage;
  label: string;
  englishName: string;
  nativeName: string;
}

export const TARGET_LANGUAGES: TargetLanguageDefinition[] = [
  { id: 'zh-CN', label: 'Chinese', englishName: 'Simplified Chinese', nativeName: '简体中文' },
  { id: 'en', label: 'English', englishName: 'English', nativeName: 'English' },
  { id: 'de', label: 'German', englishName: 'German', nativeName: 'Deutsch' },
  { id: 'fr', label: 'French', englishName: 'French', nativeName: 'Français' },
  { id: 'ja', label: 'Japanese', englishName: 'Japanese', nativeName: '日本語' },
  { id: 'ko', label: 'Korean', englishName: 'Korean', nativeName: '한국어' }
];

const TARGET_LANGUAGE_MAP = new Map<TargetLanguage, TargetLanguageDefinition>(
  TARGET_LANGUAGES.map(language => [language.id, language])
);

export function getTargetLanguage(language: TargetLanguage): TargetLanguageDefinition {
  return TARGET_LANGUAGE_MAP.get(language) ?? TARGET_LANGUAGE_MAP.get('zh-CN')!;
}

export function formatTargetLanguage(language: TargetLanguage): string {
  const definition = getTargetLanguage(language);
  return `${definition.englishName} (${definition.nativeName})`;
}