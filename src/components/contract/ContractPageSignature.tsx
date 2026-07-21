import { ContractData } from "@/types/contract";
import { pageStyle, pageClassName } from "./ContractSection";
import signatureIsaac from "@/assets/contract/signature-isaac.png";

interface Props {
  data: ContractData;
  date: string;
  p: (value: string, fallback?: string) => string;
}

const ContractPageSignature = ({ data, date, p }: Props) => (
  <div className={pageClassName} style={pageStyle}>
    <div className="border-b-4 border-black pb-4 mb-10">
      <p className="text-[10px] uppercase tracking-[0.3em] text-black/60 mb-2">Section finale</p>
      <h2 className="font-bold uppercase leading-none" style={{ fontFamily: "'Times New Roman', serif", fontSize: "36px" }}>
        Signatures
      </h2>
    </div>

    <p className="mb-12 text-justify">
      Les soussignés, agissant en leur capacité respective, reconnaissent avoir lu et compris l'intégralité des termes et conditions du présent Contrat et y consentent sans réserve.
    </p>

    <div className="grid grid-cols-2 gap-10">
      <div className="border-2 border-black p-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-black/60 mb-4">Pour la Société</p>
        <div className="h-16 flex items-end mb-2 border-b-2 border-black">
          <img src={signatureIsaac} alt="Signature Isaac Mikola" style={{ maxHeight: "48px" }} />
        </div>
        <p className="font-bold uppercase tracking-wide text-[13px] mt-3">TDIA</p>
        <p className="text-[12px]">Godbless-Isaac Mikola</p>
        <p className="text-[11px] uppercase tracking-widest mt-3 text-black/60">Date · {date}</p>
      </div>

      <div className="border-2 border-black p-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-black/60 mb-4">Pour le Client</p>
        <div className="h-16 flex items-end mb-2 border-b-2 border-black">
          {data.signatureClient && (
            <img src={data.signatureClient} alt="Signature client" style={{ maxHeight: "48px" }} />
          )}
        </div>
        <p className="font-bold uppercase tracking-wide text-[13px] mt-3">
          {p(data.nomDuBrand, "{{Nomdubrand}}")} Inc.
        </p>
        <p className="text-[12px]">
          {p(data.firstName, "{{FirstName}}")} {p(data.lastName, "{{LastName}}")}
        </p>
        <p className="text-[11px] uppercase tracking-widest mt-3 text-black/60">Date · {date}</p>
      </div>
    </div>

    <div className="mt-16 pt-6 border-t-2 border-black flex justify-between text-[10px] uppercase tracking-[0.25em] text-black/60">
      <span>TDIA · Québec, Canada</span>
      <span>Document confidentiel</span>
    </div>
  </div>
);

export default ContractPageSignature;
