import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { LivingAppsService, extractRecordId } from '@/services/livingAppsService';
import type { WartungPruefung, Werkzeugverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { Button } from '@/components/ui/button';
import { IconArrowLeft, IconTrash } from '@tabler/icons-react';
import {
  RecordView, RecordHeader, RecordKeyFacts, RecordSection, RecordField,
  RecordAttachments, RecordViewSkeleton, RecordViewEmpty,
} from '@/components/widgets/RecordView';
import { WartungPruefungDialog } from '@/components/dialogs/WartungPruefungDialog';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { formEnhancements } from '@/config/form-enhancements/WartungPruefung';
import { evalComputed } from '@/config/form-enhancements/types';

export default function WartungPruefungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [record, setRecord] = useState<WartungPruefung | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [werkzeugverwaltungList, setWerkzeugverwaltungList] = useState<Werkzeugverwaltung[]>([]);

  useEffect(() => { loadData(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function loadData() {
    setLoading(true);
    try {
      const [mainData, werkzeugverwaltungData] = await Promise.all([
        LivingAppsService.getWartungPruefung(),
        LivingAppsService.getWerkzeugverwaltung(),
      ]);
      setWerkzeugverwaltungList(werkzeugverwaltungData);
      setRecord(mainData.find(r => r.record_id === id) ?? null);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpdate(fields: WartungPruefung['fields']) {
    if (!record) return;
    await LivingAppsService.updateWartungPruefungEntry(record.record_id, fields);
    await loadData();
    setEditing(false);
  }

  async function handleDelete() {
    if (!record) return;
    await LivingAppsService.deleteWartungPruefungEntry(record.record_id);
    setDeleteOpen(false);
    navigate('/wartung-pruefung');
  }

  function getWerkzeugverwaltungDisplayName(url?: unknown) {
    if (!url) return '—';
    const refId = extractRecordId(url);
    return werkzeugverwaltungList.find(r => r.record_id === refId)?.fields.bezeichnung ?? '—';
  }

  if (loading) {
    return <RecordViewSkeleton />;
  }

  if (!record) {
    return (
      <RecordViewEmpty
        title="Eintrag nicht gefunden"
        action={
          <Button variant="ghost" onClick={() => navigate('/wartung-pruefung')}>
            <IconArrowLeft className="h-4 w-4 mr-1.5" />
            Zurück
          </Button>
        }
      />
    );
  }

  return (
    <RecordView
      onBack={() => navigate('/wartung-pruefung')}
      onEdit={() => setEditing(true)}
      backLabel="Zurück"
      editLabel="Bearbeiten"
    >
      <RecordHeader title={record.fields.durchgefuehrt_von ?? 'Wartung & Prüfung'} />

      {(() => {
        const lookupLists: Record<string, unknown> = {
          werkzeug_wartung: werkzeugverwaltungList,
        };
        const fmtComputed = (k: string, n: number) =>
          /(?:kosten|preis|betrag|gesamt|netto|brutto|summe|mwst|rabatt|anzahlung|umsatz|saldo)/i.test(k)
            ? n.toLocaleString('de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : n.toLocaleString('de-DE', { maximumFractionDigits: 2 });
        const computedFacts = Object.entries(formEnhancements.computed)
          .map(([key, formula]) => {
            const v = evalComputed(formula, record!.fields as Record<string, unknown>, { lookupLists });
            return v != null
              ? { label: key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' '), value: fmtComputed(key, v) }
              : null;
          })
          .filter((f): f is { label: string; value: string } => f !== null);
        return computedFacts.length > 0 ? <RecordKeyFacts items={computedFacts} /> : null;
      })()}

      <RecordSection title="Details" cols={2}>
        <RecordField label="Werkzeug" value={getWerkzeugverwaltungDisplayName(record.fields.werkzeug_wartung)} format="text" />
        <RecordField label="Datum der Maßnahme" value={record.fields.datum_wartung} format="date" />
        <RecordField label="Art der Maßnahme" value={record.fields.art_massnahme} format="pill" />
        <RecordField label="Durchgeführt von" value={record.fields.durchgefuehrt_von} format="text" />
        <RecordField label="Ergebnis" value={record.fields.ergebnis} format="pill" />
        <RecordField label="Nächstes Prüfdatum" value={record.fields.naechste_pruefung_wartung} format="date" />
        <RecordField label="Kosten (€)" value={record.fields.kosten} format="text" />
        <RecordField label="Bemerkungen" value={record.fields.bemerkung_wartung} format="longtext" className="md:col-span-2" />
      </RecordSection>

      <RecordAttachments appId={APP_IDS.WARTUNG_PRUEFUNG} recordId={record.record_id} />

      <div className="flex justify-end pt-2">
        <Button variant="ghost" onClick={() => setDeleteOpen(true)} className="text-destructive hover:text-destructive">
          <IconTrash className="h-4 w-4 mr-1.5" />
          Löschen
        </Button>
      </div>

      <WartungPruefungDialog
        open={editing}
        onClose={() => setEditing(false)}
        onSubmit={handleUpdate}
        defaultValues={record.fields}
        recordId={record.record_id}
        werkzeugverwaltungList={werkzeugverwaltungList}
        enablePhotoScan={AI_PHOTO_SCAN['WartungPruefung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['WartungPruefung']}
      />

      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Wartung & Prüfung löschen"
        description="Soll dieser Eintrag wirklich gelöscht werden? Diese Aktion kann nicht rückgängig gemacht werden."
      />
    </RecordView>
  );
}
