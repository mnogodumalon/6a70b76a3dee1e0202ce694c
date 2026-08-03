// Auto-generated. Per-entity form-enhancements config for "Wartung & Prüfung".
// The sandbox sub-agent (Step 0) may overwrite this file with a richer config.
// Schema: see ./types.ts.

import type { FormEnhancements } from './types';

export const formEnhancements: FormEnhancements = {
  fieldOrder: [
    'werkzeug_wartung',
    'datum_wartung',
    'art_massnahme',
    'ergebnis',
    'durchgefuehrt_von',
    'naechste_pruefung_wartung',
    'kosten',
    'bemerkung_wartung',
  ],
  defaults: {
    'datum_wartung': { kind: 'today' },
    'art_massnahme': { kind: 'lookup', key: 'routinewartung', label: 'Routinewartung' },
    'ergebnis': { kind: 'lookup', key: 'in_bearbeitung', label: 'In Bearbeitung' },
    'naechste_pruefung_wartung': { kind: 'todayOffset', days: 30 },
  },
  computed: {
    '_wartung_dauer_tage': { kind: 'dateDiff', from: 'datum_wartung', to: 'naechste_pruefung_wartung', unit: 'days' },
  },
};

// Build-time-populated field dependencies for MODUS-2 arrow functions in
// `computed`. The sub-agent leaves this empty; scripts/parse-formulas.mjs
// fills it after Step 0 by regex-extracting ctx.* calls from each function
// body. The dialog feeds these into classifyComputed so MODUS-2 entries get
// inline anchors instead of always landing in the aggregate section.
export const computedDeps: Record<string, string[]> = {};

// Build-time-populated applookup (ownKey → lookupKey) pairs found in MODUS-2
// arrow functions. Filled by scripts/parse-formulas.mjs from regex matches
// on `ctx.applookup('x','y')` and `ctx.applookupAny('x','y')`. The dialog
// merges this with MODUS-1 refs extracted at render time, so every numeric
// field the formula pulls from a selected lookup is surfaced as an inline
// hint next to the lookup combobox.
export const computedApplookupRefs: Record<string, {lookupKey: string}[]> = {};
