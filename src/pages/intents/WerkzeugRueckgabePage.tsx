/**
 * Werkzeug-Rückgabe — 3-Schritt-Wizard.
 * Steps: 1) Offene Ausleihe wählen (status=ausgeliehen) → 2) Rückgabe erfassen (update AusleiheRueckgabe)
 *        → 3) optional Wartung/Prüfung erfassen (create WartungPruefung, update Werkzeugverwaltung).
 * Reads: ausleiheRueckgabe, werkzeugverwaltung, mitarbeiterverwaltung.
 * Writes: updateAusleiheRueckgabeEntry, createWartungPruefungEntry, updateWerkzeugverwaltungEntry.
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichAusleiheRueckgabe } from '@/lib/enrich';
import type { EnrichedAusleiheRueckgabe } from '@/types/enriched';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import {
  LivingAppsService,
  createRecordUrl,
  extractRecordId,
} from '@/services/livingAppsService';
import { formatDate, formatCurrency } from '@/lib/formatters';
import {
  IconTool,
  IconCheck,
  IconAlertTriangle,
  IconArrowRight,
} from '@tabler/icons-react';

const STATUS_OPTS = LOOKUP_OPTIONS['ausleihe_rueckgabe']?.['status'] ?? [];
const ART_OPTS = LOOKUP_OPTIONS['wartung_pruefung']?.['art_massnahme'] ?? [];
const ERGEBNIS_OPTS = LOOKUP_OPTIONS['wartung_pruefung']?.['ergebnis'] ?? [];

const WIZARD_STEPS = [
  { label: 'Ausleihe wählen' },
  { label: 'Rückgabe erfassen' },
  { label: 'Wartung erfassen' },
];

export default function WerkzeugRueckgabePage() {
  const {
    ausleiheRueckgabe,
    werkzeugverwaltung,
    mitarbeiterverwaltung,
    werkzeugverwaltungMap,
    mitarbeiterverwaltungMap,
    loading,
    error,
    fetchAll,
  } = useDashboardData();

  // Wizard navigation
  const [step, setStep] = useState(1);

  // Step 1 — selection
  const [selectedAusleihe, setSelectedAusleihe] = useState<EnrichedAusleiheRueckgabe | null>(null);

  // Step 2 — Rückgabe form
  const [rueckgabeDatum, setRueckgabeDatum] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [rueckgabeStatus, setRueckgabeStatus] = useState('zurueckgegeben');
  const [bemerkungAusleihe, setBemerkungAusleihe] = useState('');
  const [step2Submitting, setStep2Submitting] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [step2Done, setStep2Done] = useState(false);

  // werkzeug id stored after step 2 for step 3
  const [werkzeugId, setWerkzeugId] = useState<string | null>(null);

  // Step 3 — Wartung form
  const [datumWartung, setDatumWartung] = useState(
    format(new Date(), 'yyyy-MM-dd')
  );
  const [artMassnahmeKey, setArtMassnahmeKey] = useState(ART_OPTS[0]?.key ?? '');
  const [durchgefuehrtVon, setDurchgefuehrtVon] = useState('');
  const [ergebnisKey, setErgebnisKey] = useState('none');
  const [naechstePruefung, setNaechstePruefung] = useState('');
  const [kosten, setKosten] = useState('');
  const [bemerkungWartung, setBemerkungWartung] = useState('');
  const [step3Submitting, setStep3Submitting] = useState(false);
  const [step3Error, setStep3Error] = useState<string | null>(null);
  const [step3Done, setStep3Done] = useState(false);
  const [wartungId, setWartungId] = useState<string | null>(null);

  // Enrich ausleihe records — filtered to ausgeliehen only
  const enrichedAusleihen = useMemo(() => {
    const maps = { werkzeugverwaltungMap, mitarbeiterverwaltungMap };
    const enriched = enrichAusleiheRueckgabe(ausleiheRueckgabe, maps);
    return enriched.filter(a => a.fields.status?.key === 'ausgeliehen');
  }, [ausleiheRueckgabe, werkzeugverwaltungMap, mitarbeiterverwaltungMap]);

  // Suppress unused var warnings for maps used only in enrich
  void werkzeugverwaltung;
  void mitarbeiterverwaltung;

  // Step 1: pick an open loan
  function handleSelectAusleihe(id: string) {
    const found = enrichedAusleihen.find(a => a.record_id === id) ?? null;
    setSelectedAusleihe(found);
    if (found) {
      setStep(2);
    }
  }

  // Step 2: submit Rückgabe
  async function handleRueckgabeSubmit() {
    if (!selectedAusleihe) return;
    if (!rueckgabeDatum) {
      setStep2Error('Bitte ein Rückgabedatum angeben.');
      return;
    }
    setStep2Submitting(true);
    setStep2Error(null);
    try {
      await LivingAppsService.updateAusleiheRueckgabeEntry(selectedAusleihe.record_id, {
        tatsaechliche_rueckgabe: rueckgabeDatum,
        status: rueckgabeStatus,
        bemerkung_ausleihe: bemerkungAusleihe || undefined,
      });
      const wId = extractRecordId(selectedAusleihe.fields.werkzeug);
      setWerkzeugId(wId);
      setStep2Done(true);
      await fetchAll();
    } catch (err) {
      setStep2Error(err instanceof Error ? err.message : 'Fehler beim Speichern der Rückgabe.');
    } finally {
      setStep2Submitting(false);
    }
  }

  // Step 3: submit Wartung
  async function handleWartungSubmit() {
    if (!werkzeugId) return;
    if (!datumWartung || !artMassnahmeKey) {
      setStep3Error('Datum und Art der Maßnahme sind Pflichtfelder.');
      return;
    }
    setStep3Submitting(true);
    setStep3Error(null);
    try {
      // Guard against double-submit
      let wid = wartungId;
      if (!wid) {
        const result = await LivingAppsService.createWartungPruefungEntry({
          werkzeug_wartung: createRecordUrl(APP_IDS.WERKZEUGVERWALTUNG, werkzeugId),
          datum_wartung: datumWartung,
          art_massnahme: artMassnahmeKey,
          durchgefuehrt_von: durchgefuehrtVon || undefined,
          ergebnis: ergebnisKey !== 'none' ? ergebnisKey : undefined,
          naechste_pruefung_wartung: naechstePruefung || undefined,
          kosten: kosten ? parseFloat(kosten) : undefined,
          bemerkung_wartung: bemerkungWartung || undefined,
        });
        wid = result.record_id;
        setWartungId(wid);
      }
      // Update next inspection date on the tool if provided
      if (naechstePruefung) {
        await LivingAppsService.updateWerkzeugverwaltungEntry(werkzeugId, {
          naechste_pruefung: naechstePruefung,
        });
      }
      setStep3Done(true);
      await fetchAll();
    } catch (err) {
      setStep3Error(err instanceof Error ? err.message : 'Fehler beim Speichern der Wartung.');
    } finally {
      setStep3Submitting(false);
    }
  }

  function handleReset() {
    setStep(1);
    setSelectedAusleihe(null);
    setRueckgabeDatum(format(new Date(), 'yyyy-MM-dd'));
    setRueckgabeStatus('zurueckgegeben');
    setBemerkungAusleihe('');
    setStep2Submitting(false);
    setStep2Error(null);
    setStep2Done(false);
    setWerkzeugId(null);
    setDatumWartung(format(new Date(), 'yyyy-MM-dd'));
    setArtMassnahmeKey(ART_OPTS[0]?.key ?? '');
    setDurchgefuehrtVon('');
    setErgebnisKey('none');
    setNaechstePruefung('');
    setKosten('');
    setBemerkungWartung('');
    setStep3Submitting(false);
    setStep3Error(null);
    setStep3Done(false);
    setWartungId(null);
  }

  const returnStatusOpts = STATUS_OPTS.filter(o =>
    o.key === 'zurueckgegeben' || o.key === 'verloren'
  );

  return (
    <IntentWizardShell
      title="Werkzeug zurückgeben"
      subtitle="Rückgabe erfassen und optional Wartung anlegen"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ── STEP 1: Ausleihe wählen ── */}
      {step === 1 && (
        <EntitySelectStep
          items={enrichedAusleihen.map(a => ({
            id: a.record_id,
            title: a.werkzeugName || '(Werkzeug unbekannt)',
            subtitle: `${a.mitarbeiterName || '—'} · Ausgeliehen: ${formatDate(a.fields.ausleihdatum)} · ${a.fields.einsatzort ?? '—'}`,
            status: a.fields.status
              ? { key: a.fields.status.key, label: a.fields.status.label }
              : undefined,
            icon: <IconTool size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectAusleihe}
          searchPlaceholder="Werkzeug oder Mitarbeiter suchen …"
          emptyText="Keine offenen Ausleihen gefunden."
          emptyIcon={<IconTool size={32} className="text-muted-foreground" />}
        />
      )}

      {/* ── STEP 2: Rückgabe erfassen ── */}
      {step === 2 && (
        selectedAusleihe ? (
          <div className="space-y-6 max-w-lg mx-auto">
            {/* Context card */}
            <div className="rounded-2xl border bg-card p-4 space-y-2">
              <div className="flex items-center gap-2">
                <IconTool size={18} className="text-primary" />
                <span className="font-semibold text-foreground">
                  {selectedAusleihe.werkzeugName || '(Werkzeug unbekannt)'}
                </span>
                <StatusBadge
                  statusKey={selectedAusleihe.fields.status?.key}
                  label={selectedAusleihe.fields.status?.label}
                />
              </div>
              <div className="text-sm text-muted-foreground space-y-0.5">
                <div>Mitarbeiter: <span className="text-foreground">{selectedAusleihe.mitarbeiterName || '—'}</span></div>
                <div>Ausgeliehen: <span className="text-foreground">{formatDate(selectedAusleihe.fields.ausleihdatum)}</span></div>
                {selectedAusleihe.fields.geplante_rueckgabe && (
                  <div>Geplante Rückgabe: <span className="text-foreground">{formatDate(selectedAusleihe.fields.geplante_rueckgabe)}</span></div>
                )}
                {selectedAusleihe.fields.einsatzort && (
                  <div>Einsatzort: <span className="text-foreground">{selectedAusleihe.fields.einsatzort}</span></div>
                )}
              </div>
            </div>

            {/* Rückgabe form */}
            {!step2Done ? (
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Rückgabe erfassen</h3>

                <div className="space-y-1.5">
                  <Label htmlFor="rueckgabe-datum">Tatsächliche Rückgabe *</Label>
                  <Input
                    id="rueckgabe-datum"
                    type="date"
                    value={rueckgabeDatum}
                    onChange={e => setRueckgabeDatum(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="rueckgabe-status">Status *</Label>
                  <div className="flex flex-wrap gap-2">
                    {returnStatusOpts.map(opt => (
                      <button
                        key={opt.key}
                        type="button"
                        onClick={() => setRueckgabeStatus(opt.key)}
                        className={`px-4 py-2 rounded-xl border text-sm font-medium transition-colors ${
                          rueckgabeStatus === opt.key
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                        }`}
                      >
                        {opt.key === 'verloren' && (
                          <IconAlertTriangle size={14} className="inline mr-1" />
                        )}
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bemerkung-ausleihe">Bemerkung (optional)</Label>
                  <Textarea
                    id="bemerkung-ausleihe"
                    value={bemerkungAusleihe}
                    onChange={e => setBemerkungAusleihe(e.target.value)}
                    placeholder="Zustand bei Rückgabe, Hinweise …"
                    rows={3}
                  />
                </div>

                {step2Error && (
                  <p className="text-sm text-destructive">{step2Error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setStep(1)}
                    disabled={step2Submitting}
                  >
                    Zurück
                  </Button>
                  <Button
                    onClick={handleRueckgabeSubmit}
                    disabled={step2Submitting || !rueckgabeDatum}
                    className="flex-1"
                  >
                    {step2Submitting ? 'Wird gespeichert …' : 'Rückgabe bestätigen'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Success summary after step 2 */
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <IconCheck size={20} />
                  <span className="font-semibold">Rückgabe erfasst</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <div>Werkzeug: <span className="text-foreground font-medium">{selectedAusleihe.werkzeugName || '—'}</span></div>
                  <div>Mitarbeiter: <span className="text-foreground">{selectedAusleihe.mitarbeiterName || '—'}</span></div>
                  <div>Rückgabedatum: <span className="text-foreground">{formatDate(rueckgabeDatum)}</span></div>
                  <div>
                    Status:{' '}
                    <span className="text-foreground">
                      {returnStatusOpts.find(o => o.key === rueckgabeStatus)?.label ?? rueckgabeStatus}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Button
                    onClick={() => setStep(3)}
                    className="flex items-center gap-2"
                  >
                    Wartung erfassen
                    <IconArrowRight size={16} />
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#/">Fertig — zum Dashboard</a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Guard: step 2 loaded cold without selection */
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt benötigt eine ausgewählte Ausleihe aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* ── STEP 3: Wartung erfassen (optional) ── */}
      {step === 3 && (
        werkzeugId ? (
          <div className="space-y-6 max-w-lg mx-auto">
            {/* Context */}
            <div className="rounded-2xl border bg-card p-4 flex items-center gap-3">
              <IconTool size={18} className="text-primary" />
              <span className="font-semibold text-foreground">
                {selectedAusleihe?.werkzeugName || '(Werkzeug)'}
              </span>
            </div>

            {!step3Done ? (
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <h3 className="font-semibold text-foreground">Wartung / Prüfung erfassen</h3>

                <div className="space-y-1.5">
                  <Label htmlFor="datum-wartung">Datum der Maßnahme *</Label>
                  <Input
                    id="datum-wartung"
                    type="date"
                    value={datumWartung}
                    onChange={e => setDatumWartung(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="art-massnahme">Art der Maßnahme *</Label>
                  <Select value={artMassnahmeKey} onValueChange={setArtMassnahmeKey}>
                    <SelectTrigger id="art-massnahme" className="w-full">
                      <SelectValue placeholder="Maßnahme wählen …" />
                    </SelectTrigger>
                    <SelectContent>
                      {ART_OPTS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="durchgefuehrt-von">Durchgeführt von</Label>
                  <Input
                    id="durchgefuehrt-von"
                    value={durchgefuehrtVon}
                    onChange={e => setDurchgefuehrtVon(e.target.value)}
                    placeholder="Name oder Firma …"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ergebnis">Ergebnis</Label>
                  <Select value={ergebnisKey} onValueChange={setErgebnisKey}>
                    <SelectTrigger id="ergebnis" className="w-full">
                      <SelectValue placeholder="Ergebnis wählen …" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kein Ergebnis</SelectItem>
                      {ERGEBNIS_OPTS.map(opt => (
                        <SelectItem key={opt.key} value={opt.key}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="naechste-pruefung">Nächste Prüfung / Wartung</Label>
                  <Input
                    id="naechste-pruefung"
                    type="date"
                    value={naechstePruefung}
                    onChange={e => setNaechstePruefung(e.target.value)}
                  />
                  {naechstePruefung && (
                    <p className="text-xs text-muted-foreground">
                      Das Datum wird auch am Werkzeug-Datensatz gespeichert.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="kosten">Kosten (€)</Label>
                  <Input
                    id="kosten"
                    type="number"
                    min="0"
                    step="0.01"
                    value={kosten}
                    onChange={e => setKosten(e.target.value)}
                    placeholder="0,00"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="bemerkung-wartung">Bemerkung</Label>
                  <Textarea
                    id="bemerkung-wartung"
                    value={bemerkungWartung}
                    onChange={e => setBemerkungWartung(e.target.value)}
                    placeholder="Details zur Wartung …"
                    rows={3}
                  />
                </div>

                {step3Error && (
                  <p className="text-sm text-destructive">{step3Error}</p>
                )}

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={step3Submitting}
                  >
                    Zurück
                  </Button>
                  <Button
                    onClick={handleWartungSubmit}
                    disabled={step3Submitting || !datumWartung || !artMassnahmeKey}
                    className="flex-1"
                  >
                    {step3Submitting ? 'Wird gespeichert …' : 'Wartung anlegen'}
                  </Button>
                </div>
              </div>
            ) : (
              /* Success summary after step 3 */
              <div className="rounded-2xl border bg-card p-5 space-y-4">
                <div className="flex items-center gap-2 text-green-600">
                  <IconCheck size={20} />
                  <span className="font-semibold">Wartung erfasst</span>
                </div>
                <div className="text-sm text-muted-foreground space-y-0.5">
                  <div>Werkzeug: <span className="text-foreground font-medium">{selectedAusleihe?.werkzeugName || '—'}</span></div>
                  <div>
                    Maßnahme:{' '}
                    <span className="text-foreground">
                      {ART_OPTS.find(o => o.key === artMassnahmeKey)?.label ?? artMassnahmeKey}
                    </span>
                  </div>
                  <div>Datum: <span className="text-foreground">{formatDate(datumWartung)}</span></div>
                  {ergebnisKey !== 'none' && (
                    <div>
                      Ergebnis:{' '}
                      <span className="text-foreground">
                        {ERGEBNIS_OPTS.find(o => o.key === ergebnisKey)?.label ?? ergebnisKey}
                      </span>
                    </div>
                  )}
                  {naechstePruefung && (
                    <div>Nächste Prüfung: <span className="text-foreground">{formatDate(naechstePruefung)}</span></div>
                  )}
                  {kosten && (
                    <div>Kosten: <span className="text-foreground">{formatCurrency(parseFloat(kosten))}</span></div>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-1">
                  <Button onClick={handleReset}>
                    Weitere Rückgabe erfassen
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#/">Zurück zum Dashboard</a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        ) : (
          /* Guard: step 3 loaded cold without werkzeugId */
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt benötigt eine abgeschlossene Rückgabe aus Schritt 2.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}
    </IntentWizardShell>
  );
}
