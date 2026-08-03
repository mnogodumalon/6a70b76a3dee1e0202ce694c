import type { AusleiheRueckgabe, WartungPruefung } from './app';

export type EnrichedAusleiheRueckgabe = AusleiheRueckgabe & {
  werkzeugName: string;
  mitarbeiterName: string;
};

export type EnrichedWartungPruefung = WartungPruefung & {
  werkzeug_wartungName: string;
};
