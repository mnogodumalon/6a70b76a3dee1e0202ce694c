import { useState, useMemo, useCallback } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAusleiheRueckgabe, enrichWartungPruefung } from '@/lib/enrich';
import type { EnrichedAusleiheRueckgabe, EnrichedWartungPruefung } from '@/types/enriched';
import type { Mitarbeiterverwaltung, Werkzeugverwaltung, AusleiheRueckgabe, WartungPruefung } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { formatDate, lookupKey } from '@/lib/formatters';
// Pre-generated loading/error surfaces (self-repair flow inside) — keep these
// imports and the two early-returns below; never re-implement them here.
import { DashboardSkeleton, DashboardError } from '@/components/DashboardStates';
import { DashboardGrid } from '@/components/DashboardGrid';
import { HeroBanner } from '@/components/HeroBanner';
import { WorkList } from '@/components/WorkList';
import { StatStrip, StatStripItem } from '@/components/StatCard';
import { KanbanWidget, type KanbanCard, type KanbanColumn, type KanbanTone } from '@/components/widgets/KanbanWidget';
import {
  RecordOverlayHost,
  RecordHeader,
  useRecordOverlayStack,
} from '@/components/widgets/RecordView';
import { AusleiheRueckgabeDialog, type AusleiheRueckgabeDialogDefaults } from '@/components/dialogs/AusleiheRueckgabeDialog';
import { WartungPruefungDialog, type WartungPruefungDialogDefaults } from '@/components/dialogs/WartungPruefungDialog';
import { WerkzeugverwaltungDialog, type WerkzeugverwaltungDialogDefaults } from '@/components/dialogs/WerkzeugverwaltungDialog';
import { MitarbeiterverwaltungDialog } from '@/components/dialogs/MitarbeiterverwaltungDialog';
import { AusleiheRueckgabeDetails } from '@/components/details/AusleiheRueckgabeDetails';
import { WerkzeugverwaltungDetails } from '@/components/details/WerkzeugverwaltungDetails';
import { WartungPruefungDetails } from '@/components/details/WartungPruefungDetails';
import { MitarbeiterverwaltungDetails } from '@/components/details/MitarbeiterverwaltungDetails';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { useClock, gruss, namen, undoToast } from '@/lib/polish';
import { format, isBefore, parseISO, isAfter, addDays } from 'date-fns';
import {
  IconPlus,
  IconTool,
  IconAlertTriangle,
  IconUsers,
  IconCalendarEvent,
  IconLayoutKanban,
} from '@tabler/icons-react';
import { ResourceTimeline, type ResourceEvent, type ResourceGroup, type ResourceTone } from '@/components/widgets/ResourceTimeline';
import { de } from 'date-fns/locale';

// ─── Kanban columns aus dem Schema ───────────────────────────────────────────
const AUSLEIHE_COLUMNS: KanbanColumn[] = (LOOKUP_OPTIONS['ausleihe_rueckgabe']?.['status'] ?? []).map(o => ({
  key: o.key,
  label: o.label,
}));

function toneForAusleiheStatus(status: string | undefined): KanbanTone {
  if (status === 'ausgeliehen') return 'primary';
  if (status === 'zurueckgegeben') return 'success';
  if (status === 'verloren') return 'destructive';
  return 'warning';
}

// ─── Overlay-Typen ────────────────────────────────────────────────────────────
type OverlayItem =
  | { type: 'ausleihe'; id: string }
  | { type: 'werkzeug'; id: string }
  | { type: 'wartung'; id: string }
  | { type: 'mitarbeiter'; id: string };

export default function DashboardOverview() {
  const clock = useClock();
  const {
    mitarbeiterverwaltung, werkzeugverwaltung, ausleiheRueckgabe, wartungPruefung,
    setAusleiheRueckgabe, setWerkzeugverwaltung,
    mitarbeiterverwaltungMap, werkzeugverwaltungMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedAusleiheRueckgabe = enrichAusleiheRueckgabe(ausleiheRueckgabe, { werkzeugverwaltungMap, mitarbeiterverwaltungMap });
  const enrichedWartungPruefung = enrichWartungPruefung(wartungPruefung, { werkzeugverwaltungMap });

  const overlay = useRecordOverlayStack<OverlayItem>();

  // Dialog-Zustände
  const [ausleiheOpen, setAusleiheOpen] = useState(false);
  const [ausleiheDefaults, setAusleiheDefaults] = useState<AusleiheRueckgabeDialogDefaults | undefined>();
  const [ausleiheEditId, setAusleiheEditId] = useState<string | undefined>();

  const [wartungOpen, setWartungOpen] = useState(false);
  const [wartungDefaults, setWartungDefaults] = useState<WartungPruefungDialogDefaults | undefined>();
  const [wartungEditId, setWartungEditId] = useState<string | undefined>();

  const [werkzeugOpen, setWerkzeugOpen] = useState(false);
  const [werkzeugDefaults, setWerkzeugDefaults] = useState<WerkzeugverwaltungDialogDefaults | undefined>();
  const [werkzeugEditId, setWerkzeugEditId] = useState<string | undefined>();

  const [mitarbeiterOpen, setMitarbeiterOpen] = useState(false);

  const [view, setView] = useState<'kanban' | 'timeline'>('kanban');

  // Heute-Datum
  const today = format(clock, 'yyyy-MM-dd');

  // ─── Abgeleitete Listen ───────────────────────────────────────────────────
  const faelligePruefungen = useMemo(() =>
    werkzeugverwaltung
      .filter(w => w.fields.naechste_pruefung && w.fields.naechste_pruefung <= today)
      .sort((a, b) => (a.fields.naechste_pruefung ?? '').localeCompare(b.fields.naechste_pruefung ?? '')),
    [werkzeugverwaltung, today]
  );

  const ausgelieheneListe = useMemo(() =>
    enrichedAusleiheRueckgabe
      .filter(a => lookupKey(a.fields.status) === 'ausgeliehen')
      .sort((a, b) => (a.fields.geplante_rueckgabe ?? '').localeCompare(b.fields.geplante_rueckgabe ?? '')),
    [enrichedAusleiheRueckgabe]
  );

  const ueberfaelligeAusleihen = useMemo(() =>
    ausgelieheneListe.filter(a => a.fields.geplante_rueckgabe && a.fields.geplante_rueckgabe < today),
    [ausgelieheneListe, today]
  );

  // Kanban-Karten
  const kanbanCards = useMemo<KanbanCard[]>(() =>
    enrichedAusleiheRueckgabe.map(a => {
      const status = lookupKey(a.fields.status) ?? AUSLEIHE_COLUMNS[0]?.key ?? '';
      return {
        id: `ausleihe:${a.record_id}`,
        column: status,
        title: a.werkzeugName || 'Unbekanntes Werkzeug',
        subtitle: a.mitarbeiterName ? `${a.mitarbeiterName}${a.fields.einsatzort ? ' · ' + a.fields.einsatzort : ''}` : (a.fields.einsatzort ?? undefined),
        tone: toneForAusleiheStatus(status),
      };
    }),
    [enrichedAusleiheRueckgabe]
  );

  // ─── Status-Wechsel via Drag ──────────────────────────────────────────────
  const moveCard = useCallback(async (cardId: string, newColumn: string) => {
    const rid = cardId.split(':')[1];
    if (!rid) return;
    const record = ausleiheRueckgabe.find(a => a.record_id === rid);
    if (!record) return;
    const oldStatus = lookupKey(record.fields.status);
    const newLabel = AUSLEIHE_COLUMNS.find(c => c.key === newColumn)?.label ?? newColumn;
    // Optimistisch
    setAusleiheRueckgabe(prev =>
      prev.map(a =>
        a.record_id === rid
          ? { ...a, fields: { ...a.fields, status: { key: newColumn, label: newLabel } } }
          : a
      )
    );
    try {
      await LivingAppsService.updateAusleiheRueckgabeEntry(rid, { status: newColumn });
      undoToast(`Status auf „${newLabel}" gesetzt`, async () => {
        setAusleiheRueckgabe(prev =>
          prev.map(a =>
            a.record_id === rid
              ? { ...a, fields: { ...a.fields, status: { key: oldStatus ?? '', label: AUSLEIHE_COLUMNS.find(c => c.key === oldStatus)?.label ?? '' } } }
              : a
          )
        );
        await LivingAppsService.updateAusleiheRueckgabeEntry(rid, { status: oldStatus ?? '' });
      });
    } catch {
      await fetchAll();
    }
  }, [ausleiheRueckgabe, setAusleiheRueckgabe, fetchAll]);

  // Rückgabe-Aktion (Überfällige Ausleihe abschließen)
  const handleReturnTool = useCallback(async (ausleihe: EnrichedAusleiheRueckgabe) => {
    const rid = ausleihe.record_id;
    const oldStatus = lookupKey(ausleihe.fields.status);
    setAusleiheRueckgabe(prev =>
      prev.map(a =>
        a.record_id === rid
          ? { ...a, fields: { ...a.fields, status: { key: 'zurueckgegeben', label: 'Zurückgegeben' }, tatsaechliche_rueckgabe: today } }
          : a
      )
    );
    try {
      await LivingAppsService.updateAusleiheRueckgabeEntry(rid, { status: 'zurueckgegeben', tatsaechliche_rueckgabe: today });
      undoToast(`${ausleihe.werkzeugName} als zurückgegeben markiert`, async () => {
        setAusleiheRueckgabe(prev =>
          prev.map(a =>
            a.record_id === rid
              ? { ...a, fields: { ...a.fields, status: { key: oldStatus ?? 'ausgeliehen', label: 'Ausgeliehen' }, tatsaechliche_rueckgabe: undefined } }
              : a
          )
        );
        await LivingAppsService.updateAusleiheRueckgabeEntry(rid, { status: oldStatus ?? 'ausgeliehen', tatsaechliche_rueckgabe: undefined });
      });
    } catch {
      await fetchAll();
    }
  }, [setAusleiheRueckgabe, today, fetchAll]);

  // ─── Timeline: Werkzeuge sortiert nach Nähe des Rückgabedatums zu heute ──
  const timelineGroupsSorted = useMemo(() => {
    const todayMs = parseISO(today).getTime();
    return [...enrichedAusleiheRueckgabe]
      .filter(a => !!a.fields.ausleihdatum)
      .sort((a, b) => {
        const distA = a.fields.geplante_rueckgabe
          ? Math.abs(parseISO(a.fields.geplante_rueckgabe).getTime() - todayMs)
          : Infinity;
        const distB = b.fields.geplante_rueckgabe
          ? Math.abs(parseISO(b.fields.geplante_rueckgabe).getTime() - todayMs)
          : Infinity;
        return distA - distB;
      });
  }, [enrichedAusleiheRueckgabe, today]);

  const timelineGroups = useMemo<ResourceGroup[]>(() =>
    timelineGroupsSorted.map(a => {
      const status = lookupKey(a.fields.status);
      let tone: ResourceTone = 'default';
      if (status === 'verloren') tone = 'destructive';
      else if (status === 'ausgeliehen' && a.fields.geplante_rueckgabe && a.fields.geplante_rueckgabe < today) tone = 'warning';
      else if (status === 'ausgeliehen') tone = 'primary';
      return {
        key: a.record_id,
        label: [a.werkzeugName, a.mitarbeiterName].filter(Boolean).join(' · ') || 'Werkzeug',
        tone,
      };
    }),
    [timelineGroupsSorted, today]
  );

  const timelineEvents = useMemo<ResourceEvent[]>(() =>
    timelineGroupsSorted.flatMap(a => {
      if (!a.fields.ausleihdatum) return [];
      const status = lookupKey(a.fields.status);
      let tone: ResourceTone = 'success';
      if (status === 'verloren') tone = 'destructive';
      else if (status === 'ausgeliehen' && a.fields.geplante_rueckgabe && a.fields.geplante_rueckgabe < today) tone = 'warning';
      else if (status === 'ausgeliehen') tone = 'primary';
      return [{
        id: `ausleihe:${a.record_id}`,
        start: a.fields.ausleihdatum,
        end: a.fields.geplante_rueckgabe,
        allDay: true,
        title: a.werkzeugName || 'Werkzeug',
        subtitle: a.mitarbeiterName || undefined,
        tone,
        group: a.record_id,
      }];
    }),
    [timelineGroupsSorted, today]
  );

  // ─── Hooks ENDE — ab hier nur Ableitungen ────────────────────────────────

  // ─── every hook ABOVE this line ──────────────────────────────────────────
  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;
  // ─── Below this line: plain derivations only, no hooks. ──────────────────

  const totalWerkzeuge = werkzeugverwaltung.length;
  const ausgeliehenCount = ausgelieheneListe.length;
  const inPruefungCount = faelligePruefungen.length;

  // Kontext-Zeile mit Namen
  const ueberfaelligNames = ueberfaelligeAusleihen.map(a => a.werkzeugName).filter(Boolean);
  const pruefungNames = faelligePruefungen.slice(0, 3).map(w => w.fields.bezeichnung ?? '').filter(Boolean);

  let contextLine = gruss(clock) + ' ';
  if (ueberfaelligeAusleihen.length > 0) {
    contextLine += `${namen(ueberfaelligNames)} ${ueberfaelligeAusleihen.length === 1 ? 'ist' : 'sind'} überfällig zur Rückgabe.`;
  } else if (faelligePruefungen.length > 0) {
    contextLine += `${namen(pruefungNames)} ${faelligePruefungen.length === 1 ? 'steht' : 'stehen'} zur Prüfung an.`;
  } else if (ausgeliehenCount > 0) {
    contextLine += `${ausgeliehenCount} Werkzeug${ausgeliehenCount === 1 ? '' : 'e'} gerade im Einsatz — alles im Zeitplan.`;
  } else {
    contextLine += 'Alle Werkzeuge verfügbar — kein Handlungsbedarf.';
  }

  return (
    <>
      {/* Seiten-Kopf */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">Werkzeugmanagement</h1>
          <p className="text-sm text-muted-foreground mt-0.5 truncate">{contextLine}</p>
        </div>
        <div className="flex shrink-0 gap-2 flex-wrap items-center">
          {/* View-Toggle */}
          <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                view === 'kanban'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <IconLayoutKanban size={15} className="shrink-0" />
              <span className="hidden sm:inline">Kanban</span>
            </button>
            <button
              onClick={() => setView('timeline')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-sm font-medium transition-colors ${
                view === 'timeline'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <IconCalendarEvent size={15} className="shrink-0" />
              <span className="hidden sm:inline">Kalender</span>
            </button>
          </div>
          <button
            onClick={() => { setAusleiheDefaults(undefined); setAusleiheEditId(undefined); setAusleiheOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <IconPlus size={16} className="shrink-0" />
            <span className="hidden sm:inline">Ausleihe</span>
          </button>
          <button
            onClick={() => { setWerkzeugDefaults(undefined); setWerkzeugEditId(undefined); setWerkzeugOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border bg-background text-foreground text-sm font-medium hover:bg-muted transition-colors"
          >
            <IconTool size={16} className="shrink-0" />
            <span className="hidden sm:inline">Werkzeug</span>
          </button>
        </div>
      </div>

      <DashboardGrid
        variant="wide"
        hero={ueberfaelligeAusleihen.length > 0 && (
          <HeroBanner
            icon={<IconAlertTriangle size={18} />}
            action={{
              label: 'Rückgabe bestätigen',
              onClick: () => handleReturnTool(ueberfaelligeAusleihen[0]),
            }}
          >
            <b>{namen(ueberfaelligNames)}</b> {ueberfaelligeAusleihen.length === 1 ? 'ist' : 'sind'} überfällig — geplante Rückgabe{' '}
            {ueberfaelligeAusleihen.length === 1
              ? `war ${formatDate(ueberfaelligeAusleihen[0].fields.geplante_rueckgabe)}`
              : `war spätestens ${formatDate(ueberfaelligeAusleihen[0].fields.geplante_rueckgabe)}`}.
          </HeroBanner>
        )}
        kpis={
          <StatStrip>
            <StatStripItem
              title="Werkzeuge im Lager"
              value={totalWerkzeuge}
              icon={<IconTool size={16} />}
              tone="default"
            />
            <StatStripItem
              title="Im Einsatz"
              value={ausgeliehenCount}
              icon={<IconTool size={16} />}
              tone={ausgeliehenCount > 0 ? 'primary' : 'default'}
            />
            <StatStripItem
              title="Prüfung fällig"
              value={inPruefungCount}
              icon={<IconAlertTriangle size={16} />}
              tone={inPruefungCount > 0 ? 'destructive' : 'default'}
            />
            <StatStripItem
              title="Mitarbeiter"
              value={mitarbeiterverwaltung.length}
              icon={<IconUsers size={16} />}
              tone="default"
            />
          </StatStrip>
        }
        primary={
          view === 'kanban' ? (
            <KanbanWidget
              cards={kanbanCards}
              columns={AUSLEIHE_COLUMNS}
              defaultCollapsed={['verloren']}
              onCardClick={card => overlay.replace({ type: 'ausleihe', id: card.id.split(':')[1] })}
              onCardMove={moveCard}
              onAddCard={column => {
                setAusleiheDefaults({ status: column });
                setAusleiheEditId(undefined);
                setAusleiheOpen(true);
              }}
            />
          ) : (
            <ResourceTimeline
              events={timelineEvents}
              groups={timelineGroups}
              axis="day"
              defaultRange="2weeks"
              defaultDate={clock}
              locale={de}
              weekDays={5}
              onEventClick={ev => overlay.replace({ type: 'ausleihe', id: ev.id.split(':')[1] })}
              onEmptyClick={(date, _group) => {
                setAusleiheDefaults({ ausleihdatum: format(date, 'yyyy-MM-dd') });
                setAusleiheEditId(undefined);
                setAusleiheOpen(true);
              }}
            />
          )
        }
        aside={
          <>
            <WorkList
              title="Prüfungen fällig"
              items={faelligePruefungen.slice(0, 8).map(w => ({
                id: w.record_id,
                title: w.fields.bezeichnung ?? 'Unbekannt',
                secondLine: (
                  <>
                    <span className="font-medium text-destructive">
                      {w.fields.naechste_pruefung && w.fields.naechste_pruefung < today ? 'Überfällig' : 'Fällig'}
                    </span>
                    <span className="text-muted-foreground"> · {formatDate(w.fields.naechste_pruefung)}</span>
                  </>
                ),
                action: {
                  label: '+ Prüfung',
                  onClick: () => {
                    setWartungDefaults({ werkzeug_wartung: w.record_id });
                    setWartungEditId(undefined);
                    setWartungOpen(true);
                  },
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'werkzeug', id })}
              empty={{
                text: 'Alle Prüfungen aktuell — nächste Frist rechtzeitig im Blick',
                action: { label: 'Wartung erfassen', onClick: () => { setWartungDefaults(undefined); setWartungEditId(undefined); setWartungOpen(true); } },
              }}
            />
            <WorkList
              title="Aktive Ausleihen"
              items={ausgelieheneListe.slice(0, 8).map(a => ({
                id: a.record_id,
                title: a.werkzeugName || 'Werkzeug',
                secondLine: (
                  <>
                    <span className={
                      a.fields.geplante_rueckgabe && a.fields.geplante_rueckgabe < today
                        ? 'font-medium text-destructive'
                        : 'text-muted-foreground'
                    }>
                      {a.mitarbeiterName || 'Mitarbeiter'}
                    </span>
                    {a.fields.geplante_rueckgabe && (
                      <span className="text-muted-foreground"> · bis {formatDate(a.fields.geplante_rueckgabe)}</span>
                    )}
                  </>
                ),
                action: {
                  label: '✓ Rückgabe',
                  onClick: () => handleReturnTool(a),
                },
              }))}
              onItemClick={id => overlay.replace({ type: 'ausleihe', id })}
              empty={{
                text: 'Keine aktiven Ausleihen — alle Werkzeuge verfügbar',
                action: { label: 'Ausleihe erfassen', onClick: () => { setAusleiheDefaults(undefined); setAusleiheEditId(undefined); setAusleiheOpen(true); } },
              }}
            />
          </>
        }
      />

      {/* ─── Record-Overlay (ein Shell für alle Typen) ──────────────────── */}
      <RecordOverlayHost
        overlay={overlay}
        render={top => {
          if (top.type === 'ausleihe') {
            const rec = ausleiheRueckgabe.find(a => a.record_id === top.id);
            if (!rec) return null;
            const wz = werkzeugverwaltungMap.get(extractRecordId(rec.fields.werkzeug) ?? '') ?? null;
            return (
              <>
                <RecordHeader
                  title={enrichedAusleiheRueckgabe.find(a => a.record_id === top.id)?.werkzeugName ?? 'Ausleihe'}
                  subtitle={rec.fields.status?.label}
                  badges={<span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                    lookupKey(rec.fields.status) === 'ausgeliehen' ? 'bg-primary/10 text-primary' :
                    lookupKey(rec.fields.status) === 'zurueckgegeben' ? 'bg-success/10 text-success' :
                    'bg-destructive/10 text-destructive'
                  }`}>{rec.fields.status?.label ?? '—'}</span>}
                />
                <AusleiheRueckgabeDetails
                  record={rec}
                  werkzeugverwaltungList={werkzeugverwaltung}
                  onOpenWerkzeugverwaltung={r => overlay.push({ type: 'werkzeug', id: r.record_id })}
                  mitarbeiterverwaltungList={mitarbeiterverwaltung}
                  onOpenMitarbeiterverwaltung={r => overlay.push({ type: 'mitarbeiter', id: r.record_id })}
                />
              </>
            );
          }
          if (top.type === 'werkzeug') {
            const rec = werkzeugverwaltung.find(w => w.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={rec.fields.bezeichnung ?? 'Werkzeug'}
                  subtitle={[rec.fields.hersteller, rec.fields.modell].filter(Boolean).join(' ')}
                  badges={<span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{rec.fields.kategorie?.label ?? '—'}</span>}
                />
                <WerkzeugverwaltungDetails
                  record={rec}
                  ausleiheRueckgabeList={ausleiheRueckgabe}
                  onOpenAusleiheRueckgabe={r => overlay.push({ type: 'ausleihe', id: r.record_id })}
                  onAddAusleiheRueckgabe={() => {
                    setAusleiheDefaults({ werkzeug: rec.record_id });
                    setAusleiheEditId(undefined);
                    setAusleiheOpen(true);
                  }}
                  wartungPruefungList={wartungPruefung}
                  onOpenWartungPruefung={r => overlay.push({ type: 'wartung', id: r.record_id })}
                  onAddWartungPruefung={() => {
                    setWartungDefaults({ werkzeug_wartung: rec.record_id });
                    setWartungEditId(undefined);
                    setWartungOpen(true);
                  }}
                />
              </>
            );
          }
          if (top.type === 'wartung') {
            const rec = wartungPruefung.find(w => w.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={enrichedWartungPruefung.find(w => w.record_id === top.id)?.werkzeug_wartungName ?? 'Wartung'}
                  subtitle={rec.fields.art_massnahme?.label}
                />
                <WartungPruefungDetails
                  record={rec}
                  werkzeugverwaltungList={werkzeugverwaltung}
                  onOpenWerkzeugverwaltung={r => overlay.push({ type: 'werkzeug', id: r.record_id })}
                />
              </>
            );
          }
          if (top.type === 'mitarbeiter') {
            const rec = mitarbeiterverwaltung.find(m => m.record_id === top.id);
            if (!rec) return null;
            return (
              <>
                <RecordHeader
                  title={[rec.fields.vorname, rec.fields.nachname].filter(Boolean).join(' ')}
                  subtitle={rec.fields.abteilung?.label}
                />
                <MitarbeiterverwaltungDetails
                  record={rec}
                  ausleiheRueckgabeList={ausleiheRueckgabe}
                  onOpenAusleiheRueckgabe={r => overlay.push({ type: 'ausleihe', id: r.record_id })}
                  onAddAusleiheRueckgabe={() => {
                    setAusleiheDefaults({ mitarbeiter: rec.record_id });
                    setAusleiheEditId(undefined);
                    setAusleiheOpen(true);
                  }}
                />
              </>
            );
          }
          return null;
        }}
        footer={top => {
          if (top.type === 'ausleihe') {
            const rec = ausleiheRueckgabe.find(a => a.record_id === top.id);
            const enriched = enrichedAusleiheRueckgabe.find(a => a.record_id === top.id);
            if (!rec || lookupKey(rec.fields.status) !== 'ausgeliehen') return null;
            return {
              label: 'Rückgabe bestätigen',
              onClick: () => { if (enriched) { void handleReturnTool(enriched); overlay.close(); } },
            };
          }
          return null;
        }}
        onEdit={top => {
          if (top.type === 'ausleihe') {
            const rec = ausleiheRueckgabe.find(a => a.record_id === top.id);
            if (rec) { setAusleiheDefaults(rec.fields as AusleiheRueckgabeDialogDefaults); setAusleiheEditId(rec.record_id); setAusleiheOpen(true); }
          } else if (top.type === 'werkzeug') {
            const rec = werkzeugverwaltung.find(w => w.record_id === top.id);
            if (rec) { setWerkzeugDefaults(rec.fields as WerkzeugverwaltungDialogDefaults); setWerkzeugEditId(rec.record_id); setWerkzeugOpen(true); }
          } else if (top.type === 'wartung') {
            const rec = wartungPruefung.find(w => w.record_id === top.id);
            if (rec) { setWartungDefaults(rec.fields as WartungPruefungDialogDefaults); setWartungEditId(rec.record_id); setWartungOpen(true); }
          } else if (top.type === 'mitarbeiter') {
            setMitarbeiterOpen(true);
          }
        }}
      />

      {/* ─── Dialoge ─────────────────────────────────────────────────────── */}
      <AusleiheRueckgabeDialog
        open={ausleiheOpen}
        onClose={() => setAusleiheOpen(false)}
        defaultValues={ausleiheDefaults}
        recordId={ausleiheEditId}
        werkzeugverwaltungList={werkzeugverwaltung}
        mitarbeiterverwaltungList={mitarbeiterverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['AusleiheRueckgabe']}
        enablePhotoLocation={AI_PHOTO_LOCATION['AusleiheRueckgabe']}
        onSubmit={async fields => {
          if (ausleiheEditId) {
            await LivingAppsService.updateAusleiheRueckgabeEntry(ausleiheEditId, fields);
          } else {
            await LivingAppsService.createAusleiheRueckgabeEntry(fields);
          }
          await fetchAll();
        }}
      />
      <WartungPruefungDialog
        open={wartungOpen}
        onClose={() => setWartungOpen(false)}
        defaultValues={wartungDefaults}
        recordId={wartungEditId}
        werkzeugverwaltungList={werkzeugverwaltung}
        enablePhotoScan={AI_PHOTO_SCAN['WartungPruefung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['WartungPruefung']}
        onSubmit={async fields => {
          if (wartungEditId) {
            await LivingAppsService.updateWartungPruefungEntry(wartungEditId, fields);
          } else {
            await LivingAppsService.createWartungPruefungEntry(fields);
          }
          await fetchAll();
        }}
      />
      <WerkzeugverwaltungDialog
        open={werkzeugOpen}
        onClose={() => setWerkzeugOpen(false)}
        defaultValues={werkzeugDefaults}
        recordId={werkzeugEditId}
        enablePhotoScan={AI_PHOTO_SCAN['Werkzeugverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Werkzeugverwaltung']}
        onSubmit={async fields => {
          if (werkzeugEditId) {
            await LivingAppsService.updateWerkzeugverwaltungEntry(werkzeugEditId, fields);
          } else {
            await LivingAppsService.createWerkzeugverwaltungEntry(fields);
          }
          await fetchAll();
        }}
      />
      <MitarbeiterverwaltungDialog
        open={mitarbeiterOpen}
        onClose={() => setMitarbeiterOpen(false)}
        enablePhotoScan={AI_PHOTO_SCAN['Mitarbeiterverwaltung']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Mitarbeiterverwaltung']}
        onSubmit={async fields => {
          await LivingAppsService.createMitarbeiterverwaltungEntry(fields);
          await fetchAll();
        }}
      />
    </>
  );
}
