import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";
import logoTDIA from "@/assets/contract/logo-tdia.png";

interface Props {
  data: ContractData;
  date: string;
  p: (value: string, fallback?: string) => string;
  onChange?: (data: ContractData) => void;
}

const ContractPage1 = ({ data, date, p }: Props) => {
  const isEN = data.language === "en";
  const trial = data.periodeTestActive;
  const trialMonths = p(data.periodeTestMois, "{{Trial_Month_Number}}");
  const trialPrice = p(data.prixEssai, "{{Trial_Price}}");
  const normalPrice = p(data.prix, "{{Normal_Price}}");
  return (
    <div className={pageClassName} style={pageStyle}>
      <div className="flex items-center justify-between border-b-4 border-black pb-4 mb-10">
        <img src={logoTDIA} alt="TDIA Logo" style={{ maxHeight: "48px" }} />
        <div className="text-right">
          <p
            className="uppercase font-bold tracking-[0.25em] text-[10px]"
            style={{ fontFamily: "'Times New Roman', serif" }}
          >
            {isEN ? "Contractual Document" : "Document Contractuel"}
          </p>
          <p className="text-[10px] uppercase tracking-widest mt-1">
            {isEN ? "TDIA Ref. · " : "Réf. TDIA · "}
            {date}
          </p>
        </div>
      </div>

      <div className="mb-12">
        <p className="text-[10px] uppercase tracking-[0.3em] mb-3 text-black/60">
          {isEN ? "— Contract —" : "— Contrat —"}
        </p>
        <h1
          className="font-bold leading-[0.95] uppercase"
          style={{
            fontFamily: "'Times New Roman', serif",
            fontSize: "44px",
            letterSpacing: "-0.01em",
          }}
        >
          {isEN ? (
            <>
              Sale & Service
              <br />Agreement
            </>
          ) : (
            <>
              Vente
              <br />& Service
            </>
          )}
        </h1>
        <div className="h-1 w-24 bg-black mt-6" />
        <p className="mt-4 text-[12px] uppercase tracking-widest">
          {isEN ? `Service dated ${date}` : `Daté du ${date}`}
        </p>
      </div>

      <div className="grid grid-cols-2 border-y-2 border-black mb-10">
        <div className="py-5 pr-6 border-r-2 border-black">
          <p className="text-[10px] uppercase tracking-[0.25em] text-black/60 mb-2">
            {isEN ? "The Company" : "La Société"}
          </p>
          <p className="font-bold text-[18px] uppercase leading-tight">TDIA</p>
          <p className="text-[12px] mt-1">{isEN ? "Quebec, Canada" : "Québec, Canada"}</p>
        </div>
        <div className="py-5 pl-6">
          <p className="text-[10px] uppercase tracking-[0.25em] text-black/60 mb-2">
            {isEN ? "The Client" : "Le Client"}
          </p>
          <p className="font-bold text-[18px] uppercase leading-tight">
            {p(data.nomDuBrand, "{{Company_name}}")}.
          </p>
          <p className="text-[12px] mt-1">{isEN ? "Quebec, Canada" : "Québec, Canada"}</p>
        </div>
      </div>

      <p className="mb-8 text-justify">
        {isEN ? (
          <>
            <span className="font-bold uppercase tracking-wider">
              In consideration of the commitments
            </span>{" "}
            and agreements contained in this Sale and Service Agreement, the parties to this
            Agreement agree as follows:
          </>
        ) : (
          <>
            <span className="font-bold uppercase tracking-wider">
              En considération des engagements
            </span>{" "}
            et des accords contenus dans le présent Contrat de vente et de service, les parties au
            présent Contrat conviennent de ce qui suit&nbsp;:
          </>
        )}
      </p>

      <Section title={isEN ? "1. Sale of services" : "1. Vente de services"}>
        {isEN ? (
          <>
            <p>
              The Company will provide the Client, starting {date}, with the following digital
              advertising management services:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Media buying on Meta Ads and Google Ads</li>
              <li>Development of complete sales funnels (excluding ads)</li>
              <li>Advertising content creation</li>
            </ul>
            <p className="mt-2">
              The Company may provide, without limitation, the following additional services:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>PPC optimization and retargeting</li>
              <li>Performance reporting and analysis</li>
              <li>Website development or complete redesign</li>
              <li>Professional video production (filming, advanced editing, studio)</li>
              <li>Advanced CRM automation or complex system integration</li>
              <li>Full branding or comprehensive brand identity strategy</li>
            </ul>
          </>
        ) : (
          <>
            <p>
              La Société fournira au Client, à compter du {date}, les services de gestion
              publicitaire numérique suivants&nbsp;:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Achat média sur Meta Ads et Google Ads</li>
              <li>Développement de tunnels de vente complets (hors publicités)</li>
              <li>Création de contenu publicitaire</li>
            </ul>
            <p className="mt-2">
              La Société peut fournir, sans s'y limiter, les services complémentaires suivants&nbsp;:
            </p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>Optimisation PPC et retargeting</li>
              <li>Reporting et analyse de performance</li>
              <li>Développement ou refonte complète de site web</li>
              <li>Production vidéo professionnelle (tournage, montage avancé, studio)</li>
              <li>Automatisation CRM avancée ou intégration complexe de systèmes</li>
              <li>Branding complet ou stratégie d'identité de marque globale</li>
            </ul>
          </>
        )}
      </Section>

      <Section title={isEN ? "2. Cost" : "2. Coût"}>
        <p>
          {isEN
            ? trial
              ? `The Client will pay ${trialPrice} monthly during the trial period, and ${normalPrice} after the trial period.`
              : `The Client will pay ${normalPrice} monthly.`
            : trial
              ? `Le Client paiera ${trialPrice} mensuellement pendant la période de test et ${normalPrice} après la période de test.`
              : `Le Client paiera ${normalPrice} mensuellement.`}
        </p>
      </Section>

      <Section title={isEN ? "3. Payment" : "3. Paiement"}>
        <p>
          {isEN
            ? "The payment method will be charged upon signature and automatically charged thirty (30) days after the previous billing period. Payment must be made by credit card, using the card on file."
            : "Le mode de paiement sera facturé à la signature et facturé automatiquement trente (30) jours après la période de facturation précédente. Le paiement doit être effectué par carte de crédit, en utilisant la carte figurant dans le dossier."}
        </p>
      </Section>

      <Section title={isEN ? "4. Provision of services" : "4. Prestation des services"}>
        <p>
          {isEN
            ? `The Company will begin providing services on ${date}.`
            : `La Société commencera à fournir les services le ${date}.`}
        </p>
      </Section>

      <Section title={isEN ? "5. Term and termination" : "5. Durée et résiliation"}>
        {isEN ? (
          <>
            <p>
              {trial
                ? `Following the ${trialMonths} month trial period, either party may terminate this Agreement with 14 days' written notice by email.`
                : "Either party may terminate this Agreement with 14 days' written notice by email."}
            </p>
            <p className="mt-2">
              Termination of this Agreement (regardless of the reason) will not affect the rights
              or obligations accrued by either party, nor will it affect the coming into force or
              continuation of any provision whose explicit or implicit intent is to take effect or
              remain in effect at or after the time of termination.
            </p>
          </>
        ) : (
          <>
            <p>
              {trial
                ? `Suite à la période de test de ${trialMonths} mois, l'une ou l'autre des parties peut résilier le présent Contrat moyennant un préavis écrit de 14 jours par courrier électronique.`
                : "L'une ou l'autre des parties peut résilier le présent Contrat moyennant un préavis écrit de 14 jours par courrier électronique."}
            </p>
            <p className="mt-2">
              Toute résiliation du présent Contrat (quelle qu'en soit l'occasion) n'affectera pas
              les droits ou les obligations accumulés par l'une ou l'autre des parties et
              n'affectera pas non plus l'entrée en vigueur ou le maintien en vigueur de toute
              disposition dont l'intention explicite ou implicite est d'entrer en vigueur ou de
              rester en vigueur au moment de la résiliation ou après celle-ci.
            </p>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage1;
