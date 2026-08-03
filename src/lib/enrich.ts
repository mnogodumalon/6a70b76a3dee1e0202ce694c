import type { EnrichedAusleiheRueckgabe, EnrichedWartungPruefung } from '@/types/enriched';
import type { AusleiheRueckgabe, Mitarbeiterverwaltung, WartungPruefung, Werkzeugverwaltung } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface AusleiheRueckgabeMaps {
  werkzeugverwaltungMap: Map<string, Werkzeugverwaltung>;
  mitarbeiterverwaltungMap: Map<string, Mitarbeiterverwaltung>;
}

export function enrichAusleiheRueckgabe(
  ausleiheRueckgabe: AusleiheRueckgabe[],
  maps: AusleiheRueckgabeMaps
): EnrichedAusleiheRueckgabe[] {
  return ausleiheRueckgabe.map(r => ({
    ...r,
    werkzeugName: resolveDisplay(r.fields.werkzeug, maps.werkzeugverwaltungMap, 'bezeichnung'),
    mitarbeiterName: resolveDisplay(r.fields.mitarbeiter, maps.mitarbeiterverwaltungMap, 'vorname', 'nachname'),
  }));
}

interface WartungPruefungMaps {
  werkzeugverwaltungMap: Map<string, Werkzeugverwaltung>;
}

export function enrichWartungPruefung(
  wartungPruefung: WartungPruefung[],
  maps: WartungPruefungMaps
): EnrichedWartungPruefung[] {
  return wartungPruefung.map(r => ({
    ...r,
    werkzeug_wartungName: resolveDisplay(r.fields.werkzeug_wartung, maps.werkzeugverwaltungMap, 'bezeichnung'),
  }));
}
