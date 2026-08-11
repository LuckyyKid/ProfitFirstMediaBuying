import { format } from "date-fns";
import { fr, enUS } from "date-fns/locale";
import PizZip from "pizzip";
import Docxtemplater from "docxtemplater";
import type { ContractData } from "@/types/contract";
import contractTemplateFrUrl from "@/assets/contract/contract-fr.docx?url";
import contractTemplateEnUrl from "@/assets/contract/contract-en.docx?url";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const templateBufferCache: Record<string, Promise<ArrayBuffer>> = {};

function loadTemplateBuffer(language: ContractData["language"]) {
  const url = language === "en" ? contractTemplateEnUrl : contractTemplateFrUrl;
  if (!templateBufferCache[url]) {
    templateBufferCache[url] = fetch(url).then((r) => {
      if (!r.ok) throw new Error(`Contract template fetch failed: ${r.status}`);
      return r.arrayBuffer();
    });
  }
  return templateBufferCache[url];
}

function formatServiceDate(dateStr: string, language: ContractData["language"]) {
  if (!dateStr) return "";
  try {
    return language === "en"
      ? format(new Date(dateStr), "MMMM d, yyyy", { locale: enUS })
      : format(new Date(dateStr), "d MMMM yyyy", { locale: fr });
  } catch {
    return dateStr;
  }
}

// Fill the FR/EN contract template with the 7 variables, strip red highlight
// on filled runs, and return the resulting .docx as an ArrayBuffer.
// Shared by ContractCreator (download + DocuSign) and ContractDocxPreview.
export async function fillContractDocx(data: ContractData): Promise<ArrayBuffer> {
  const buffer = await loadTemplateBuffer(data.language);
  const zip = new PizZip(buffer.slice(0));
  const doc = new Docxtemplater(zip, {
    delimiters: { start: "{{", end: "}}" },
    paragraphLoop: true,
    linebreaks: true,
  });

  const signatoryName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
  doc.render({
    Service_date: formatServiceDate(data.dateDeServices, data.language),
    Company_name: data.nomDuBrand,
    Trial_Price: data.prixEssai,
    Normal_Price: data.prix,
    Trial_Month_Number: data.periodeTestMois,
    Creative_minimum: data.creativeMinimum,
    Client_Signatory_name: signatoryName,
  });

  // Templates mark variables in red (ff0000) so the editor can spot them in
  // Word. docxtemplater keeps the run's rPr, so filled values inherit that
  // red — force every red run to black in the rendered .docx.
  const rendered = doc.getZip();
  for (const fileName of Object.keys(rendered.files)) {
    if (!fileName.startsWith("word/") || !fileName.endsWith(".xml")) continue;
    const xml = rendered.files[fileName].asText();
    if (!/w:val="ff0000"/i.test(xml)) continue;
    rendered.file(
      fileName,
      xml.replace(/<w:color\s+w:val="ff0000"\s*\/>/gi, '<w:color w:val="000000"/>'),
    );
  }

  return rendered.generate({ type: "arraybuffer" });
}

export async function fillContractDocxBlob(data: ContractData): Promise<Blob> {
  const buffer = await fillContractDocx(data);
  return new Blob([buffer], { type: DOCX_MIME });
}
