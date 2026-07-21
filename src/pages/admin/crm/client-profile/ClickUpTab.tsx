import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ClickUpPlaceholder } from "@/crm/ui";

export function ClickUpTab({ client, reload }: { client: any; reload: () => void }) {
  const [c, setC] = useState(client);
  useEffect(() => setC(client), [client]);
  const save = async () => {
    const { error } = await supabase
      .from("crm_clients")
      .update({
        clickup_client_task_id: c.clickup_client_task_id,
        clickup_task_url: c.clickup_task_url,
        clickup_status: c.clickup_status,
      })
      .eq("id", client.id);
    if (error) return toast.error(error.message);
    toast.success("Sauvegardé");
    reload();
  };
  return (
    <Card className="p-4 border-border shadow-none">
      <h3 className="font-semibold mb-3">ClickUp Links & Sync (V2)</h3>
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div>
          <Label className="text-xs">ClickUp Client Task ID</Label>
          <Input value={c.clickup_client_task_id ?? ""} onChange={(e) => setC({ ...c, clickup_client_task_id: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">ClickUp Task URL</Label>
          <Input value={c.clickup_task_url ?? ""} onChange={(e) => setC({ ...c, clickup_task_url: e.target.value })} />
        </div>
        <div>
          <Label className="text-xs">Dernier statut sync</Label>
          <Input value={c.clickup_status ?? ""} onChange={(e) => setC({ ...c, clickup_status: e.target.value })} />
        </div>
      </div>
      <div className="flex gap-2 mb-3">
        <Button onClick={save} size="sm">Enregistrer liens</Button>
      </div>
      <div className="border-t pt-3 flex flex-wrap gap-2">
        <ClickUpPlaceholder label="Send Summary to ClickUp" />
        <ClickUpPlaceholder label="Create Execution Tickets" />
        <ClickUpPlaceholder label="Update ClickUp Status" />
        <ClickUpPlaceholder label="Pull ClickUp Comments" />
      </div>
    </Card>
  );
}
