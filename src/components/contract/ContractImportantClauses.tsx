import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
  onChange?: (data: ContractData) => void;
}

const ContractImportantClauses = ({ data, onChange }: Props) => {
  const clauses = data.importantClauses ?? [];
  if (!data.importantClausesActive || clauses.length === 0) return null;

  return (
    <div className={pageClassName} style={pageStyle}>
      <h1
        className="font-bold uppercase mb-8 pb-2 border-b-4 border-black"
        style={{ fontFamily: "'Times New Roman', serif", fontSize: "22px", letterSpacing: "0.05em" }}
      >
        Clauses importantes
      </h1>

      {clauses.map((clause, index) => (
        <Section key={index} title={`${index + 1}. ${clause.title || "Titre de la clause"}`}>
          <p
            style={{ whiteSpace: "pre-wrap", outline: "none", minHeight: "1.5em" }}
            contentEditable={!!onChange}
            suppressContentEditableWarning
            onBlur={(e) => {
              if (!onChange) return;
              const next = [...clauses];
              next[index] = { ...next[index], content: e.currentTarget.textContent || "" };
              onChange({ ...data, importantClauses: next });
            }}
          >
            {clause.content || "{{contenu de la clause}}"}
          </p>
        </Section>
      ))}
    </div>
  );
};

export default ContractImportantClauses;
