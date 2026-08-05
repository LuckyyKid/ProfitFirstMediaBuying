// Clients — liste construite a partir de GET /clients (scan du dossier data/clients).
// Chaque carte pointe vers /admin/ops/clients/:slug (historique des runs).

import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { tdia } from "@/agentOps/service";
import { BackendErrorBanner } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Globe, Plus, Users } from "lucide-react";

export default function Clients() {
  const q = useQuery({
    queryKey: ["clients"],
    queryFn: () => tdia.listClients(),
    refetchInterval: 30_000,
  });
  const err = q.error instanceof Error ? q.error.message : undefined;
  const clients = q.data ?? [];

  return (
    <div className="max-w-6xl mx-auto px-6 py-6 space-y-6">
      {err && <BackendErrorBanner message={err} />}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length === 0
              ? "Aucun client — un client apparait ici des qu'un audit est lance."
              : `${clients.length} client${clients.length > 1 ? "s" : ""} avec au moins un audit.`}
          </p>
        </div>
        <Button asChild>
          <Link to="/admin/ops/new"><Plus className="h-4 w-4 mr-1.5" /> Nouvel audit</Link>
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card className="glass-card p-10 text-center">
          <Users className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
          <div className="text-sm text-muted-foreground">
            Les clients sont crees automatiquement au premier audit.
          </div>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {clients.map((c) => (
            <Link key={c.slug} to={`/admin/ops/clients/${encodeURIComponent(c.slug)}`}>
              <Card className="glass-card p-4 hover:border-[rgba(77,159,255,0.3)] hover:bg-[rgba(77,159,255,0.03)] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{c.name}</div>
                    <div className="text-[11px] font-mono text-muted-foreground truncate mt-0.5">{c.slug}</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
                {c.website && (
                  <div className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-[#9ec8ff] truncate max-w-full">
                    <Globe className="h-3 w-3 shrink-0" />
                    <span className="truncate">{c.website.replace(/^https?:\/\//, "")}</span>
                  </div>
                )}
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground font-mono">
                  <span>{c.audits_count} audit{c.audits_count > 1 ? "s" : ""}</span>
                  {c.latest_audit_id && <span>· dernier : {c.latest_audit_id}</span>}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
