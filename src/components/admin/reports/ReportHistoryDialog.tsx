// Historique des rapports pour le client sélectionné.
// Liste (report-list) → clic → détail complet (report-get) rendu via
// ClientReportView en mode "live" (ce que le client voit dans son portail).

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  History,
  Loader2,
  FileText,
  CheckCircle2,
  FileWarning,
  Archive,
  ArchiveRestore,
  Download,
  Send,
  Trash2,
  Rocket,
} from "lucide-react";
import { ClientReportView } from "./ClientReportView";
import { publishBlocker } from "@/lib/reportNarrative";
import type {
  InputsAm,
  PayloadSysteme,
  ReportNarrative,
} from "@/lib/reportNarrative";
import { downloadReportPdf, resendReportEmail } from "@/lib/reportActions";

interface Props {
  clientCode: string | null;
  clientLabel?: string | null;
}

interface ReportMeta {
  id: string;
  client_code: string;
  periode_debut: string;
  periode_fin: string;
  version: number;
  status: "draft" | "published" | "archived";
  generated_at: string | null;
  published_at: string | null;
  published_by: string | null;
}

interface ReportFull extends ReportMeta {
  payload_systeme: PayloadSysteme;
  inputs_am: unknown;
  rapport: ReportNarrative;
}

const STATUS_META: Record<
  ReportMeta["status"],
  { label: string; tone: string; Icon: typeof CheckCircle2 }
> = {
  published: {
    label: "Publié",
    tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/40",
    Icon: CheckCircle2,
  },
  draft: {
    label: "Brouillon",
    tone: "bg-yellow-500/15 text-yellow-500 border-yellow-500/40",
    Icon: FileWarning,
  },
  archived: {
    label: "Archivé",
    tone: "bg-muted text-muted-foreground border-border/50",
    Icon: Archive,
  },
};

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-CA");
}

function isFunctionMissing(err: unknown): boolean {
  const msg = ((err as Error)?.message ?? "").toLowerCase();
  return (
    msg.includes("not found") ||
    msg.includes("404") ||
    msg.includes("failed to send a request")
  );
}

export function ReportHistoryDialog({ clientCode, clientLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState<ReportMeta[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [backendMissing, setBackendMissing] = useState(false);

  const [detail, setDetail] = useState<ReportFull | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [resending, setResending] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [publishing, setPublishing] = useState(false);

  const load = useCallback(async () => {
    if (!clientCode) return;
    setLoading(true);
    setErr(null);
    try {
      const { data, error } = await supabase.functions.invoke("report-list", {
        body: { client_code: clientCode, limit: 100 },
      });
      if (error) throw error;
      setReports((data?.reports ?? []) as ReportMeta[]);
      setBackendMissing(false);
    } catch (e) {
      if (isFunctionMissing(e)) {
        setBackendMissing(true);
        setReports([]);
      } else {
        setErr((e as Error).message || "Impossible de charger l'historique.");
        setReports([]);
      }
    } finally {
      setLoading(false);
    }
  }, [clientCode]);

  useEffect(() => {
    if (open) {
      setDetail(null);
      load();
    }
  }, [open, load]);

  const openDetail = async (id: string) => {
    setDetailLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("report-get", {
        body: { id },
      });
      if (error) throw error;
      const full = data?.report as ReportFull | undefined;
      if (!full) throw new Error("Rapport introuvable.");
      setDetail(full);
    } catch (e) {
      toast.error((e as Error).message || "Impossible d'ouvrir ce rapport.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDownload = async () => {
    if (!detail) return;
    setDownloading(true);
    try {
      await downloadReportPdf({
        reportId: detail.id,
        clientLabel: clientLabel ?? clientCode ?? "Client",
        periodeDebut: detail.periode_debut,
        periodeFin: detail.periode_fin,
      });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setDownloading(false);
    }
  };

  const handleResend = async () => {
    if (!detail) return;
    const ok = window.confirm(
      `Renvoyer ce rapport à ${clientLabel ?? clientCode ?? "ce client"} ? Le PDF sera régénéré au design actuel puis expédié immédiatement en pièce jointe.`,
    );
    if (!ok) return;
    setResending(true);
    try {
      const res = await resendReportEmail({ reportId: detail.id });
      toast.success(
        res.pdfRegenerated
          ? `PDF régénéré et envoyé à ${res.recipient}`
          : `Courriel envoyé à ${res.recipient}`,
      );
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setResending(false);
    }
  };

  // Passe le statut à archived (masqué côté portail client, conservé en DB)
  // ou revient à published. Aucun contenu n'est effacé, seule la visibilité
  // change — le portail filtre déjà sur status === "published".
  // Cas particulier : un brouillon archivé est retiré de la liste admin
  // (soft-delete), pas vraiment "archivé au sens client visible/caché".
  const setStatus = async (nextStatus: "archived" | "published") => {
    if (!detail) return;
    const fromDraft = detail.status === "draft" && nextStatus === "archived";
    const isArchive = nextStatus === "archived";
    const confirmMsg = fromDraft
      ? `Supprimer ce brouillon ? Il disparaîtra de la liste, mais reste conservé en base au cas où.`
      : isArchive
      ? `Archiver ce rapport ? Il ne sera plus visible dans le portail du client, mais reste conservé ici. Tu peux le republier plus tard.`
      : `Republier ce rapport ? Il redeviendra visible dans le portail du client.`;
    const ok = window.confirm(confirmMsg);
    if (!ok) return;
    setArchiving(true);
    try {
      const { error } = await supabase.functions.invoke("report-archive", {
        body: { id: detail.id, status: nextStatus },
      });
      if (error) throw error;
      toast.success(
        fromDraft
          ? "Brouillon supprimé."
          : isArchive
          ? "Rapport archivé."
          : "Rapport republié.",
      );
      setDetail({ ...detail, status: nextStatus });
      // Recharge la liste pour refléter le badge à jour au retour.
      load();
    } catch (e) {
      toast.error(
        isFunctionMissing(e)
          ? "L'edge function report-archive n'est pas encore déployée. Contacte l'équipe backend."
          : (e as Error).message || "Impossible de changer le statut.",
      );
    } finally {
      setArchiving(false);
    }
  };

  // Publie un brouillon directement depuis l'historique — utile quand l'AM
  // a sauvegardé un brouillon puis fermé le wizard. On revalide le blocker
  // client (rapport rouge sans action) avant de laisser partir la notif.
  const handlePublishDraft = async () => {
    if (!detail || detail.status !== "draft") return;
    const blocker = publishBlocker(detail.payload_systeme, detail.inputs_am as InputsAm);
    if (blocker) {
      toast.error(blocker);
      return;
    }
    const ok = window.confirm(
      `Publier ce brouillon maintenant ? Le client verra le rapport et recevra une notification par courriel + Slack.`,
    );
    if (!ok) return;
    setPublishing(true);
    const t = toast.loading("Publication en cours…");
    try {
      const { data, error } = await supabase.functions.invoke("report-publish", {
        body: { id: detail.id },
      });
      if (error) throw error;
      toast.dismiss(t);
      const notifs = data?.notifications as
        | { email?: { sent: boolean }; slack?: { sent: boolean } }
        | undefined;
      const emailOk = notifs?.email?.sent;
      const slackOk = notifs?.slack?.sent;
      toast.success(
        `Rapport publié. Notifications : ${emailOk ? "email ✓" : "email ✗"} · ${slackOk ? "Slack ✓" : "Slack ✗"}`,
      );
      setDetail({
        ...detail,
        status: "published",
        published_at: new Date().toISOString(),
      });
      load();
    } catch (e) {
      toast.dismiss(t);
      toast.error(
        isFunctionMissing(e)
          ? "L'edge function report-publish n'est pas déployée."
          : (e as Error).message || "Publication impossible.",
      );
    } finally {
      setPublishing(false);
    }
  };

  const stats = reports
    ? {
        total: reports.length,
        published: reports.filter((r) => r.status === "published").length,
        draft: reports.filter((r) => r.status === "draft").length,
      }
    : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {clientCode && (
        <DialogTrigger asChild>
          <Button size="sm" variant="ghost" className="gap-1.5">
            <History className="h-4 w-4" />
            Historique
          </Button>
        </DialogTrigger>
      )}

      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        {detail ? (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetail(null)}
                  className="gap-1"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Retour à la liste
                </Button>
                {detail.status === "published" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDownload}
                      disabled={downloading || resending || archiving}
                      className="gap-1.5"
                    >
                      {downloading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Télécharger le PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleResend}
                      disabled={downloading || resending || archiving}
                      className="gap-1.5"
                    >
                      {resending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Renvoyer par courriel
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus("archived")}
                      disabled={downloading || resending || archiving}
                      className="gap-1.5 text-muted-foreground hover:text-foreground"
                    >
                      {archiving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                      Archiver
                    </Button>
                  </div>
                )}
                {detail.status === "archived" && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setStatus("published")}
                    disabled={archiving}
                    className="gap-1.5"
                  >
                    {archiving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArchiveRestore className="h-4 w-4" />
                    )}
                    Republier pour le client
                  </Button>
                )}
                {detail.status === "draft" && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      onClick={handlePublishDraft}
                      disabled={publishing || archiving}
                      className="gap-1.5"
                    >
                      {publishing ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Rocket className="h-4 w-4" />
                      )}
                      Publier maintenant
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setStatus("archived")}
                      disabled={publishing || archiving}
                      className="gap-1.5 text-muted-foreground hover:text-red-500"
                    >
                      {archiving ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      Supprimer le brouillon
                    </Button>
                  </div>
                )}
              </div>
              <DialogTitle className="sr-only">Rapport détaillé</DialogTitle>
              <DialogDescription className="sr-only">
                Affichage complet du rapport tel que le client le voit dans son portail.
              </DialogDescription>
            </DialogHeader>

            <ClientReportView
              narrative={detail.rapport}
              clientLabel={clientLabel ?? clientCode ?? "Client"}
              periode={{
                debut: detail.periode_debut,
                fin: detail.periode_fin,
                nb_jours:
                  detail.payload_systeme?.periode?.nb_jours ??
                  Math.max(
                    1,
                    Math.round(
                      (new Date(detail.periode_fin).getTime() -
                        new Date(detail.periode_debut).getTime()) /
                        86_400_000,
                    ) + 1,
                  ),
              }}
              fraicheur={detail.payload_systeme?.fraicheur}
              payloadSysteme={detail.payload_systeme}
              mode="live"
            />

            <DialogFooter>
              <div className="text-[11px] text-muted-foreground">
                Version {detail.version} · {STATUS_META[detail.status].label}
                {detail.published_at && ` · Publié le ${fmtDate(detail.published_at)}`}
              </div>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Historique des rapports</DialogTitle>
              <DialogDescription>
                Tous les rapports générés pour ce client — brouillons, publiés, archivés.
                {clientLabel && (
                  <span className="block mt-1 text-foreground">
                    Client : <b>{clientLabel}</b>{" "}
                    <span className="text-muted-foreground">({clientCode})</span>
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>

            {backendMissing && (
              <div className="rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs">
                Le backend rapport n'est pas encore déployé — l'historique sera vide tant que Lovable n'a pas activé <code>report-list</code>.
              </div>
            )}
            {err && !backendMissing && (
              <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-3 text-xs text-red-500">
                {err}
              </div>
            )}

            {stats && (
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Total</div>
                  <div className="text-lg font-bold">{stats.total}</div>
                </div>
                <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Publiés</div>
                  <div className="text-lg font-bold text-emerald-500">{stats.published}</div>
                </div>
                <div className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
                  <div className="text-[10px] uppercase text-muted-foreground">Brouillons</div>
                  <div className="text-lg font-bold text-yellow-500">{stats.draft}</div>
                </div>
              </div>
            )}

            {loading && !reports && (
              <div className="text-xs text-muted-foreground py-8 text-center">
                <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                Chargement…
              </div>
            )}

            {!loading && reports && reports.length === 0 && (
              <div className="text-sm text-muted-foreground py-8 text-center">
                Aucun rapport pour ce client. Rédige-en un depuis le bouton « Rédiger le rapport hebdo ».
              </div>
            )}

            {reports && reports.length > 0 && (
              <div className="space-y-1.5">
                {reports.map((r) => {
                  const meta = STATUS_META[r.status];
                  const Icon = meta.Icon;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => openDetail(r.id)}
                      disabled={detailLoading}
                      className="w-full text-left rounded-md border border-border/50 bg-background/40 hover:bg-muted/20 transition px-3 py-2.5 grid grid-cols-12 gap-2 items-center"
                    >
                      <div className="col-span-1">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="col-span-5">
                        <div className="text-sm font-medium">
                          {r.periode_debut} → {r.periode_fin}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          Version {r.version}
                          {r.published_at
                            ? ` · Publié le ${fmtDate(r.published_at)}`
                            : r.generated_at
                            ? ` · Généré le ${fmtDate(r.generated_at)}`
                            : ""}
                        </div>
                      </div>
                      <div className="col-span-3">
                        <Badge variant="outline" className={`text-[10px] gap-1 ${meta.tone}`}>
                          <Icon className="h-3 w-3" />
                          {meta.label}
                        </Badge>
                      </div>
                      <div className="col-span-3 text-right text-[11px] text-muted-foreground">
                        Ouvrir →
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
