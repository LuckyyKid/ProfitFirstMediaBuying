import { useMemo, useState } from "react";
import { BookOpen } from "lucide-react";
import { useCrmGlobalList } from "@/crm/hooks";
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

export default function LearningLibrary() {
  const { rows } = useCrmGlobalList("crm_learning_library");
  const [q, setQ] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter(
        (r) =>
          !q ||
          [r.hypothesis, r.industry, r.creative_angle, r.offer, r.decision].some((v) =>
            (v ?? "").toLowerCase().includes(q.toLowerCase()),
          ),
      ),
    [rows, q],
  );

  return (
    <TwentyPage inLayout>
      <PageHeader
        icon={BookOpen}
        title="Learning Library"
        description="Base de connaissances TDIA"
      />

      <ViewBar
        search={q}
        onSearchChange={setQ}
        searchPlaceholder="Rechercher (hypothèse, industrie, angle, offre, décision)…"
        total={filtered.length}
      />

      <TwentyTableWrap>
        <TwentyTable>
          <TwentyThead>
            <Th>Client</Th>
            <Th>Industrie</Th>
            <Th>Hypothèse</Th>
            <Th>Angle</Th>
            <Th>Result</Th>
            <Th>Decision</Th>
          </TwentyThead>
          <tbody>
            {filtered.length === 0 ? (
              <EmptyRow colSpan={6} title="Aucun learning" />
            ) : filtered.map((r) => (
              <TwentyRow key={r.id}>
                <Td>{r.crm_clients?.company_name ?? "—"}</Td>
                <Td>{r.industry ?? "—"}</Td>
                <Td className="max-w-md truncate">{r.hypothesis}</Td>
                <Td>{r.creative_angle}</Td>
                <Td>{r.result}</Td>
                <Td>{r.decision}</Td>
              </TwentyRow>
            ))}
          </tbody>
        </TwentyTable>
      </TwentyTableWrap>
    </TwentyPage>
  );
}
