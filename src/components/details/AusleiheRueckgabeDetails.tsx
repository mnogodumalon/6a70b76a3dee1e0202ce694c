import type { AusleiheRueckgabe, Werkzeugverwaltung, Mitarbeiterverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';

export interface AusleiheRueckgabeDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: AusleiheRueckgabe;
  /** N:1-Ziel „Werkzeugverwaltung": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  werkzeugverwaltungList: Werkzeugverwaltung[];
  /** Klick auf die Werkzeugverwaltung-Relation → overlay.push auf dessen Detail. */
  onOpenWerkzeugverwaltung?: (record: Werkzeugverwaltung) => void;
  /** N:1-Ziel „Mitarbeiterverwaltung": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  mitarbeiterverwaltungList: Mitarbeiterverwaltung[];
  /** Klick auf die Mitarbeiterverwaltung-Relation → overlay.push auf dessen Detail. */
  onOpenMitarbeiterverwaltung?: (record: Mitarbeiterverwaltung) => void;
}

export function AusleiheRueckgabeDetails({
  record,
  werkzeugverwaltungList,
  onOpenWerkzeugverwaltung,
  mitarbeiterverwaltungList,
  onOpenMitarbeiterverwaltung,
}: AusleiheRueckgabeDetailsProps) {
  const werkzeugTarget = werkzeugverwaltungList.find(r => r.record_id === extractRecordId(record.fields.werkzeug));
  const mitarbeiterTarget = mitarbeiterverwaltungList.find(r => r.record_id === extractRecordId(record.fields.mitarbeiter));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Ausleihdatum" value={record.fields.ausleihdatum} format="datetime" />
        <RecordField label="Geplantes Rückgabedatum" value={record.fields.geplante_rueckgabe} format="date" />
        <RecordField label="Tatsächliches Rückgabedatum" value={record.fields.tatsaechliche_rueckgabe} format="date" />
        <RecordField label="Status" value={record.fields.status} format="pill" />
        <RecordField label="Einsatzort / Baustelle" value={record.fields.einsatzort} format="text" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkung_ausleihe} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={2}>
        <RecordRelation
          label="Werkzeug"
          name={werkzeugTarget?.fields.bezeichnung ?? '—'}
          meta={[werkzeugTarget?.fields.werkzeugnummer, werkzeugTarget?.fields.hersteller].filter(Boolean).join(' · ') || undefined}
          onClick={werkzeugTarget && onOpenWerkzeugverwaltung ? () => onOpenWerkzeugverwaltung!(werkzeugTarget!) : undefined}
        />
        <RecordRelation
          label="Mitarbeiter"
          name={mitarbeiterTarget?.fields.vorname ?? '—'}
          meta={[mitarbeiterTarget?.fields.telefon, mitarbeiterTarget?.fields.handy].filter(Boolean).join(' · ') || undefined}
          onClick={mitarbeiterTarget && onOpenMitarbeiterverwaltung ? () => onOpenMitarbeiterverwaltung!(mitarbeiterTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.AUSLEIHE_RUECKGABE} recordId={record.record_id} />
    </>
  );
}
