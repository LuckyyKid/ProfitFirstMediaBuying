import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw, Users } from "lucide-react";
import { StatusBadge, RiskBadge } from "@/crm/ui";
import { useCrmClientsSync } from "@/crm/hooks";
import {
  TwentyPage,
  PageHeader,
  ViewBar,
  TwentyTableWrap,
  TwentyTable,
  TwentyThead,
  Th,
  TwentyRow,
  Td,
  EmptyRow,
} from "@/components/admin-shell";

export default function CrmClients() {
  const { rows, syncing, runSync } = useCrmClientsSync();
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          !q ||
          [r.company_name, r.client_code, r.industry, r.am_owner_name].some((v) =>
            (v ?? "").toLowerCase().includes(q.toLowerCase()),
          ),
      ),
    [rows, q],
  );

  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={Users}
        title="Clients"
        description="Portefeuille TDIA — synchronisé depuis les deals closés"
        actions={
          <Button
            size="sm"
            variant="ghost"
            onClick={() => runSync(true)}
            disabled={syncing}
            className="h-7 px-2 text-xs hover:bg-muted"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${syncing ? "animate-spin" : ""}`} />
            Synchroniser
          </Button>
        }
      />

      <ViewBar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Rechercher (code, entreprise, industrie, AM)…"
        total={filtered.length}
      />

      <TwentyTableWrap>
        <TwentyTable>
          <TwentyThead>
            <Th>Code</Th>
            <Th>Entreprise</Th>
            <Th>Industrie</Th>
            <Th>AM</Th>
            <Th>Phase</Th>
            <Th>Risque</Th>
            <Th>Launch</Th>
            <Th>ClickUp</Th>
            <Th className="w-16"></Th>
          </TwentyThead>
          <tbody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={9} title="Aucun client — ils apparaîtront ici automatiquement après un deal closé" />
            ) : filtered.map((r) => (
              <TwentyRow key={r.id}>
                <Td className="font-mono text-muted-foreground">{r.client_code}</Td>
                <Td className="font-medium text-foreground">{r.company_name}</Td>
                <Td>{r.industry ?? "—"}</Td>
                <Td>{r.am_owner_name ?? "—"}</Td>
                <Td><StatusBadge status={r.current_phase} /></Td>
                <Td><RiskBadge level={r.risk_level} /></Td>
                <Td className="text-muted-foreground">{r.launch_target_date ?? "—"}</Td>
                <Td>
                  {r.clickup_task_url ? (
                    <a
                      className="text-primary hover:underline"
                      href={r.clickup_task_url}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Lien
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
                <Td>
                  <div className="flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button asChild size="icon" variant="ghost" className="h-6 w-6 hover:bg-background">
                      <Link to={`/admin/crm/clients/${r.id}`}>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </Button>
                  </div>
                </Td>
              </TwentyRow>
            ))}
          </tbody>
        </TwentyTable>
      </TwentyTableWrap>
    </TwentyPage>
  );
}
