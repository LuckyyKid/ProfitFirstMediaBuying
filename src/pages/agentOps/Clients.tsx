import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import type { Client } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([]);
  const [err, setErr] = useState<string>();
  useEffect(() => { tdia.listClients().then(setClients).catch(e => setErr(e.message)); }, []);
  return (
    <div className="space-y-6">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="Clients" subtitle="From api.tdiaconnect.ca" right={
        <Button asChild><Link to="/admin/ops/clients/new"><UserPlus className="h-4 w-4 mr-1" /> New client</Link></Button>
      } />
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        {clients.map(c => (
          <Link key={c.id} to={`/admin/ops/clients/${c.id}`}>
            <Card className="glass-card p-4 hover:border-primary/40 transition">
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-muted-foreground mt-1">{c.id}</div>
              {c.website && <div className="text-xs mt-1">{c.website}</div>}
              {c.vertical && <div className="text-[11px] text-muted-foreground mt-1">{c.vertical}</div>}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
