import { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import type { ContractData } from "@/types/contract";
import { fillContractDocx } from "@/lib/contract-docx";

interface Props {
  data: ContractData;
}

// Live .docx preview: fills the template with the current form values and
// renders the resulting Word file into a div via docx-preview. This is the
// exact file the client will receive from DocuSign (minus DocuSign's
// PDF conversion, which is loss-less for our formatting).
const ContractDocxPreview = ({ data }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      if (!containerRef.current) return;
      setRendering(true);
      setError(null);
      try {
        const buffer = await fillContractDocx(data);
        if (cancelled || !containerRef.current) return;
        containerRef.current.innerHTML = "";
        // Wrap in a Blob so docx-preview doesn't hold on to (or mutate) the
        // underlying ArrayBuffer we might reuse for the download flow.
        const blob = new Blob([buffer], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        });
        await renderAsync(blob, containerRef.current, undefined, {
          className: "contract-docx",
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          ignoreFonts: false,
          breakPages: true,
          experimental: true,
        });
      } catch (e) {
        console.error("[ContractDocxPreview]", e);
        if (!cancelled) setError((e as Error).message || "Preview error");
      } finally {
        if (!cancelled) setRendering(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [data]);

  return (
    <div className="relative bg-neutral-100 rounded-xl p-4 min-h-[600px]">
      {rendering && (
        <div className="absolute top-4 right-4 z-10 px-3 py-1 rounded-full bg-black/70 text-white text-xs">
          {data.language === "en" ? "Rendering…" : "Génération…"}
        </div>
      )}
      {error && (
        <div className="mb-3 px-4 py-2 rounded-md bg-red-50 text-red-800 text-sm">
          {error}
        </div>
      )}
      <div ref={containerRef} className="contract-docx-host" />
    </div>
  );
};

export default ContractDocxPreview;
