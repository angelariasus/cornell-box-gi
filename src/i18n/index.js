/**
 * Interface language (English / Spanish).
 *
 * - `locale`: the active language. It starts from the saved choice or, the first time, from
 *   the browser language (Spanish if it starts with "es", English otherwise).
 * - `t`: a store holding the translate function for the active language, used in components
 *   as `$t('key', { name: value })`. Keys are dot paths into the dictionaries; `{name}`
 *   placeholders are filled from the second argument. A missing key falls back to English,
 *   then to the key itself.
 * - `fmt`: number formatting for the active language (Spanish uses a decimal comma, as in the
 *   report).
 */

import { derived, writable } from 'svelte/store';
import en from './en.js';
import es from './es.js';

export const DICTIONARIES = Object.freeze({ en, es });
export const LANGUAGES = Object.freeze(['en', 'es']);
const STORAGE_KEY = 'gi-viewer-language';
const NUMBER_LOCALES = { en: 'en-US', es: 'es' };

function initialLocale() {
  try {
    const saved = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (LANGUAGES.includes(saved)) return saved;
  } catch {
    // Storage can be unavailable (private mode, tests).
  }
  const browser = globalThis.navigator?.language ?? 'en';
  return browser.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export const locale = writable(initialLocale());

locale.subscribe((language) => {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, language);
  } catch {
    // Not saved; the choice still applies to this visit.
  }
  if (globalThis.document) {
    document.documentElement.lang = language;
    document.title = translate(language, 'app.documentTitle');
  }
});

function lookup(dictionary, key) {
  let node = dictionary;
  for (const part of key.split('.')) {
    if (node == null || typeof node !== 'object') return undefined;
    node = node[part];
  }
  return typeof node === 'string' ? node : undefined;
}

/** Text for `key` in `language`, with `{name}` placeholders filled from `vars`. */
export function translate(language, key, vars = {}) {
  const text = lookup(DICTIONARIES[language], key) ?? lookup(en, key) ?? key;
  return text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match));
}

export const t = derived(locale, (language) => (key, vars) => translate(language, key, vars));

/** Formats a number with a fixed number of decimals (or none) for the active language. */
export const fmt = derived(
  locale,
  (language) =>
    (value, digits = 0) =>
      new Intl.NumberFormat(NUMBER_LOCALES[language], {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits,
      }).format(value),
);

/**
 * Translated name of a scene surface from its label in cornell.js ("back wall", "tall block
 * side 3"…). A trailing number is kept as is.
 */
export function surfaceName(translateFn, label) {
  const [, base, number = ''] = label.match(/^(.*?)( \d+)?$/);
  const name = translateFn(`surfaces.${base}`);
  return name === `surfaces.${base}` ? label : `${name}${number}`;
}
