import { forwardRef } from "react";
import { ContractData } from "@/types/contract";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import ContractPage1 from "./ContractPage1";
import ContractBody from "./ContractBody";
import ContractPageSignature from "./ContractPageSignature";
import ContractImportantClauses from "./ContractImportantClauses";

interface ContractPreviewProps {
  data: ContractData;
  onChange?: (data: ContractData) => void;
}

const formatDate = (dateStr: string, language: "fr" | "en") => {
  if (!dateStr) return "_______________";
  try {
    return language === "en"
      ? format(new Date(dateStr), "MMMM d, yyyy", { locale: enUS })
      : format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

const p = (value: string | undefined | null, fallback = "_______________") =>
  (value ?? "").toString().trim() || fallback;

const ContractPreview = forwardRef<HTMLDivElement, ContractPreviewProps>(({ data, onChange }, ref) => {
  const date = formatDate(data.dateDeServices, data.language);
  return (
    <div ref={ref} className="space-y-8 contract-page-list">
      <ContractPage1 data={data} date={date} p={p} onChange={onChange} />
      <ContractBody data={data} p={p} />
      <ContractImportantClauses data={data} onChange={onChange} />
      <ContractPageSignature data={data} date={date} p={p} />
    </div>
  );
});

ContractPreview.displayName = "ContractPreview";

export default ContractPreview;
