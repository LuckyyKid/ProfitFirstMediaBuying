// Profil client — liste tous les audits (GET /clients/:slug/audits) et permet
// d'en lancer un nouveau (prefill du nom via ?client=).

import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import type { AuditSummary } from "@/agentOps/types";
import { STALL_THRESHOLD_MS } from "@/agentOps/types";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import { statusTone, shortStatusLabel, toneClasses, toneDotClass } from "@/agentOps/humanStatus";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

function effectiveState(r: AuditSummary, now: number) {
  if (r.state === "completed" || r.state === "failed" || r.state === "queued") return r.state;
  if (r.last_step_ts && now - r.last_step_ts * 1000 > STALL_THRESHOLD_MS) return "stalled";
  return r.state;
}

function timeAgoTs(ts: number, now: number): string {
  if (!ts) return "—";
  const diff = Math.max(0, now - ts * 1000);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `il y a ${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `il y a ${m}min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `il y a ${h}h`;
  return `il y a ${Math.floor(h / 24)}j`;
}

export default function ClientProfile() {
  const { clientId = "" } = useParams();
  const slug = decodeURIComponent(clientId);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 5_000);
    return () => clearInterval(t);
  }, []);

  const clientsQ = useQuery({
    queryKey: ["clients"],
    queryFn: () => tdia.listClients(),
  });
  const client = clientsQ.data?.find((c) => c.slug === slug);

  const auditsQ = useQuery({
    queryKey: ["client-audits-list", slug],
    queryFn: () => tdia.listClientAudits(slug),
    refetchInterval: 5_000,
  });

  const err = auditsQ.error instanceof Error ? auditsQ.error.message : undefined;
  const audits = auditsQ.data ?? [];

  return (
    <div className="max-w-4xl mx-auto px-6 py-6 space-y-6">
      <Link
        to="/admin/ops/clients"
        className="inline-flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Retour aux clients
      </Link>

      {err && <BackendErrorBanner message={err} />}

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight truncate">{client?.name ?? slug}</h1>
          <div className="text-[11px] font-mono text-muted-foreground mt-1">{slug}</div>
          {client?.website && (
            <a
              href={client.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] text-[#9ec8ff] hover:text-[#c8d2e4] mt-2"
            >
              <Globe className="h-3 w-3" /> {client.website.replace(/^https?:\/\//, "")}
            </a>
          )}
        </div>
        <Button asChild>
          <Link to={`/admin/ops/new?client=${encodeURIComponent(client?.name ?? slug)}`}>
            <Plus className="h-4 w-4 mr-1.5" /> Nouvel audit
          </Link>
        </Button>
      </div>

      <section>
        <h2 className="font-mono text-[10px] font-semibold uppercase tracking-[0.25em] text-[#9ec8ff]">
          Historique
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          {audits.length === 0 ? "Aucun audit encore." : `${audits.length} run${audits.length > 1 ? "s" : ""}`}
        </p>

        <div className="space-y-2 mt-3">
          {audits.map((r) => {
            const state = effectiveState(r, now);
            const tone = statusTone(state);
            return (
              <Link
                key={r.audit_id}
                to={`/admin/ops/run/${encodeURIComponent(r.client)}/${encodeURIComponent(r.audit_id)}`}
                className="block rounded-lg border border-[rgba(148,170,215,0.12)] bg-[rgba(255,255,255,0.02)] hover:border-[rgba(77,159,255,0.3)] hover:bg-[rgba(77,159,255,0.03)] transition-colors"
              >
                <div className="px-4 py-3 flex items-center gap-4">
                  <span className={cn("h-2 w-2 rounded-full shrink-0", toneDotClass(tone))} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <div className="font-mono text-sm truncate">{r.audit_id}</div>
                      <Badge variant="outline" className={cn("text-[9px] uppercase shrink-0", toneClasses(tone))}>
                        {shortStatusLabel(state)}
                      </Badge>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5 font-mono flex flex-wrap gap-x-3">
                      <span>{r.steps_done}/{r.steps_total} étapes</span>
                      {r.steps_error > 0 && <span className="text-[hsl(var(--bad))]">· {r.steps_error} erreur{r.steps_error > 1 ? "s" : ""}</span>}
                      {r.last_step_ts ? <span>· {timeAgoTs(r.last_step_ts, now)}</span> : null}
                    </div>
                  </div>
                  <div className="w-32 shrink-0">
                    <div className="h-[3px] rounded-full bg-[rgba(148,170,215,0.12)] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[linear-gradient(90deg,#4d9fff,#2f6bff)]"
                        style={{ width: `${r.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
