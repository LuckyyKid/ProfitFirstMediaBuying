import { Link } from "react-router-dom";
import { Activity } from "lucide-react";
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

export default function LiveOptimizationGlobal() {
  const { rows } = useCrmGlobalList("crm_live_optimization_reviews");
  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={Activity}
        title="Live Optimization"
        description="Revues hebdomadaires de performance"
      />

      <TwentyTableWrap>
        <TwentyTable>
          <TwentyThead>
            <Th>Client</Th>
            <Th>Période</Th>
            <Th>Rev act/target</Th>
            <Th>CAC act/target</Th>
            <Th>Problème</Th>
          </TwentyThead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5} title="Aucune revue" />
            ) : rows.map((r) => (
              <TwentyRow key={r.id}>
                <Td>
                  <Link className="text-primary hover:underline" to={`/admin/crm/clients/${r.crm_clients?.id}`}>
                    {r.crm_clients?.company_name}
                  </Link>
                </Td>
                <Td>{r.review_period}</Td>
                <Td className="tabular-nums">{r.revenue_actual}/{r.revenue_target}</Td>
                <Td className="tabular-nums">{r.cac_actual}/{r.cac_target}</Td>
                <Td>{r.problem_type}</Td>
              </TwentyRow>
            ))}
          </tbody>
        </TwentyTable>
      </TwentyTableWrap>
    </TwentyPage>
  );
}
