import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Download, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { MetaAdsDashboard } from "@/components/portal/MetaAdsDashboard";
import { fetchMetaDashboardData } from "@/lib/metaDashboardApi";

type Period = "7j" | "30j" | "90j";

const PERIOD_LABEL: Record<Period, string> = {
  "7j": "7 derniers jours",
  "30j": "30 derniers jours",
  "90j": "90 derniers jours",
};

function periodToDates(p: Period): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  const days = p === "7j" ? 7 : p === "30j" ? 30 : 90;
  from.setDate(to.getDate() - (days - 1));
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { from: iso(from), to: iso(to) };
}

async function readServerError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.text === "function") {
    try {
      const raw = await ctx.text();
      try {
        const parsed = JSON.parse(raw) as { error?: string; message?: string };
        return parsed.error ?? parsed.message ?? raw;
      } catch {
        return raw;
      }
    } catch {
      // ignore
    }
  }
  return (error as Error)?.message || "erreur inconnue";
}

interface Props {
  clientCode: string;
}

export const MetaAdsReportSender = ({ clientCode }: Props) => {
  const [period, setPeriod] = useState<Period>("30j");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState<"idle" | "downloading" | "sending">("idle");

  const callServer = async (action: "download" | "send") => {
    const { from, to } = periodToDates(period);
    const data = await fetchMetaDashboardData({
      client_code: clientCode,
      date_from: from,
      date_to: to,
    });
    const { data: resp, error } = await supabase.functions.invoke(
      "send-meta-ads-report",
      {
        body: {
          client_code: clientCode,
          period_label: PERIOD_LABEL[period],
          action,
          data,
        },
      },
    );
    if (error) throw new Error(await readServerError(error));
    return resp as {
      pdf_base64?: string;
      filename?: string;
      email?: { sent: boolean; to?: string; redirected_to?: string; error?: string };
      slack?: { sent: boolean; channel?: string; error?: string };
    };
  };

  const download = async () => {
    if (busy !== "idle") return;
    setBusy("downloading");
    try {
      const result = await callServer("download");
      if (!result.pdf_base64 || !result.filename) throw new Error("Réponse sans PDF");
      const bytes = Uint8Array.from(atob(result.pdf_base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Rapport téléchargé");
    } catch (e) {
      toast.error(`Impossible de générer le rapport — ${(e as Error).message}`);
    } finally {
      setBusy("idle");
    }
  };

  const sendReport = async () => {
    if (busy !== "idle") return;
    setBusy("sending");
    try {
      const result = await callServer("send");
      const parts: string[] = [];
      if (result.email?.sent) {
        parts.push(
          result.email.redirected_to
            ? `email (sandbox → ${result.email.redirected_to})`
            : `email → ${result.email.to}`,
        );
      } else if (result.email?.error) {
        parts.push(`email échoué (${result.email.error})`);
      }
      if (result.slack?.sent) {
        parts.push(`Slack ${result.slack.channel ?? ""}`.trim());
      } else if (result.slack?.error) {
        parts.push(`Slack échoué (${result.slack.error})`);
      }
      toast.success(`Rapport envoyé — ${parts.join(" · ") || "sans destinataire"}`);
    } catch (e) {
      toast.error(`Envoi impossible — ${(e as Error).message}`);
    } finally {
      setBusy("idle");
    }
  };

  return (
    <Card className="p-4 glass-card space-y-4">
      <div>
        <h3 className="text-sm font-medium">Envoyer un rapport de performance</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Génère un PDF Meta Ads côté serveur (KPIs + top créatifs), envoie-le par email
          au client et poste-le dans son canal Slack dédié.
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">Période</Label>
        <div className="flex gap-2">
          {(["7j", "30j", "90j"] as Period[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-xs border transition ${
                p === period
                  ? "border-primary/40 bg-primary/10 text-primary"
                  : "border-border/50 bg-muted/10 text-muted-foreground hover:border-border"
              }`}
            >
              {PERIOD_LABEL[p]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
          Aperçu dashboard
        </Button>
        <Button variant="outline" size="sm" onClick={download} disabled={busy !== "idle"}>
          {busy === "downloading" ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-1.5" />
          )}
          Télécharger PDF
        </Button>
        <Button size="sm" onClick={sendReport} disabled={busy !== "idle"}>
          {busy === "sending" ? (
            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
          ) : (
            <Send className="h-4 w-4 mr-1.5" />
          )}
          Envoyer email + Slack
        </Button>
      </div>

      {previewOpen && (
        <PreviewOverlay
          clientCode={clientCode}
          period={period}
          onClose={() => setPreviewOpen(false)}
        />
      )}
    </Card>
  );
};

function PreviewOverlay({
  clientCode,
  period,
  onClose,
}: {
  clientCode: string;
  period: Period;
  onClose: () => void;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(6,9,16,.85)",
        backdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "12px 20px",
          borderBottom: "1px solid rgba(148,170,215,.15)",
          background: "#0b1322",
        }}
      >
        <div style={{ fontSize: 13, color: "#eef2fa", fontWeight: 500 }}>
          Aperçu dashboard — {PERIOD_LABEL[period]}
        </div>
        <div style={{ fontSize: 11, color: "#8b97ad" }}>
          Vue portail. Le PDF est généré côté serveur (données identiques).
        </div>
        <div style={{ marginLeft: "auto" }}>
          <Button size="sm" variant="ghost" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div style={{ flex: 1, overflow: "auto", background: "#060910" }}>
        <div style={{ background: "#060910" }}>
          <MetaAdsDashboard
            clientCode={clientCode}
            initialPeriod={period}
            hideAds
            hidePeriodToggle
          />
        </div>
      </div>
    </div>
  );
}
