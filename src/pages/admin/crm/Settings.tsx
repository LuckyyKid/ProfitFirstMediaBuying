import { Card } from "@/components/ui/card";
import { SectionHeader } from "@/crm/ui";

export default function Settings() {
  return (
    <div>
      <SectionHeader title="Settings" description="Configuration CRM" />
      <Card className="p-5">
        <p className="text-sm text-muted-foreground">
          Settings à venir en V2 : gestion des rôles (Admin / Account Manager / Strategy Lead / Viewer),
          configuration ClickUp (workspace, list IDs, token), templates de statuts, etc.
        </p>
      </Card>
    </div>
  );
}
