import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage8 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <Section title={isEN ? "26. Assignment and subcontracting" : "26. Cession et sous-traitance"}>
        {isEN ? (
          <>
            <p className="font-semibold">26.1 Assignment of the Contract</p>
            <p>The Client may not assign, transfer, delegate or otherwise dispose of this Contract, in whole or in part, without the prior written authorization of the Company. Any attempted assignment made without written consent shall be null and void.</p>
            <p className="mt-2">The Company may, however, assign this Contract to an affiliated entity, to a successor in the event of a merger, acquisition or corporate reorganization, provided that the contractual obligations are maintained.</p>

            <p className="font-semibold mt-4">26.2 Subcontracting</p>
            <p>The Company may, at its discretion, use subcontractors or external collaborators to perform all or part of the services provided under this Contract. The Company remains fully liable to the Client for the proper performance of the services, even when these are carried out by a subcontractor.</p>

            <p className="font-semibold mt-4">26.3 Potential subcontractors</p>
            <p>Subcontractors may include, without limitation:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>graphic and visual designers;</li>
              <li>copywriters;</li>
              <li>video editors;</li>
              <li>specialized media buyers;</li>
              <li>strategic consultants.</li>
            </ul>
            <p className="mt-2">The Company undertakes to impose on its subcontractors confidentiality and data protection obligations equivalent to those provided in this Contract.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">26.1 Cession du Contrat</p>
            <p>Le Client ne peut céder, transférer, déléguer ou autrement disposer du présent Contrat, en tout ou en partie, sans l'autorisation écrite préalable de la Société. Toute tentative de cession effectuée sans consentement écrit sera nulle et sans effet.</p>
            <p className="mt-2">La Société peut toutefois céder le présent Contrat à une entité affiliée, à un successeur en cas de fusion, acquisition ou réorganisation corporative, sous réserve que les obligations contractuelles soient maintenues.</p>

            <p className="font-semibold mt-4">26.2 Sous-traitance</p>
            <p>La Société peut, à sa discrétion, recourir à des sous-traitants ou collaborateurs externes pour l'exécution de tout ou partie des services prévus au présent Contrat. La Société demeure pleinement responsable envers le Client de la bonne exécution des services, même lorsque ceux-ci sont réalisés par un sous-traitant.</p>

            <p className="font-semibold mt-4">26.3 Sous-traitants potentiels</p>
            <p>Les sous-traitants peuvent notamment inclure, sans s'y limiter&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>graphistes et designers visuels&nbsp;;</li>
              <li>rédacteurs publicitaires&nbsp;;</li>
              <li>monteurs vidéo&nbsp;;</li>
              <li>média buyers spécialisés&nbsp;;</li>
              <li>consultants stratégiques.</li>
            </ul>
            <p className="mt-2">La Société s'engage à imposer à ses sous-traitants des obligations de confidentialité et de protection des données équivalentes à celles prévues au présent Contrat.</p>
          </>
        )}
      </Section>

      <Section title={isEN ? "27. Fee adjustment and review" : "27. Ajustement et révision des tarifs"}>
        {isEN ? (
          <>
            <p className="font-semibold">27.1 Annual review</p>
            <p>The Company reserves the right to revise its fees once every twelve (12) months following the entry into force of this Contract or the last fee revision. Any annual increase may not exceed ten percent (10%) of the fees then in force, unless otherwise agreed in a separate writing between the parties.</p>

            <p className="font-semibold mt-4">27.2 Prior notice</p>
            <p>Any fee change must be the subject of a written notice sent to the Client at least sixty (60) days before it takes effect. The absence of a written objection from the Client before the effective date shall constitute acceptance of the new fees.</p>

            <p className="font-semibold mt-4">27.3 Right of termination</p>
            <p>If the proposed increase exceeds ten percent (10%) or if the Client refuses the new fees, the Client may terminate the Contract without penalty, by written notice sent before the new fees take effect. Termination will take effect on the date preceding the application of the new fees.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">27.1 Révision annuelle</p>
            <p>La Société se réserve le droit de réviser ses honoraires une fois par période de douze (12) mois suivant l'entrée en vigueur du présent Contrat ou la dernière révision tarifaire. Toute augmentation annuelle ne pourra excéder dix pour cent (10 %) des honoraires alors en vigueur, sauf accord écrit distinct entre les parties.</p>

            <p className="font-semibold mt-4">27.2 Avis préalable</p>
            <p>Toute modification tarifaire devra faire l'objet d'un avis écrit transmis au Client au moins soixante (60) jours avant sa prise d'effet. L'absence d'opposition écrite du Client avant la date d'entrée en vigueur vaudra acceptation des nouveaux tarifs.</p>

            <p className="font-semibold mt-4">27.3 Droit de résiliation</p>
            <p>Si l'augmentation proposée excède dix pour cent (10 %) ou si le Client refuse les nouveaux tarifs, celui-ci pourra résilier le Contrat sans pénalité, moyennant un avis écrit transmis avant l'entrée en vigueur des nouveaux tarifs. La résiliation prendra effet à la date précédant l'application des nouveaux honoraires.</p>
          </>
        )}
      </Section>

      <Section
        title={
          isEN
            ? "28. Additional and out-of-scope services"
            : "28. Services additionnels et hors périmètre"
        }
      >
        {isEN ? (
          <>
            <p className="font-semibold">28.1 Services not included</p>
            <p>Unless expressly stipulated in Schedule A or in a separate written agreement, the following services are considered outside the scope ("out of scope") of this Contract:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>Organic SEO and natural search-referencing strategy;</li>
              <li>Development of software or SaaS applications;</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">28.1 Services non inclus</p>
            <p>Sauf stipulation expresse prévue à l'Annexe A ou dans une entente écrite distincte, les services suivants sont considérés comme hors du périmètre («&nbsp;hors scope&nbsp;») du présent Contrat&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>SEO organique et stratégie de référencement naturel&nbsp;;</li>
              <li>Développement d'applications logicielles ou SaaS&nbsp;;</li>
            </ul>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage8;
