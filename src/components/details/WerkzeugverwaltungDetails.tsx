import type { Werkzeugverwaltung, AusleiheRueckgabe, WartungPruefung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  RecordSection, RecordField, RecordRelation, RecordAttachments,
} from '@/components/widgets/RecordView';
import { MediaThumbnail } from '@/components/widgets/MediaViewer';
import { SatelliteSection } from '@/components/SatelliteSection';

export interface WerkzeugverwaltungDetailsProps {
  /** Der Record — enriched oder roh; alle Felder werden hier gerendert. */
  record: Werkzeugverwaltung;
  /** 1:N „Ausleihe & Rückgabe": VOLLE Liste — der Block filtert auf diesen Record. */
  ausleiheRueckgabeList: AusleiheRueckgabe[];
  /** Zeilen-Klick → overlay.push auf das AusleiheRueckgabe-Detail (nie der Edit-Dialog). */
  onOpenAusleiheRueckgabe: (record: AusleiheRueckgabe) => void;
  /** Kontextuelles „+": öffnet den AusleiheRueckgabe-Dialog mit diesem Record vorgesetzt. */
  onAddAusleiheRueckgabe: () => void;
  /** 1:N „Wartung & Prüfung": VOLLE Liste — der Block filtert auf diesen Record. */
  wartungPruefungList: WartungPruefung[];
  /** Zeilen-Klick → overlay.push auf das WartungPruefung-Detail (nie der Edit-Dialog). */
  onOpenWartungPruefung: (record: WartungPruefung) => void;
  /** Kontextuelles „+": öffnet den WartungPruefung-Dialog mit diesem Record vorgesetzt. */
  onAddWartungPruefung: () => void;
}

export function WerkzeugverwaltungDetails({
  record,
  ausleiheRueckgabeList,
  onOpenAusleiheRueckgabe,
  onAddAusleiheRueckgabe,
  wartungPruefungList,
  onOpenWartungPruefung,
  onAddWartungPruefung,
}: WerkzeugverwaltungDetailsProps) {
  return (
    <>
      <RecordSection title="Details" cols={2}>
        <RecordField label="Bezeichnung" value={record.fields.bezeichnung} format="text" />
        <RecordField label="Werkzeug- / Inventarnummer" value={record.fields.werkzeugnummer} format="text" />
        <RecordField label="Kategorie" value={record.fields.kategorie} format="pill" />
        <RecordField label="Hersteller" value={record.fields.hersteller} format="text" />
        <RecordField label="Modell / Typenbezeichnung" value={record.fields.modell} format="text" />
        <RecordField label="Kaufdatum" value={record.fields.kaufdatum} format="date" />
        <RecordField label="Standort / Lagerort" value={record.fields.lagerort} format="text" />
        <RecordField label="Zustand" value={record.fields.zustand} format="pill" />
        <RecordField label="Prüfintervall (Monate)" value={record.fields.pruefintervall_monate} format="text" />
        <RecordField label="Nächstes Prüfdatum" value={record.fields.naechste_pruefung} format="date" />
        <RecordField label="Foto des Werkzeugs" className="md:col-span-2">
          {record.fields.bild ? (
            <MediaThumbnail src={record.fields.bild as string} fit="contain" className="max-h-64 w-full rounded-lg" />
          ) : '—'}
        </RecordField>
        <RecordField label="Bemerkungen" value={record.fields.bemerkung_werkzeug} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <SatelliteSection
        title="Ausleihe & Rückgabe"
        items={ausleiheRueckgabeList.filter(r => extractRecordId(r.fields.werkzeug) === record.record_id)}
        map={r => ({ name: r.fields.einsatzort ?? 'Ausleihe & Rückgabe', meta: r.fields.ausleihdatum })}
        onOpen={onOpenAusleiheRueckgabe}
        onAdd={onAddAusleiheRueckgabe}
        getKey={r => r.record_id}
      />

      <SatelliteSection
        title="Wartung & Prüfung"
        items={wartungPruefungList.filter(r => extractRecordId(r.fields.werkzeug_wartung) === record.record_id)}
        map={r => ({ name: r.fields.durchgefuehrt_von ?? 'Wartung & Prüfung', meta: r.fields.datum_wartung })}
        onOpen={onOpenWartungPruefung}
        onAdd={onAddWartungPruefung}
        getKey={r => r.record_id}
      />

      <RecordAttachments appId={APP_IDS.WERKZEUGVERWALTUNG} recordId={record.record_id} />
    </>
  );
}
