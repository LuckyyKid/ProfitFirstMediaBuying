import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import {
  getMetaDashboardConfig,
  updateAnomalyConfig,
} from "@/lib/metaDashboardApi";

interface Props {
  clientCode: string;
}

type ClientType = "ecom" | "local";
type ConversionMetric = "purchases" | "leads";

const DEFAULTS = {
  client_type: "ecom" as ClientType,
  daily_budget_planned: 100,
  conversion_metric: "purchases" as ConversionMetric,
  target_cpl_or_roas: 2.0,
  anomaly_checks_enabled: true,
};

export const MetaAdsAnomalyConfigCard = ({ clientCode }: Props) => {
  const [loading, setLoading] = useState(true);
  const [hasIntegration, setHasIntegration] = useState(false);
  const [saving, setSaving] = useState(false);

  const [clientType, setClientType] = useState<ClientType>(DEFAULTS.client_type);
  const [dailyBudget, setDailyBudget] = useState<string>(String(DEFAULTS.daily_budget_planned));
  const [conversionMetric, setConversionMetric] =
    useState<ConversionMetric>(DEFAULTS.conversion_metric);
  const [targetCplOrRoas, setTargetCplOrRoas] =
    useState<string>(String(DEFAULTS.target_cpl_or_roas));
  const [enabled, setEnabled] = useState(DEFAULTS.anomaly_checks_enabled);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getMetaDashboardConfig(clientCode)
      .then((r) => {
        if (cancelled) return;
        if (r.config) {
          setHasIntegration(true);
          setClientType((r.config.client_type as ClientType) ?? DEFAULTS.client_type);
          setDailyBudget(String(r.config.daily_budget_planned ?? DEFAULTS.daily_budget_planned));
          setConversionMetric(
            (r.config.conversion_metric as ConversionMetric) ?? DEFAULTS.conversion_metric,
          );
          setTargetCplOrRoas(
            String(r.config.target_cpl_or_roas ?? DEFAULTS.target_cpl_or_roas),
          );
          setEnabled(r.config.anomaly_checks_enabled ?? DEFAULTS.anomaly_checks_enabled);
        } else {
          setHasIntegration(false);
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

  const onSave = async () => {
    const budget = Number(dailyBudget);
    const target = Number(targetCplOrRoas);
    if (!Number.isFinite(budget) || budget < 0) {
      toast.error("Budget quotidien invalide");
      return;
    }
    if (!Number.isFinite(target) || target < 0) {
      toast.error("Cible CPL/ROAS invalide");
      return;
    }
    setSaving(true);
    try {
      await updateAnomalyConfig({
        client_code: clientCode,
        client_type: clientType,
        daily_budget_planned: budget,
        conversion_metric: conversionMetric,
        target_cpl_or_roas: target,
        anomaly_checks_enabled: enabled,
      });
      toast.success("Paramètres d'anomalies enregistrés");
    } catch (e) {
      toast.error((e as Error).message || "Échec de l'enregistrement");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card className="p-6 glass-card">
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement…
        </div>
      </Card>
    );
  }

  if (!hasIntegration) {
    return (
      <Card className="p-4 glass-card">
        <div className="flex items-start gap-2 text-sm">
          <AlertTriangle className="h-4 w-4 text-[#f5b74e] mt-0.5 shrink-0" />
          <p className="text-muted-foreground">
            Active d'abord l'intégration Meta Ads ci-dessus. Les checks d'anomalie ne
            fonctionnent que si un Google Sheet est connecté.
          </p>
        </div>
      </Card>
    );
  }

  const targetLabel =
    clientType === "ecom" ? "ROAS cible (ex : 2.5 = 2.50 $ revenu par 1 $ dépensé)" : "CPL cible ($)";

  return (
    <Card className="p-4 glass-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Check d'anomalies quotidien</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Le système vérifie chaque matin (après le refresh Porter) le spend et le tracking
            d'hier, et envoie une alerte Slack si quelque chose cloche.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Switch checked={enabled} onCheckedChange={setEnabled} disabled={saving} />
          <Label className="text-xs text-muted-foreground">Activé</Label>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Type de client</Label>
          <div className="flex gap-2">
            {(["ecom", "local"] as ClientType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setClientType(t);
                  // Nudge sensible defaults so ecom/local don't mix up the target unit.
                  if (t === "ecom" && conversionMetric === "leads") {
                    setConversionMetric("purchases");
                  }
                  if (t === "local" && conversionMetric === "purchases") {
                    setConversionMetric("leads");
                  }
                }}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs border transition ${
                  clientType === t
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/50 bg-muted/10 text-muted-foreground hover:border-border"
                }`}
              >
                {t === "ecom" ? "E-commerce (ROAS)" : "Local / leads (CPL)"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Métrique de conversion Porter</Label>
          <div className="flex gap-2">
            {(["purchases", "leads"] as ConversionMetric[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setConversionMetric(m)}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs border transition ${
                  conversionMetric === m
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border/50 bg-muted/10 text-muted-foreground hover:border-border"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Budget quotidien planifié ($)</Label>
          <Input
            type="number"
            min="0"
            step="1"
            value={dailyBudget}
            onChange={(e) => setDailyBudget(e.target.value)}
            placeholder="100"
          />
          <p className="text-[11px] text-muted-foreground">
            Alerte S1 si spend = 0 $ · S1 si &gt; 140 % · S2 si &lt; 50 %.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">{targetLabel}</Label>
          <Input
            type="number"
            min="0"
            step="0.1"
            value={targetCplOrRoas}
            onChange={(e) => setTargetCplOrRoas(e.target.value)}
            placeholder={clientType === "ecom" ? "2.5" : "15"}
          />
          <p className="text-[11px] text-muted-foreground">
            Informationnel S3 si dérive &gt; 50 % vs moyenne 7j.
          </p>
        </div>
      </div>

      <div className="flex justify-end">
        <Button size="sm" onClick={onSave} disabled={saving}>
          {saving ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer
        </Button>
      </div>
    </Card>
  );
};
