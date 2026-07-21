import { Link } from "react-router-dom";
import { Lightbulb } from "lucide-react";
import { StatusBadge } from "@/crm/ui";
import { useCrmGlobalList } from "@/crm/hooks";
import {
  TwentyPage,
  PageHeader,
  TwentyTableWrap,
  TwentyTable,
  TwentyThead,
  Th,
  TwentyRow,
  Td,
  EmptyRow,
} from "@/components/admin-shell";

export default function HypothesesGlobal() {
  const { rows } = useCrmGlobalList("crm_hypotheses");
  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={Lightbulb}
        title="Hypotheses"
        description="Vue globale de toutes les hypothèses"
      />

      <TwentyTableWrap>
        <TwentyTable>
          <TwentyThead>
            <Th>Client</Th>
            <Th>Hypothèse</Th>
            <Th>Catégorie</Th>
            <Th>Priorité suggérée</Th>
            <Th>Statut</Th>
          </TwentyThead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5} title="Aucune hypothèse" />
            ) : rows.map((r) => (
              <TwentyRow key={r.id}>
                <Td>
                  <Link className="text-primary hover:underline" to={`/admin/crm/clients/${r.crm_clients?.id}`}>
                    {r.crm_clients?.company_name ?? "—"}
                  </Link>
                </Td>
                <Td className="max-w-md truncate">{r.hypothesis}</Td>
                <Td>{r.category ?? "—"}</Td>
                <Td>{r.suggested_priority ?? "—"}</Td>
                <Td><StatusBadge status={r.status} /></Td>
              </TwentyRow>
            ))}
          </tbody>
        </TwentyTable>
      </TwentyTableWrap>
    </TwentyPage>
  );
}
