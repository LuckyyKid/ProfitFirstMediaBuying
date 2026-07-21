import { Link } from "react-router-dom";
import { TrendingUp } from "lucide-react";
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

export default function ForecastsGlobal() {
  const { rows } = useCrmGlobalList("crm_forecasts");
  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={TrendingUp}
        title="Forecasts"
        description="Prévisions actives"
      />

      <TwentyTableWrap>
        <TwentyTable>
          <TwentyThead>
            <Th>Client</Th>
            <Th>Nom</Th>
            <Th>Range</Th>
            <Th>Confidence</Th>
            <Th>Statut</Th>
          </TwentyThead>
          <tbody>
            {rows.length === 0 ? (
              <EmptyRow colSpan={5} title="Aucun forecast" />
            ) : rows.map((r) => (
              <TwentyRow key={r.id}>
                <Td>
                  <Link className="text-primary hover:underline" to={`/admin/crm/clients/${r.crm_clients?.id}`}>
                    {r.crm_clients?.company_name}
                  </Link>
                </Td>
                <Td>{r.forecast_name}</Td>
                <Td className="tabular-nums">
                  {r.expected_lift_low}% / {r.expected_lift_base}% / {r.expected_lift_high}%
                </Td>
                <Td className="tabular-nums">{r.confidence_score} — {r.confidence_label}</Td>
                <Td><StatusBadge status={r.forecast_status} /></Td>
              </TwentyRow>
            ))}
          </tbody>
        </TwentyTable>
      </TwentyTableWrap>
    </TwentyPage>
  );
}
