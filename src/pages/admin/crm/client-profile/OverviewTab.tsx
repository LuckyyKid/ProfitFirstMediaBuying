import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

const FIELDS: [string, string, string?][] = [
  ["company_name", "Entreprise"], ["client_code", "Code"], ["industry", "Industrie"],
  ["business_model", "Business model"], ["website_url", "Website"],
  ["main_contact_name", "Contact"], ["main_contact_email", "Email"], ["main_contact_phone", "Téléphone"],
  ["am_owner_name", "AM Owner"], ["offer_sold", "Offre"],
  ["lead_source", "Lead source"],
  ["current_phase", "Phase"], ["risk_level", "Risque"],
  ["closing_date", "Closing", "date"], ["launch_target_date", "Launch target", "date"],
  ["deal_value", "Deal value", "number"], ["monthly_retainer", "Retainer mensuel", "number"],
  ["slack_channel", "Slack"], ["drive_folder_url", "Drive"], ["hub_url", "Hub URL"],
];

export function OverviewTab({ client, reload }: { client: any; reload: () => void }) {
  const [c, setC] = useState(client);
  useEffect(() => setC(client), [client]);
  const save = async () => {
    const { id, created_at, updated_at, ...patch } = c;
    const { error } = await supabase.from("crm_clients").update(patch).eq("id", client.id);
    if (error) return toast.error(error.message);
    toast.success("Client mis à jour");
    reload();
  };
  return (
    <Card className="p-4 border-border shadow-none">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {FIELDS.map(([k, label, type]) => (
          <div key={k}>
            <Label className="text-xs">{label}</Label>
            <Input
              type={type ?? "text"}
              value={c[k] ?? ""}
              onChange={(e) =>
                setC({
                  ...c,
                  [k]: type === "number" ? (e.target.value === "" ? null : Number(e.target.value)) : e.target.value,
                })
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <Button onClick={save}>Enregistrer</Button>
      </div>
    </Card>
  );
}
