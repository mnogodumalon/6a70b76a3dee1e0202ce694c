/**
 * Werkzeug Ausleihen — 3-Schritt-Wizard.
 * Steps: 1) Mitarbeiter wählen → 2) Verfügbares Werkzeug wählen → 3) Ausleihdaten erfassen & Ausleihe anlegen.
 * Reads: mitarbeiterverwaltung, werkzeugverwaltung, ausleihe_rueckgabe.
 * Writes: ausleihe_rueckgabe (createAusleiheRueckgabeEntry).
 * Composes: IntentWizardShell, EntitySelectStep, StatusBadge.
 */

import { useState, useMemo } from 'react';
import { format } from 'date-fns';
import { IconTool, IconUser, IconCheck, IconAlertCircle } from '@tabler/icons-react';
import { IntentWizardShell } from '@/components/blocks/IntentWizardShell';
import { EntitySelectStep } from '@/components/blocks/EntitySelectStep';
import { StatusBadge } from '@/components/blocks/StatusBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Mitarbeiterverwaltung, Werkzeugverwaltung } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';

const WIZARD_STEPS = [
  { label: 'Mitarbeiter' },
  { label: 'Werkzeug' },
  { label: 'Ausleihe' },
];

export default function WerkzeugAusleihenPage() {
  const { mitarbeiterverwaltung, werkzeugverwaltung, ausleiheRueckgabe, loading, error, fetchAll } = useDashboardData();

  const [step, setStep] = useState(1);

  // Step 1 — selected Mitarbeiter
  const [selectedMitarbeiter, setSelectedMitarbeiter] = useState<Mitarbeiterverwaltung | null>(null);

  // Step 2 — selected Werkzeug
  const [selectedWerkzeug, setSelectedWerkzeug] = useState<Werkzeugverwaltung | null>(null);

  // Step 3 — Ausleihe form fields
  const [ausleihdatum, setAusleihdatum] = useState<string>(
    format(new Date(), "yyyy-MM-dd'T'HH:mm")
  );
  const [geplanteRueckgabe, setGeplanteRueckgabe] = useState('');
  const [einsatzort, setEinsatzort] = useState('');
  const [bemerkungAusleihe, setBemerkungAusleihe] = useState('');

  // Submission state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdId, setCreatedId] = useState<string | null>(null);

  // Determine which Werkzeuge are currently ausgeliehen
  const belegteWerkzeugIds = useMemo(() => {
    const ids = new Set<string>();
    Object.values(ausleiheRueckgabe ?? {}).forEach((ausleihe) => {
      if (ausleihe.fields.status?.key === 'ausgeliehen' && ausleihe.fields.werkzeug) {
        const id = extractRecordId(ausleihe.fields.werkzeug);
        if (id) ids.add(id);
      }
    });
    return ids;
  }, [ausleiheRueckgabe]);

  // Filter available Werkzeuge: not ausser_betrieb AND not currently ausgeliehen
  const verfuegbareWerkzeuge = useMemo(() => {
    return Object.values(werkzeugverwaltung ?? {}).filter((w) => {
      if (w.fields.zustand?.key === 'ausser_betrieb') return false;
      if (belegteWerkzeugIds.has(w.record_id)) return false;
      return true;
    });
  }, [werkzeugverwaltung, belegteWerkzeugIds]);

  const mitarbeiterList = Object.values(mitarbeiterverwaltung ?? {});

  const handleSelectMitarbeiter = (id: string) => {
    const m = mitarbeiterList.find((ma) => ma.record_id === id) ?? null;
    setSelectedMitarbeiter(m);
    setStep(2);
  };

  const handleSelectWerkzeug = (id: string) => {
    const w = verfuegbareWerkzeuge.find((wz) => wz.record_id === id) ?? null;
    setSelectedWerkzeug(w);
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!selectedMitarbeiter || !selectedWerkzeug || !ausleihdatum) return;

    // Idempotency guard: if we already have a createdId, don't create again
    if (createdId) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const result = await LivingAppsService.createAusleiheRueckgabeEntry({
        werkzeug: createRecordUrl(APP_IDS.WERKZEUGVERWALTUNG, selectedWerkzeug.record_id),
        mitarbeiter: createRecordUrl(APP_IDS.MITARBEITERVERWALTUNG, selectedMitarbeiter.record_id),
        ausleihdatum,
        geplante_rueckgabe: geplanteRueckgabe || undefined,
        status: 'ausgeliehen',
        einsatzort: einsatzort || undefined,
        bemerkung_ausleihe: bemerkungAusleihe || undefined,
      });
      setCreatedId(result.record_id);
      setSuccess(true);
      await fetchAll();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Unbekannter Fehler beim Erstellen der Ausleihe.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setSelectedMitarbeiter(null);
    setSelectedWerkzeug(null);
    setAusleihdatum(format(new Date(), "yyyy-MM-dd'T'HH:mm"));
    setGeplanteRueckgabe('');
    setEinsatzort('');
    setBemerkungAusleihe('');
    setSubmitError(null);
    setSuccess(false);
    setCreatedId(null);
  };

  return (
    <IntentWizardShell
      title="Werkzeug ausleihen"
      subtitle="Mitarbeiter auswählen, Werkzeug wählen und Ausleihe erfassen"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1 — Mitarbeiter wählen */}
      {step === 1 && (
        <EntitySelectStep
          items={mitarbeiterList.map((m) => ({
            id: m.record_id,
            title: [m.fields.vorname, m.fields.nachname].filter(Boolean).join(' ') || '(Ohne Name)',
            subtitle: [
              m.fields.personalnummer ? `Nr. ${m.fields.personalnummer}` : null,
              m.fields.abteilung?.label ?? null,
            ]
              .filter(Boolean)
              .join(' · '),
            icon: <IconUser size={20} className="text-primary" />,
          }))}
          onSelect={handleSelectMitarbeiter}
          searchPlaceholder="Nach Name oder Personalnummer suchen …"
          emptyText="Kein Mitarbeiter gefunden."
        />
      )}

      {/* Step 2 — Werkzeug wählen */}
      {step === 2 && (
        selectedMitarbeiter ? (
          <div className="space-y-4">
            <div className="rounded-xl border bg-secondary/40 px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              <IconUser size={16} />
              <span>
                Mitarbeiter:{' '}
                <span className="font-medium text-foreground">
                  {[selectedMitarbeiter.fields.vorname, selectedMitarbeiter.fields.nachname]
                    .filter(Boolean)
                    .join(' ')}
                </span>
              </span>
            </div>
            <EntitySelectStep
              items={verfuegbareWerkzeuge.map((w) => ({
                id: w.record_id,
                title: w.fields.bezeichnung ?? '(Ohne Bezeichnung)',
                subtitle: [
                  w.fields.werkzeugnummer ? `Nr. ${w.fields.werkzeugnummer}` : null,
                  w.fields.kategorie?.label ?? null,
                  w.fields.lagerort ? `Lager: ${w.fields.lagerort}` : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
                status: w.fields.zustand
                  ? { key: w.fields.zustand.key, label: w.fields.zustand.label }
                  : undefined,
                icon: <IconTool size={20} className="text-primary" />,
              }))}
              onSelect={handleSelectWerkzeug}
              searchPlaceholder="Nach Bezeichnung oder Werkzeugnummer suchen …"
              emptyText="Kein verfügbares Werkzeug gefunden."
              emptyIcon={<IconTool size={32} className="text-muted-foreground/40" />}
            />
          </div>
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht einen ausgewählten Mitarbeiter aus Schritt 1.
            </p>
            <Button variant="outline" onClick={() => setStep(1)}>
              Neu starten
            </Button>
          </div>
        )
      )}

      {/* Step 3 — Ausleihe erfassen */}
      {step === 3 && (
        selectedMitarbeiter && selectedWerkzeug ? (
          success ? (
            // Success state
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="rounded-full bg-green-100 p-4">
                <IconCheck size={40} className="text-green-600" />
              </div>
              <div className="text-center space-y-2">
                <h2 className="text-xl font-semibold text-foreground">Ausleihe erfasst!</h2>
                <p className="text-sm text-muted-foreground max-w-sm">
                  <span className="font-medium text-foreground">
                    {[selectedMitarbeiter.fields.vorname, selectedMitarbeiter.fields.nachname]
                      .filter(Boolean)
                      .join(' ')}
                  </span>{' '}
                  hat{' '}
                  <span className="font-medium text-foreground">
                    {selectedWerkzeug.fields.bezeichnung}
                  </span>{' '}
                  erfolgreich ausgeliehen.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full max-w-sm">
                <Button onClick={handleReset} className="flex-1">
                  Neue Ausleihe erfassen
                </Button>
                <Button variant="outline" asChild className="flex-1">
                  <a href="#/">Zurück zum Dashboard</a>
                </Button>
              </div>
            </div>
          ) : (
            // Ausleihe form
            <div className="space-y-6">
              {/* Context summary */}
              <div className="rounded-xl border bg-secondary/40 px-4 py-3 space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconUser size={16} />
                  <span>
                    Mitarbeiter:{' '}
                    <span className="font-medium text-foreground">
                      {[selectedMitarbeiter.fields.vorname, selectedMitarbeiter.fields.nachname]
                        .filter(Boolean)
                        .join(' ')}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <IconTool size={16} />
                  <span>
                    Werkzeug:{' '}
                    <span className="font-medium text-foreground">
                      {selectedWerkzeug.fields.bezeichnung}
                    </span>
                    {selectedWerkzeug.fields.werkzeugnummer && (
                      <span className="ml-1 text-muted-foreground">
                        (Nr. {selectedWerkzeug.fields.werkzeugnummer})
                      </span>
                    )}
                  </span>
                  {selectedWerkzeug.fields.zustand && (
                    <StatusBadge
                      statusKey={selectedWerkzeug.fields.zustand.key}
                      label={selectedWerkzeug.fields.zustand.label}
                      className="ml-auto"
                    />
                  )}
                </div>
              </div>

              {/* Form */}
              <div className="space-y-4 max-w-lg">
                <div className="space-y-2">
                  <Label htmlFor="ausleihdatum">
                    Ausleihdatum <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="ausleihdatum"
                    type="datetime-local"
                    value={ausleihdatum}
                    onChange={(e) => setAusleihdatum(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="geplante_rueckgabe">Geplante Rückgabe</Label>
                  <Input
                    id="geplante_rueckgabe"
                    type="date"
                    value={geplanteRueckgabe}
                    onChange={(e) => setGeplanteRueckgabe(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="einsatzort">Einsatzort</Label>
                  <Input
                    id="einsatzort"
                    type="text"
                    value={einsatzort}
                    onChange={(e) => setEinsatzort(e.target.value)}
                    placeholder="z. B. Baustelle Hauptstraße 12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bemerkung_ausleihe">Bemerkung</Label>
                  <Textarea
                    id="bemerkung_ausleihe"
                    value={bemerkungAusleihe}
                    onChange={(e) => setBemerkungAusleihe(e.target.value)}
                    placeholder="Optionale Hinweise zur Ausleihe …"
                    rows={3}
                  />
                </div>

                {submitError && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 flex items-start gap-2 text-sm text-destructive">
                    <IconAlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button
                    onClick={handleSubmit}
                    disabled={!ausleihdatum || submitting}
                    className="flex-1"
                  >
                    {submitting ? 'Wird gespeichert …' : 'Ausleihe erfassen'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setStep(2)}
                    disabled={submitting}
                    className="flex-1"
                  >
                    Zurück
                  </Button>
                </div>
              </div>
            </div>
          )
        ) : (
          <div className="text-center py-12 space-y-3">
            <p className="text-sm text-muted-foreground">
              Dieser Schritt braucht die Auswahl aus Schritt 1 und 2.
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
