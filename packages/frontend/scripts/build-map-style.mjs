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
// Keep the city overview focused on through-roads. Detail returns at street zoom.
const detailZooms = {
  highway_minor: 14,
  highway_path: 16,
  'highway-name-path': 16,
  road_area_pier: 14,
  road_pier: 14,
  railway: 14,
  railway_dashline: 14,
  label_other: 13,
};
for (const layer of style.layers) {
  if (layer['source-layer'] === 'building') {
    layer.layout = { ...layer.layout, visibility: 'none' };
  }
  if (detailZooms[layer.id] !== undefined) {
    layer.minzoom = Math.max(layer.minzoom ?? 0, detailZooms[layer.id]);
  }
  if (layer.layout?.['text-field']) layer.layout['text-field'] = hideHebrew(layer.layout['text-field']);
}
style.metadata['openroad:language-policy'] = 'Labels containing Hebrew use English or Latin fallback when available; otherwise hidden. Other labels are unchanged.';
await writeFile(new URL('../public/map-style.json', import.meta.url), JSON.stringify(style) + '\n');

// A local night palette uses the same sources, geometry and label policy.
const night = structuredClone(style);
night.name = 'OpenRoad night';
function nightColor(layer, key) {
  const id = layer.id;
  if (key === 'text-halo-color') return '#151c25';
  if (key === 'text-color') return id.startsWith('label_country') ? '#e2e9ef' : '#aebcc9';
  if (key === 'background-color') return '#111820';
  if (id.includes('water')) return '#102b3b';
  if (id.includes('park') || id.includes('wood')) return '#19322c';
  if (id.includes('ice') || id.includes('glacier')) return '#344852';
  if (id.includes('building')) return key.includes('outline') ? '#34404d' : '#29333f';
  if (id.includes('landcover') || id.includes('landuse')) return '#1c272d';
  if (id.includes('casing')) return '#111820';
  if (id.includes('motorway') || id.includes('trunk')) return '#728398';
  if (id.includes('primary') || id.includes('secondary')) return '#586b7d';
  if (id.includes('boundary')) return '#647787';
  if (id.includes('railway')) return '#526170';
  return '#3c4d5b';
}
for (const layer of night.layers) {
  for (const key of Object.keys(layer.paint ?? {})) {
    if (key.endsWith('-color')) layer.paint[key] = nightColor(layer, key);
  }
}
await writeFile(new URL('../public/map-style-night.json', import.meta.url), JSON.stringify(night) + '\n');
