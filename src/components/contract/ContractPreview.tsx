import { forwardRef } from "react";
import { ContractData } from "@/types/contract";
import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import ContractPage1 from "./ContractPage1";
import ContractPage2 from "./ContractPage2";
import ContractPage3 from "./ContractPage3";
import ContractPage4 from "./ContractPage4";
import ContractPage5 from "./ContractPage5";
import ContractPage6 from "./ContractPage6";
import ContractPage7 from "./ContractPage7";
import ContractPage8 from "./ContractPage8";
import ContractPage9 from "./ContractPage9";
import ContractPage10 from "./ContractPage10";
import ContractPage11 from "./ContractPage11";
import ContractPage12 from "./ContractPage12";
import ContractPage13 from "./ContractPage13";
import ContractPage14 from "./ContractPage14";
import ContractPage15 from "./ContractPage15";
import ContractPage16 from "./ContractPage16";
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
      <ContractPage2 data={data} p={p} onChange={onChange} />
      <ContractPage3 data={data} />
      <ContractPage4 data={data} />
      <ContractPage5 data={data} />
      <ContractPage6 data={data} />
      <ContractPage7 data={data} />
      <ContractPage8 data={data} />
      <ContractPage9 data={data} />
      <ContractPage10 data={data} />
      <ContractPage11 data={data} />
      <ContractPage12 data={data} />
      <ContractPage13 data={data} />
      <ContractPage14 data={data} />
      <ContractPage15 data={data} />
      <ContractPage16 data={data} date={date} p={p} />
      <ContractImportantClauses data={data} onChange={onChange} />
      <ContractPageSignature data={data} date={date} p={p} />
    </div>
  );
});

ContractPreview.displayName = "ContractPreview";

export default ContractPreview;
