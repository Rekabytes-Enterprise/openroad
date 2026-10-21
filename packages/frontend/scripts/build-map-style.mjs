import { readFile, writeFile } from 'node:fs/promises';

// MapLibre has no regex expression. Check both Unicode Hebrew blocks,
// including vowel marks and presentation forms, before rendering a label.
const hebrewCharacters = [
  ...Array.from({ length: 0x0600 - 0x0590 }, (_, i) => String.fromCodePoint(0x0590 + i)),
  ...Array.from({ length: 0xfb50 - 0xfb1d }, (_, i) => String.fromCodePoint(0xfb1d + i)),
];
const containsHebrew = name => ['any', ...hebrewCharacters.map(character =>
  ['>=', ['index-of', character, ['var', name]], 0])];

export function hideHebrew(expression) {
  return ['let', 'label', ['to-string', expression],
    'fallback', ['to-string', ['coalesce', ['get', 'name:en'], ['get', 'name_en'], ['get', 'name:latin'], '']],
    ['case', containsHebrew('label'),
      ['case', containsHebrew('fallback'), '', ['var', 'fallback']], ['var', 'label']]];
}

const style = JSON.parse(await readFile(new URL('./styles/positron.json', import.meta.url), 'utf8'));
for (const layer of style.layers) {
  if (layer.layout?.['text-field']) layer.layout['text-field'] = hideHebrew(layer.layout['text-field']);
}
style.metadata['openroad:language-policy'] = 'Labels containing Hebrew use English or Latin fallback when available; otherwise hidden. Other labels are unchanged.';
await writeFile(new URL('../public/map-style.json', import.meta.url), JSON.stringify(style) + '\n');
