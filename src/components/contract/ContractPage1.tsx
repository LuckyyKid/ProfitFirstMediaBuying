import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";
import logoTDIA from "@/assets/contract/logo-tdia.png";

interface Props {
  data: ContractData;
  date: string;
  p: (value: string, fallback?: string) => string;
  onChange?: (data: ContractData) => void;
}

const ContractPage1 = ({ data, date, p, onChange }: Props) => (
  <div className={pageClassName} style={pageStyle}>
    <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-10">
      <img src={logoTDIA} alt="TDIA Logo" style={{ maxHeight: "48px" }} />
      <div className="text-right">
        <p className="uppercase font-bold tracking-[0.25em] text-[10px]" style={{ fontFamily: "'Times New Roman', serif" }}>
          Document Contractuel
        </p>
        <p className="text-[10px] uppercase tracking-widest mt-1">Réf. TDIA · {date}</p>
      </div>
    </div>

    <div className="mb-12">
      <p className="text-[10px] uppercase tracking-[0.3em] mb-3 text-black/60">— Contrat —</p>
      <h1
        className="font-bold leading-[0.95] uppercase"
        style={{ fontFamily: "'Times New Roman', serif", fontSize: "44px", letterSpacing: "-0.01em" }}
      >
        Vente
        <br />& Service
      </h1>
      <div className="h-1 w-24 bg-black mt-6" />
      <p className="mt-4 text-[12px] uppercase tracking-widest">Daté du {date}</p>
    </div>

    <div className="grid grid-cols-2 border-y-2 border-black mb-10">
      <div className="py-5 pr-6 border-r-2 border-black">
        <p className="text-[10px] uppercase tracking-[0.25em] text-black/60 mb-2">La Société</p>
        <p className="font-bold text-[18px] uppercase leading-tight">TDIA</p>
        <p className="text-[12px] mt-1">Québec, Canada</p>
      </div>
      <div className="py-5 pl-6">
        <p className="text-[10px] uppercase tracking-[0.25em] text-black/60 mb-2">Le Client</p>
        <p className="font-bold text-[18px] uppercase leading-tight">
          {p(data.nomDuBrand, "{{Nomdubrand}}")} Inc.
        </p>
        <p className="text-[12px] mt-1">Québec, Canada</p>
      </div>
    </div>

    <p className="mb-8 text-justify">
      <span className="font-bold uppercase tracking-wider">En considération des engagements</span> et des accords contenus dans le présent Contrat de vente et de service, les parties au présent Contrat conviennent de ce qui suit&nbsp;:
    </p>

    {data.introductionActive && (
      <p
        className="mb-8 text-justify"
        style={{ whiteSpace: "pre-wrap", outline: "none", minHeight: "1.5em" }}
        contentEditable={!!onChange}
        suppressContentEditableWarning
        onBlur={(e) => onChange?.({ ...data, introduction: e.currentTarget.textContent || "" })}
      >
        {data.introduction}
      </p>
    )}

    <Section title="1. Vente de services">
      <p>La Société fournira au Client, à compter du {date}, les services de gestion publicitaire numérique suivants&nbsp;:</p>
      <ul className="list-disc ml-6 mt-2 space-y-1">
        <li>Achat média sur Meta Ads et Google Ads</li>
        <li>Développement de tunnels de vente complets (hors publicités)</li>
        <li>Création de contenu publicitaire</li>
      </ul>
      <p className="mt-2">La Société peut fournir, sans s'y limiter, les services complémentaires suivants&nbsp;:</p>
      <ul className="list-disc ml-6 mt-2 space-y-1">
        <li>Optimisation PPC et retargeting</li>
        <li>Reporting et analyse de performance</li>
        <li>Développement ou refonte complète de site web</li>
        <li>Production vidéo professionnelle (tournage, montage avancé, studio)</li>
        <li>Automatisation CRM avancée ou intégration complexe de systèmes</li>
        <li>Branding complet ou stratégie d'identité de marque globale</li>
      </ul>
    </Section>

    <Section title="2. Coût">
      <p style={{ whiteSpace: "pre-wrap" }}>{p(data.cost, "{{cost}}")}</p>
    </Section>

    <Section title="3. Paiement">
      <p>
        Le mode de paiement sera facturé à la signature et facturé automatiquement trente (30) jours après la période de facturation précédente. Le paiement doit être effectué par carte de crédit, en utilisant la carte figurant dans le dossier.
      </p>
    </Section>

    <Section title="4. Prestation des services">
      <p>La Société commencera à fournir les services le {date}.</p>
    </Section>

    <Section title="5. Durée et résiliation">
      <p>
        Suite à la période de test, l'une ou l'autre des parties peut résilier le présent Contrat moyennant un préavis écrit de 14 jours par courrier électronique.
      </p>
    </Section>
  </div>
);

export default ContractPage1;
