import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { DICTIONARIES, LANGUAGES, surfaceName, translate } from '../src/i18n/index.js';
import { METHODS, SCENES } from '../src/state/params.js';
import { createClassicScene, createSpheresScene } from '../src/scene/cornell.js';

/** Flattens a nested dictionary into { 'a.b.c': text }. */
function flatten(node, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out[path] = value;
    else flatten(value, path, out);
  }
  return out;
}

const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
const flat = Object.fromEntries(LANGUAGES.map((l) => [l, flatten(DICTIONARIES[l])]));

// Texts that are empty on purpose: the debug view has nothing to try.
const EMPTY_ON_PURPOSE = new Set(['info.debug.tipClassic', 'info.debug.tipSpheres']);

function sourceFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(svelte|js)$/.test(entry.name) ? [path] : [];
  });
}

describe('language dictionaries', () => {
  it('English and Spanish have exactly the same keys', () => {
    expect(Object.keys(flat.es).sort()).toEqual(Object.keys(flat.en).sort());
  });

  it('every text has the same {placeholders} in both languages', () => {
    for (const key of Object.keys(flat.en)) {
      expect(placeholders(flat.es[key]), key).toEqual(placeholders(flat.en[key]));
    }
  });

  it('no text is empty, except where nothing is shown on purpose', () => {
    for (const language of LANGUAGES) {
      for (const [key, text] of Object.entries(flat[language])) {
        if (EMPTY_ON_PURPOSE.has(key)) expect(text, `${language} ${key}`).toBe('');
        else expect(text.trim().length, `${language} ${key}`).toBeGreaterThan(0);
      }
    }
  });

  it('every literal key used in the source exists', () => {
    const used = new Set();
    // src/i18n only defines the keys (its doc comment shows a made-up one).
    for (const file of sourceFiles('src').filter((f) => !/[\\/]i18n[\\/]/.test(f))) {
      const code = readFileSync(file, 'utf8');
      for (const m of code.matchAll(/\$t\(\s*'([\w.]+)'/g)) used.add(m[1]);
      for (const m of code.matchAll(/translate\(\s*\w+,\s*'([\w.]+)'/g)) used.add(m[1]);
    }
    expect(used.size).toBeGreaterThan(80);
    for (const key of used) expect(flat.en, key).toHaveProperty([key]);
  });

  it('every key built from an id exists (methods, scenes, info, inspector)', () => {
    const keys = [];
    for (const { id } of [...METHODS, { id: 'debug' }]) {
      keys.push(`methods.${id}.name`, `methods.${id}.detail`, `methods.${id}.short`);
      for (const part of ['title', 'text', 'source', 'tipClassic', 'tipSpheres'])
        keys.push(`info.${id}.${part}`);
    }
    for (const m of METHODS.filter((m) => m.hasSpheresDetail))
      keys.push(`methods.${m.id}.detailSpheres`);
    for (const { id } of SCENES) keys.push(`scenes.${id}.name`, `scenes.${id}.detail`);
    for (const kind of ['primary', 'reflected', 'refracted']) keys.push(`inspector.${kind}`);
    for (const solver of ['gaussSeidel', 'jacobi', 'progressive'])
      keys.push(`radiosity.solvers.${solver}`);
    for (const key of keys) expect(flat.en, key).toHaveProperty([key]);
  });

  it('every surface of both scenes has a name, keeping block side numbers', () => {
    const labels = [createClassicScene(), createSpheresScene()].flatMap((scene) => [
      ...scene.quads.map((q) => q.label),
      ...scene.spheres.map((s) => s.label),
    ]);
    const es = (key) => translate('es', key);
    for (const label of labels) {
      const base = label.replace(/ \d+$/, '');
      expect(flat.en, label).toHaveProperty([`surfaces.${base}`]);
    }
    expect(surfaceName(es, 'tall block side 3')).toBe('lado del bloque alto 3');
    expect(surfaceName(es, 'back wall')).toBe('pared del fondo');
    expect(surfaceName(es, 'unknown thing')).toBe('unknown thing');
  });
});

describe('translate', () => {
  it('fills placeholders and falls back to English, then to the key', () => {
    expect(translate('es', 'caustics.radiusValue', { n: 15 })).toBe('15 unidades');
    expect(translate('en', 'status.lowPrecision', { format: 'float16' })).toContain('float16');
    expect(translate('xx', 'toolbar.restart')).toBe('Restart');
    expect(translate('es', 'no.such.key')).toBe('no.such.key');
  });
});
