import { forwardRef } from "react";
import { ContractData } from "@/types/contract";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
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

const formatDate = (dateStr: string) => {
  if (!dateStr) return "_______________";
  try {
    return format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
};

const p = (value: string | undefined | null, fallback = "_______________") =>
  (value ?? "").toString().trim() || fallback;

const ContractPreview = forwardRef<HTMLDivElement, ContractPreviewProps>(({ data, onChange }, ref) => {
  const date = formatDate(data.dateDeServices);
  return (
    <div ref={ref} className="space-y-8 contract-page-list">
      <ContractPage1 data={data} date={date} p={p} onChange={onChange} />
      <ContractPage2 data={data} p={p} onChange={onChange} />
      <ContractPage3 />
      <ContractPage4 />
      <ContractPage5 />
      <ContractPage6 />
      <ContractPage7 />
      <ContractPage8 />
      <ContractPage9 />
      <ContractPage10 />
      <ContractPage11 />
      <ContractPage12 />
      <ContractPage13 />
      <ContractPage14 />
      <ContractPage15 />
      <ContractPage16 data={data} date={date} p={p} />
      <ContractImportantClauses data={data} onChange={onChange} />
      <ContractPageSignature data={data} date={date} p={p} />
    </div>
  );
});

ContractPreview.displayName = "ContractPreview";

export default ContractPreview;
