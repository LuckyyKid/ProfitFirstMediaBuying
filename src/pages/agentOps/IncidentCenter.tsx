import { useEffect, useState } from "react";
import { tdia } from "@/agentOps/service";
import type { Incident, Remediation } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";

export default function IncidentCenter() {
  const [inc, setInc] = useState<Incident[]>([]);
  const [rem, setRem] = useState<Remediation[]>([]);
  const [err, setErr] = useState<string>();
  useEffect(() => {
    tdia.listIncidents().then(setInc).catch(e => setErr(e.message));
    tdia.listRemediations().then(setRem).catch(() => {});
  }, []);
  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="Incident Center" subtitle="Live incidents & remediations from the backend." />
      <Card className="glass-card p-5">
        <h2 className="text-sm font-semibold mb-2">Incidents</h2>
        <div className="space-y-2">{inc.map(i => (
          <div key={i.id} className="rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm">
            <div className="flex justify-between"><span className="font-medium">{i.incident_type}</span><span className="text-xs uppercase">{i.severity}</span></div>
            <div className="text-xs text-muted-foreground">{i.sanitized_diagnosis}</div>
          </div>
        ))}</div>
      </Card>
      <Card className="glass-card p-5">
        <h2 className="text-sm font-semibold mb-2">Remediations</h2>
        <div className="text-xs text-muted-foreground mb-2">Automated code patching: Deferred — manual maintenance required.</div>
        <div className="space-y-2">{rem.map(r => (
          <div key={r.id} className="rounded-md border border-border/40 bg-card/40 px-3 py-2 text-sm">
            <div className="font-medium">{r.action} (level {r.level})</div>
            <div className="text-xs text-muted-foreground">tests_passed={String(r.tests_passed)} · merged={String(r.merged)}</div>
          </div>
        ))}</div>
      </Card>
    </div>
  );
}
