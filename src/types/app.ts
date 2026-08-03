// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export type AttachmentType = 'file' | 'note' | 'url' | 'json';
export interface Attachment {
  id: string;
  type: AttachmentType;
  label: string | null;
  value: string | null;
  active: boolean;
  createdat?: string | null;
  updatedat?: string | null;
}

export interface AttachmentInput {
  type: AttachmentType;
  label?: string;
  value: string;
  active?: boolean;
}

export interface Mitarbeiterverwaltung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    vorname?: string;
    nachname?: string;
    geburtsdatum?: string; // Format: YYYY-MM-DD oder ISO String
    personalnummer?: string;
    abteilung?: LookupValue;
    telefon?: string;
    handy?: string;
    email?: string;
  };
}

export interface Werkzeugverwaltung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    bezeichnung?: string;
    werkzeugnummer?: string;
    kategorie?: LookupValue;
    hersteller?: string;
    modell?: string;
    kaufdatum?: string; // Format: YYYY-MM-DD oder ISO String
    lagerort?: string;
    zustand?: LookupValue;
    pruefintervall_monate?: number;
    naechste_pruefung?: string; // Format: YYYY-MM-DD oder ISO String
    bild?: string;
    bemerkung_werkzeug?: string;
  };
}

export interface AusleiheRueckgabe {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    werkzeug?: string; // applookup -> URL zu 'Werkzeugverwaltung' Record
    ausleihdatum?: string; // Format: YYYY-MM-DD oder ISO String
    geplante_rueckgabe?: string; // Format: YYYY-MM-DD oder ISO String
    tatsaechliche_rueckgabe?: string; // Format: YYYY-MM-DD oder ISO String
    status?: LookupValue;
    einsatzort?: string;
    mitarbeiter?: string; // applookup -> URL zu 'Mitarbeiterverwaltung' Record
    bemerkung_ausleihe?: string;
  };
}

export interface WartungPruefung {
  record_id: string;
  /** The API field. */
  created_at: string;
  updated_at: string | null;
  /** Alias of created_at, filled by the read helpers. The API sends
   *  snake_case only — reading `createdat` off a raw record yields
   *  undefined, which type-checks and then crashes at runtime. */
  createdat: string;
  updatedat: string | null;
  fields: {
    werkzeug_wartung?: string; // applookup -> URL zu 'Werkzeugverwaltung' Record
    datum_wartung?: string; // Format: YYYY-MM-DD oder ISO String
    art_massnahme?: LookupValue;
    durchgefuehrt_von?: string;
    ergebnis?: LookupValue;
    naechste_pruefung_wartung?: string; // Format: YYYY-MM-DD oder ISO String
    kosten?: number;
    dokument?: string;
    bemerkung_wartung?: string;
  };
}

export const APP_IDS = {
  MITARBEITERVERWALTUNG: '6a70b73f33c382c6d3f0f818',
  WERKZEUGVERWALTUNG: '6a70b7450a89d4b38b6e7894',
  AUSLEIHE_RUECKGABE: '6a70b74612b6c30ddebbc38c',
  WARTUNG_PRUEFUNG: '6a70b747a75d37c62ce1a8ab',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'mitarbeiterverwaltung': {
    abteilung: [{ key: "installation", label: "Installation" }, { key: "wartung", label: "Wartung" }, { key: "lager", label: "Lager" }, { key: "montage", label: "Montage" }, { key: "buero", label: "Büro" }, { key: "sonstiges", label: "Sonstiges" }],
  },
  'werkzeugverwaltung': {
    kategorie: [{ key: "handwerkzeug", label: "Handwerkzeug" }, { key: "elektrowerkzeug", label: "Elektrowerkzeug" }, { key: "messgeraet", label: "Messgerät" }, { key: "pruefgeraet", label: "Prüfgerät" }, { key: "schutzausruestung", label: "Schutzausrüstung" }, { key: "sonstiges", label: "Sonstiges" }],
    zustand: [{ key: "neuwertig", label: "Neuwertig" }, { key: "gut", label: "Gut" }, { key: "gebraucht", label: "Gebraucht" }, { key: "reparaturbeduerftigt", label: "Reparaturbedürftig" }, { key: "ausser_betrieb", label: "Außer Betrieb" }],
  },
  'ausleihe_rueckgabe': {
    status: [{ key: "ausgeliehen", label: "Ausgeliehen" }, { key: "zurueckgegeben", label: "Zurückgegeben" }, { key: "verloren", label: "Verloren" }],
  },
  'wartung_pruefung': {
    art_massnahme: [{ key: "routinewartung", label: "Routinewartung" }, { key: "reparatur", label: "Reparatur" }, { key: "sicherheitspruefung", label: "Sicherheitsprüfung (DGUV)" }, { key: "kalibrierung", label: "Kalibrierung" }, { key: "reinigung", label: "Reinigung" }, { key: "sonstiges_wartung", label: "Sonstiges" }],
    ergebnis: [{ key: "bestanden", label: "Bestanden" }, { key: "nicht_bestanden", label: "Nicht bestanden" }, { key: "bedingt_bestanden", label: "Bedingt bestanden" }, { key: "in_bearbeitung", label: "In Bearbeitung" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'mitarbeiterverwaltung': {
    'vorname': 'string/text',
    'nachname': 'string/text',
    'geburtsdatum': 'date/date',
    'personalnummer': 'string/text',
    'abteilung': 'lookup/select',
    'telefon': 'string/tel',
    'handy': 'string/tel',
    'email': 'string/email',
  },
  'werkzeugverwaltung': {
    'bezeichnung': 'string/text',
    'werkzeugnummer': 'string/text',
    'kategorie': 'lookup/select',
    'hersteller': 'string/text',
    'modell': 'string/text',
    'kaufdatum': 'date/date',
    'lagerort': 'string/text',
    'zustand': 'lookup/select',
    'pruefintervall_monate': 'number',
    'naechste_pruefung': 'date/date',
    'bild': 'file',
    'bemerkung_werkzeug': 'string/textarea',
  },
  'ausleihe_rueckgabe': {
    'werkzeug': 'applookup/select',
    'ausleihdatum': 'date/datetimeminute',
    'geplante_rueckgabe': 'date/date',
    'tatsaechliche_rueckgabe': 'date/date',
    'status': 'lookup/radio',
    'einsatzort': 'string/text',
    'mitarbeiter': 'applookup/select',
    'bemerkung_ausleihe': 'string/textarea',
  },
  'wartung_pruefung': {
    'werkzeug_wartung': 'applookup/select',
    'datum_wartung': 'date/date',
    'art_massnahme': 'lookup/select',
    'durchgefuehrt_von': 'string/text',
    'ergebnis': 'lookup/radio',
    'naechste_pruefung_wartung': 'date/date',
    'kosten': 'number',
    'dokument': 'file',
    'bemerkung_wartung': 'string/textarea',
  },
};

export const HUB_TOPOLOGY: Record<string, { field: string; entity: string }[]> = {
};

// Aliases for the pre-0.0.279 app keys (see 4c).
LOOKUP_OPTIONS['ausleihe_&_rueckgabe'] = LOOKUP_OPTIONS['ausleihe_rueckgabe'];
FIELD_TYPES['ausleihe_&_rueckgabe'] = FIELD_TYPES['ausleihe_rueckgabe'];
LOOKUP_OPTIONS['wartung_&_pruefung'] = LOOKUP_OPTIONS['wartung_pruefung'];
FIELD_TYPES['wartung_&_pruefung'] = FIELD_TYPES['wartung_pruefung'];

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateMitarbeiterverwaltung = StripLookup<Mitarbeiterverwaltung['fields']>;
export type CreateWerkzeugverwaltung = StripLookup<Werkzeugverwaltung['fields']>;
export type CreateAusleiheRueckgabe = StripLookup<AusleiheRueckgabe['fields']>;
export type CreateWartungPruefung = StripLookup<WartungPruefung['fields']>;