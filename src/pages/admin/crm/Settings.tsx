import { Card } from "@/components/ui/card";
import { Settings2 } from "lucide-react";
import { TwentyPage, PageHeader } from "@/components/admin-shell";

export default function Settings() {
  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={Settings2}
        title="Settings"
        description="Configuration CRM"
      />
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <Card className="p-4 border-border shadow-none">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Settings à venir en V2 : gestion des rôles (Admin / Account Manager / Strategy Lead / Viewer),
            configuration ClickUp (workspace, list IDs, token), templates de statuts, etc.
          </p>
        </Card>
      </div>
    </TwentyPage>
  );
}
