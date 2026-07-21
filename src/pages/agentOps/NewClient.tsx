import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { tdia } from "@/agentOps/service";
import { pickRunId } from "@/agentOps/runId";
import { WORKFLOWS } from "@/agentOps/types";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function NewClient() {
  const nav = useNavigate();
  const [form, setForm] = useState({ id: "", name: "", website: "", vertical: "ecommerce_product" });
  const [workflow, setWorkflow] = useState<string>("full-prelaunch");
  const [mode, setMode] = useState<string>("production");
  const [err, setErr] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(launch: boolean) {
    setBusy(true); setErr(undefined);
    try {
      const payload: Record<string, unknown> = { name: form.name, website: form.website, vertical: form.vertical };
      if (form.id) payload.client_id = form.id;
      const c = await tdia.createClient(payload);
      const clientId = (c as { id?: string }).id || form.id;
      if (launch && clientId) {
        const run = await tdia.createRun(clientId, { workflow, mode });
        const runId = pickRunId(run);
        if (!runId) throw new Error(`Backend did not return a valid run id (got: ${JSON.stringify(run)})`);
        nav(`/admin/ops/workflow?id=${runId}`);
      } else {
        nav(`/admin/ops/clients/${clientId}`);
      }
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="New Client" subtitle="Create a client and optionally start a pre-launch run." />
      <Card className="glass-card p-5 space-y-4">
        <div><Label>Client ID (slug)</Label><Input value={form.id} onChange={e => setForm({...form, id: e.target.value})} placeholder="acme-corp" /></div>
        <div><Label>Company name</Label><Input value={form.name} onChange={e => setForm({...form, name: e.target.value})} /></div>
        <div><Label>Website</Label><Input value={form.website} onChange={e => setForm({...form, website: e.target.value})} placeholder="https://example.com" /></div>
        <div><Label>Vertical</Label><Input value={form.vertical} onChange={e => setForm({...form, vertical: e.target.value})} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Workflow</Label>
            <Select value={workflow} onValueChange={setWorkflow}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{WORKFLOWS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={setMode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="production">production</SelectItem><SelectItem value="validation">validation</SelectItem></SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          <Button variant="outline" onClick={() => submit(false)} disabled={busy}>Create only</Button>
          <Button onClick={() => submit(true)} disabled={busy}>Create & launch</Button>
        </div>
      </Card>
    </div>
  );
}
