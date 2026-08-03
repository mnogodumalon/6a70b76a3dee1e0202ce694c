import type { WartungPruefung, Werkzeugverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';

export interface WartungPruefungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: WartungPruefung;
  /** N:1-Ziel „Werkzeugverwaltung": volle Liste (Hook-Array) — der Block löst Name + Schlüsselfelder selbst auf. */
  werkzeugverwaltungList: Werkzeugverwaltung[];
  /** Klick auf die Werkzeugverwaltung-Relation → overlay.push auf dessen Detail. */
  onOpenWerkzeugverwaltung?: (record: Werkzeugverwaltung) => void;
}

export function WartungPruefungDetails({
  record,
  werkzeugverwaltungList,
  onOpenWerkzeugverwaltung,
}: WartungPruefungDetailsProps) {
  const werkzeug_wartungTarget = werkzeugverwaltungList.find(r => r.record_id === extractRecordId(record.fields.werkzeug_wartung));
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Datum der Maßnahme" value={record.fields.datum_wartung} format="date" />
        <RecordField label="Art der Maßnahme" value={record.fields.art_massnahme} format="pill" />
        <RecordField label="Durchgeführt von" value={record.fields.durchgefuehrt_von} format="text" />
        <RecordField label="Ergebnis" value={record.fields.ergebnis} format="pill" />
        <RecordField label="Nächstes Prüfdatum" value={record.fields.naechste_pruefung_wartung} format="date" />
        <RecordField label="Kosten (€)" value={record.fields.kosten} format="text" />
        <RecordField label="Prüfprotokoll / Dokument" className="md:col-span-2">
          {record.fields.dokument ? (
            <MediaThumbnail src={record.fields.dokument as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label="Bemerkungen" value={record.fields.bemerkung_wartung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      {/* N:1 — verknüpfte Records: IMMER klickbar, nie eine Text-Sackgasse. */}
      <RecordSection title="Verknüpft" cols={1}>
        <RecordRelation
          label="Werkzeug"
          name={werkzeug_wartungTarget?.fields.bezeichnung ?? '—'}
          meta={[werkzeug_wartungTarget?.fields.werkzeugnummer, werkzeug_wartungTarget?.fields.hersteller].filter(Boolean).join(' · ') || undefined}
          onClick={werkzeug_wartungTarget && onOpenWerkzeugverwaltung ? () => onOpenWerkzeugverwaltung!(werkzeug_wartungTarget!) : undefined}
        />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.WARTUNG_PRUEFUNG} recordId={record.record_id} />
    </>
  );
}
