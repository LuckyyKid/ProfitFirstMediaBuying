import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertCircle,
  Check,
  Copy,
  ExternalLink,
  Loader2,
  Power,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import {
  deleteMetaDashboardConfig,
  extractSheetIdFromUrl,
  getMetaDashboardConfig,
  testMetaDashboardSheet,
  upsertMetaDashboardConfig,
  type MetaDashboardConfig,
  type TestSheetResult,
} from "@/lib/metaDashboardApi";

const SERVICE_ACCOUNT_EMAIL = "lovable-sheets@even-arc-478621-b0.iam.gserviceaccount.com";

interface Props {
  clientCode: string;
}

export const MetaAdsIntegrationCard = ({ clientCode }: Props) => {
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState<MetaDashboardConfig | null>(null);
  const [urlInput, setUrlInput] = useState("");
  const [tabName, setTabName] = useState("Sheet1");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<TestSheetResult | null>(null);

  const detectedSheetId = extractSheetIdFromUrl(urlInput);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMetaDashboardConfig(clientCode)
      .then((r) => {
        if (cancelled) return;
        setConfig(r.config);
        if (r.config) {
          setUrlInput(`https://docs.google.com/spreadsheets/d/${r.config.google_sheet_id}/edit`);
          setTabName(r.config.tab_name || "Sheet1");
        }
      })
      .catch((e) => {
        if (!cancelled) toast.error(e.message || "Impossible de charger la configuration");
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [clientCode]);

  const copyServiceAccount = async () => {
    try {
      await navigator.clipboard.writeText(SERVICE_ACCOUNT_EMAIL);
      toast.success("Email copié");
    } catch {
      toast.error("Impossible de copier — sélectionne le texte manuellement");
    }
  };

  const onTest = async () => {
    if (!detectedSheetId) {
      toast.error("URL invalide — colle le lien complet du Google Sheet");
      return;
    }
    setTesting(true);
    setTestResult(null);
    try {
      const r = await testMetaDashboardSheet({
        google_sheet_id: detectedSheetId,
        tab_name: tabName.trim() || "Sheet1",
      });
      setTestResult(r);
      if (r.ok === true) {
        toast.success(`Connexion OK — ${r.row_count_estimate} lignes détectées`);
      } else {
        toast.error(r.error);
      }
    } catch (e) {
      toast.error((e as Error).message || "Échec du test");
    } finally {
      setTesting(false);
    }
  };

  const onSave = async () => {
    if (!detectedSheetId) return;
    setSaving(true);
    try {
      const r = await upsertMetaDashboardConfig({
        client_code: clientCode,
        google_sheet_id: detectedSheetId,
        tab_name: tabName.trim() || "Sheet1",
        active: true,
      });
      setConfig(r.config);
      toast.success("Intégration Meta Ads activée");
    } catch (e) {
      toast.error((e as Error).message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  const onToggleActive = async (next: boolean) => {
    if (!config) return;
    setSaving(true);
    try {
      const r = await upsertMetaDashboardConfig({
        client_code: clientCode,
        google_sheet_id: config.google_sheet_id,
        tab_name: config.tab_name,
        active: next,
      });
      setConfig(r.config);
      toast.success(next ? "Intégration réactivée" : "Intégration désactivée");
    } catch (e) {
      toast.error((e as Error).message || "Échec de la mise à jour");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async () => {
    if (!config) return;
    if (
      !confirm(
        "Supprimer l'intégration Meta Ads de ce client ? Le dashboard ne sera plus visible dans son portail.",
      )
    )
      return;
    setSaving(true);
    try {
      await deleteMetaDashboardConfig(clientCode);
      setConfig(null);
      setUrlInput("");
      setTabName("Sheet1");
      setTestResult(null);
      toast.success("Intégration supprimée");
    } catch (e) {
      toast.error((e as Error).message || "Échec de la suppression");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 glass-card">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la configuration…
        </div>
      </Card>
    );
  }

  const canSave =
    !!detectedSheetId &&
    testResult?.ok === true &&
    (!config ||
      config.google_sheet_id !== detectedSheetId ||
      config.tab_name !== (tabName.trim() || "Sheet1"));

  const testFailure = testResult && testResult.ok === false ? testResult : null;
  const testSuccess = testResult && testResult.ok === true ? testResult : null;

  return (
    <div className="space-y-4">
      {config && (
        <Card className="p-4 glass-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs border ${
                    config.active
                      ? "border-[rgba(122,232,180,0.4)] bg-[rgba(122,232,180,0.08)] text-[hsl(var(--good))]"
                      : "border-border/50 bg-muted/20 text-muted-foreground"
                  }`}
                >
                  {config.active ? <Check className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                  {config.active ? "Actif" : "Désactivé"}
                </span>
                <span className="text-xs text-muted-foreground">
                  Onglet <span className="font-mono">{config.tab_name}</span>
                </span>
              </div>
              <a
                href={`https://docs.google.com/spreadsheets/d/${config.google_sheet_id}/edit`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-primary hover:underline inline-flex items-center gap-1 mt-1"
              >
                Ouvrir le Sheet <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  checked={config.active}
                  onCheckedChange={onToggleActive}
                  disabled={saving}
                />
                <Label className="text-xs text-muted-foreground">Actif</Label>
              </div>
              <Button variant="ghost" size="sm" onClick={onDelete} disabled={saving}>
                <Trash2 className="h-4 w-4 mr-1" /> Supprimer
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="p-4 glass-card space-y-4">
        <div>
          <h3 className="text-sm font-medium">
            {config ? "Modifier la source de données" : "Connecter un Google Sheet Porter Metrics"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Le Sheet doit être partagé (lecture ou édition) avec le compte de service ci-dessous
            avant de tester la connexion.
          </p>
        </div>

        <div className="rounded-md border border-border/40 bg-muted/10 p-3 flex items-center gap-2">
          <code className="text-xs flex-1 truncate">{SERVICE_ACCOUNT_EMAIL}</code>
          <Button variant="outline" size="sm" onClick={copyServiceAccount}>
            <Copy className="h-3 w-3 mr-1" /> Copier
          </Button>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">URL du Google Sheet</Label>
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/…/edit"
            value={urlInput}
            onChange={(e) => {
              setUrlInput(e.target.value);
              setTestResult(null);
            }}
          />
          {urlInput && !detectedSheetId && (
            <p className="text-xs text-[hsl(var(--bad))]">
              URL invalide — le lien doit contenir <code>/spreadsheets/d/…</code>
            </p>
          )}
          {detectedSheetId && (
            <p className="text-xs text-muted-foreground">
              ID détecté : <span className="font-mono">{detectedSheetId}</span>
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">
            Nom de l'onglet (par défaut : Sheet1)
          </Label>
          <Input
            value={tabName}
            onChange={(e) => {
              setTabName(e.target.value);
              setTestResult(null);
            }}
            placeholder="Sheet1"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onTest}
            disabled={!detectedSheetId || testing}
          >
            {testing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Check className="h-4 w-4 mr-2" />
            )}
            Tester la connexion
          </Button>
          <Button size="sm" onClick={onSave} disabled={!canSave || saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : null}
            {config ? "Enregistrer les modifications" : "Activer l'intégration"}
          </Button>
        </div>

        {testFailure && (
          <div className="rounded-md border border-[hsl(var(--bad))]/40 bg-[hsl(var(--bad))]/5 p-3 text-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-[hsl(var(--bad))] mt-0.5 shrink-0" />
              <div className="space-y-2 min-w-0">
                <p className="text-[hsl(var(--bad))]">{testFailure.error}</p>
                {testFailure.reason === "not_shared" && (
                  <p className="text-xs text-muted-foreground">
                    Ouvre le Sheet → <strong>Partager</strong> → colle{" "}
                    <code>{SERVICE_ACCOUNT_EMAIL}</code> → <strong>Lecteur</strong> → Envoyer.
                    Puis relance le test.
                  </p>
                )}
                {testFailure.reason === "invalid_id" && (
                  <p className="text-xs text-muted-foreground">
                    Vérifie que l'URL est bien celle d'un Google Sheet.
                  </p>
                )}
                {testFailure.reason === "not_found" && (
                  <p className="text-xs text-muted-foreground">
                    Le Sheet n'existe pas ou l'onglet <code>{tabName}</code> est introuvable.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {testSuccess && (
          <div className="rounded-md border border-[hsl(var(--good))]/40 bg-[hsl(var(--good))]/5 p-3 text-sm">
            <div className="flex items-start gap-2">
              <Check className="h-4 w-4 text-[hsl(var(--good))] mt-0.5 shrink-0" />
              <div className="space-y-2 min-w-0">
                <p className="text-[hsl(var(--good))]">
                  Connexion OK — {testSuccess.row_count_estimate} lignes détectées.
                </p>
                <div className="text-xs text-muted-foreground">
                  <div className="font-medium mb-1">Colonnes détectées :</div>
                  <div className="flex flex-wrap gap-1">
                    {testSuccess.headers.slice(0, 20).map((h) => (
                      <span
                        key={h}
                        className="inline-block px-1.5 py-0.5 rounded bg-muted/40 border border-border/40 text-[10px]"
                      >
                        {h}
                      </span>
                    ))}
                    {testSuccess.headers.length > 20 && (
                      <span className="text-[10px]">
                        +{testSuccess.headers.length - 20} autres
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
};
