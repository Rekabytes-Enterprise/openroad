import { describe, expect, it } from 'vitest';
import { createExpression, validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import style from '../public/map-style.json';

describe('country label style', () => {
  it('is a valid MapLibre style', () => {
    expect(validateStyleMin(style)).toEqual([]);
  });

  it('replaces IL in every country layer while retaining other country names', () => {
    const layers = style.layers.filter(layer => layer.id.startsWith('label_country_'));
    expect(layers).toHaveLength(3);
    for (const layer of layers) {
      const result = createExpression(layer.layout?.['text-field']);
      if (result.result !== 'success') throw new Error(JSON.stringify(result.value));
      expect(result.value.evaluate({ zoom: 5 }, { type: 'Point', properties: { iso_a2: 'IL', name_en: 'Israel', 'name:nonlatin': 'ישראל' } })).toBe('Palestine');
      expect(result.value.evaluate({ zoom: 5 }, { type: 'Point', properties: { iso_a2: 'PS', name_en: 'Palestine' } })).toBe('Palestine');
      expect(result.value.evaluate({ zoom: 5 }, { type: 'Point', properties: { iso_a2: 'MY', name_en: 'Malaysia' } })).toBe('Malaysia');
    }
  });
});

describe('Hebrew label visibility', () => {
  const layers = style.layers.filter(layer => layer.layout?.['text-field']);
  function render(layer, properties) {
    const result = createExpression(layer.layout['text-field']);
    if (result.result !== 'success') throw new Error(JSON.stringify(result.value));
    return result.value.evaluate({ zoom: 5 }, { type: 'Point', properties });
  }
  it('hides Hebrew in every label layer, including road shields', () => {
    for (const layer of layers) {
      expect(render(layer, { name: 'ירושלים', ref: 'א', 'name:latin': 'Jerusalem', 'name:nonlatin': 'ירושלים', 'name:en': 'Jerusalem' })).toBe('Jerusalem');
      expect(render(layer, { name: 'ירושלים', ref: 'א' })).toBe('');
      expect(render(layer, { name: 'שׁ', ref: 'שׁ', 'name:en': 'שׁ' })).toBe('');
    }
  });
  it('preserves Arabic and Latin labels', () => {
    const city = layers.find(layer => layer.id === 'label_city');
    expect(render(city, { 'name:latin': 'Cairo', 'name:nonlatin': 'القاهرة' })).toBe('Cairo\nالقاهرة');
    expect(render(city, { name_en: 'Kuala Lumpur' })).toBe('Kuala Lumpur');
  });
});
