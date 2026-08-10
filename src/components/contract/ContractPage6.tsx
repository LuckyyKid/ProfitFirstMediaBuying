import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage6 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <Section
        title={isEN ? "22. Clause on non-exclusivity" : "22. Clause relative à l'absence d'exclusivité"}
      >
        {isEN ? (
          <>
            <p className="font-semibold">22.1 Absence of sector exclusivity</p>
            <p>The Client acknowledges and accepts that the Company is free to provide similar or identical services to other companies, including companies operating in the same sector or market as the Client.</p>
            <p className="mt-2">Unless an express stipulation of exclusivity is provided in a separate schedule signed by the parties, this Contract does not grant the Client any right of territorial, sectoral or competitive exclusivity.</p>
            <p className="mt-2">The Company nevertheless undertakes to:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>preserve the confidentiality of the Client's strategic information;</li>
              <li>not disclose data, strategies or confidential information specific to the Client;</li>
              <li>maintain reasonable separation of sensitive information across its different engagements.</li>
            </ul>
            <p className="mt-2">Any request for exclusivity must be the subject of a separate written agreement, with a clear limitation of its scope (territory, sector, duration), and may result in a pricing adjustment.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">22.1 Absence d'exclusivité sectorielle</p>
            <p>Le Client reconnaît et accepte que la Société est libre de fournir des services similaires ou identiques à d'autres entreprises, y compris des entreprises opérant dans le même secteur d'activité ou sur le même marché que le Client.</p>
            <p className="mt-2">Sauf stipulation expresse d'exclusivité prévue dans une annexe distincte signée par les parties, le présent Contrat ne confère au Client aucun droit d'exclusivité territoriale, sectorielle ou concurrentielle.</p>
            <p className="mt-2">La Société s'engage toutefois à&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>préserver la confidentialité des informations stratégiques du Client&nbsp;;</li>
              <li>ne pas divulguer de données, stratégies ou informations confidentielles propres au Client&nbsp;;</li>
              <li>maintenir une séparation raisonnable des informations sensibles entre ses différents mandats.</li>
            </ul>
            <p className="mt-2">Toute demande d'exclusivité devra faire l'objet d'un accord écrit distinct, d'une limitation claire de sa portée (territoire, secteur, durée), et pourra entraîner un ajustement tarifaire.</p>
          </>
        )}
      </Section>

      <Section title={isEN ? "23. Indemnification" : "23. Indemnisation"}>
        {isEN ? (
          <>
            <p className="font-semibold">23.1 Indemnification by the Client</p>
            <p>The Client agrees to defend, indemnify and hold harmless the Company, its officers, employees, representatives and subcontractors against any claim, lawsuit, demand, fine, penalty, loss or expense (including reasonable attorneys' fees) arising from:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) any content, material, data, information or element provided by the Client under this Contract;</li>
              <li>b) any actual or alleged violation of third-party rights, including in particular: copyright, trademarks, patents, licenses, image rights, or any other intellectual property right;</li>
              <li>c) any inaccuracy, omission or misleading representation relating to the Client's products or services;</li>
              <li>d) any legal non-compliance of the Client's products or services.</li>
            </ul>
            <p className="mt-2">The Client shall lead the defense of any such claim, subject to the Company's right to participate in its defense at its own expense.</p>

            <p className="font-semibold mt-4">23.2 Indemnification by the Company</p>
            <p>The Company agrees to indemnify the Client against any third-party claim arising exclusively from:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) a proven breach of the confidentiality obligation set out in this Contract; or</li>
              <li>b) gross or intentional fault committed by the Company in the performance of the services.</li>
            </ul>
            <p className="mt-2">The Company's indemnification obligation is limited to the total amount of fees paid by the Client during the twelve (12) months preceding the claim.</p>
          </>
        ) : (
          <>
            <p className="font-semibold">23.1 Indemnisation par le Client</p>
            <p>Le Client s'engage à défendre, indemniser et tenir indemne la Société, ses dirigeants, employés, représentants et sous-traitants contre toute réclamation, poursuite, demande, amende, pénalité, perte ou dépense (incluant les honoraires raisonnables d'avocats) résultant de&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) tout contenu, matériel, donnée, information ou élément fourni par le Client dans le cadre du présent Contrat&nbsp;;</li>
              <li>b) toute violation réelle ou alléguée de droits de tiers, incluant notamment&nbsp;: droits d'auteur, marques de commerce, brevets, licences, droits à l'image, ou tout autre droit de propriété intellectuelle&nbsp;;</li>
              <li>c) toute inexactitude, omission ou représentation trompeuse relative aux produits ou services du Client&nbsp;;</li>
              <li>d) toute non-conformité légale des produits ou services du Client.</li>
            </ul>
            <p className="mt-2">Le Client assumera la direction de toute défense liée à une telle réclamation, sous réserve du droit de la Société de participer à sa défense à ses frais.</p>

            <p className="font-semibold mt-4">23.2 Indemnisation par la Société</p>
            <p>La Société s'engage à indemniser le Client contre toute réclamation de tiers résultant exclusivement&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) d'une violation prouvée de l'obligation de confidentialité prévue au présent Contrat&nbsp;; ou</li>
              <li>b) d'une faute lourde ou intentionnelle commise par la Société dans l'exécution des services.</li>
            </ul>
            <p className="mt-2">L'obligation d'indemnisation de la Société est limitée au montant total des honoraires versés par le Client au cours des douze (12) mois précédant la réclamation.</p>
          </>
        )}
      </Section>

      <Section title={isEN ? "24. Regulatory compliance" : "24. Conformité réglementaire"}>
        {isEN ? (
          <>
            <p className="font-semibold">24.1 Client's representations and warranties</p>
            <p>The Client represents, warrants and undertakes that:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) its products, services, commercial offers and marketing practices comply with all applicable laws, regulations and standards, including those in force in Canada, in Quebec and in any territory targeted by the advertising campaigns;</li>
              <li>b) it holds all licenses, permits, authorizations and registrations required to market and advertise its products or services, including in particular, without limitation, regulated sectors such as: alcohol, health and natural products, financial services, real estate, games and contests, consumer protection, personal information protection;</li>
              <li>c) the advertising claims, marketing promises and representations provided to the Company are accurate, verifiable and compliant with applicable laws.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">24.1 Déclarations et garanties du Client</p>
            <p>Le Client déclare, garantit et s'engage à ce que&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) ses produits, services, offres commerciales et pratiques marketing respectent l'ensemble des lois, règlements et normes applicables, notamment celles en vigueur au Canada, au Québec et dans tout territoire ciblé par les campagnes publicitaires&nbsp;;</li>
              <li>b) il détient toutes les licences, permis, autorisations et enregistrements nécessaires à la commercialisation et à la publicité de ses produits ou services, incluant notamment, sans s'y limiter, les secteurs réglementés tels que&nbsp;: alcool, santé et produits naturels, services financiers, immobilier, jeux et concours, protection du consommateur, protection des renseignements personnels&nbsp;;</li>
              <li>c) les allégations publicitaires, promesses marketing et représentations fournies à la Société sont exactes, vérifiables et conformes aux lois applicables.</li>
            </ul>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage6;
