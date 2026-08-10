import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
}

const ContractPage15 = ({ data }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <p className="italic">
        {isEN
          ? "The Company's internal tools, proprietary methods and technological systems are not transferable."
          : "Les outils internes, méthodes propriétaires et systèmes technologiques de la Société ne sont pas transférables."}
      </p>

      <Section title="">
        {isEN ? (
          <>
            <p className="font-semibold mt-4">41.3 Post-termination support</p>
            <p>The Company will provide post-termination support limited to a maximum of five (5) cumulative hours, usable within the thirty (30) days following termination. Any assistance exceeding this limit or performed after this period will be billed at the prevailing rates.</p>
          </>
        ) : (
          <>
            <p className="font-semibold mt-4">41.3 Support post-résiliation</p>
            <p>La Société offrira un support post-résiliation limité à un maximum de cinq (5) heures cumulatives, utilisables dans les trente (30) jours suivant la résiliation. Toute assistance excédant cette limite ou effectuée après cette période sera facturée selon les tarifs en vigueur.</p>
          </>
        )}
      </Section>

      <Section
        title={
          isEN
            ? "42. Intellectual property and usage rights on creatives"
            : "42. Propriété intellectuelle et droits d'utilisation des créatifs"
        }
      >
        {isEN ? (
          <>
            <p className="font-semibold">42.1 License to use during the Contract term</p>
            <p>Throughout the term of this Contract, the Client benefits from a non-exclusive license to use the advertising creatives (visuals, ad copy, videos, animations, designs) produced by the Company as part of the agreed services.</p>
            <p className="mt-2">This license allows the Client:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>to use the creatives only within the advertising campaigns managed by the Company;</li>
              <li>to distribute these creatives on the Meta Ads, Google Ads platforms and any other platform used under this Contract;</li>
              <li>to display the creatives on its own promotional channels (website, social media) as long as the Contract is in force.</li>
            </ul>

            <p className="font-semibold mt-4">42.2 Intellectual property</p>
            <p>The Company retains the entire intellectual property in all advertising creatives produced, including in particular:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>copyrights;</li>
              <li>reproduction rights;</li>
              <li>modification rights;</li>
              <li>distribution rights.</li>
            </ul>
            <p className="mt-2">Payment of the monthly fees does not include the transfer of intellectual property in the creatives.</p>

            <p className="font-semibold mt-4">42.3 Expiration of the license upon termination</p>
            <p>On the effective date of termination of this Contract, for any reason whatsoever, the license granted to the Client automatically ends.</p>
            <p className="mt-2">The Client must:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>immediately cease any use of the creatives produced by the Company;</li>
              <li>remove the creatives from all advertising platforms, websites, social media or any other distribution channel;</li>
              <li>refrain from reproducing, modifying, adapting or distributing the creatives in any form whatsoever.</li>
            </ul>

            <p className="font-semibold mt-4">42.4 Acquisition of post-termination usage rights</p>
            <p>If the Client wishes to continue using the advertising creatives after termination of the Contract, it must acquire permanent usage rights.</p>
            <p className="mt-2">Acquisition procedure:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) The Client must submit a written request to the Company within a maximum of fourteen (14) days following the effective termination date.</li>
              <li>b) The Company will issue a written quote specifying: the list of creatives concerned, the price for the assignment of usage rights, the scope of the rights assigned (use, duration, territory), payment terms.</li>
              <li>c) Prices will be determined based on: the complexity of the creative, the volume concerned, the scope of rights requested, the rates in force at the time of the request.</li>
            </ul>
          </>
        ) : (
          <>
            <p className="font-semibold">42.1 Licence d'utilisation pendant la durée du Contrat</p>
            <p>Durant toute la durée du présent Contrat, le Client bénéficie d'une licence non exclusive d'utilisation des créatifs publicitaires (visuels, textes publicitaires, vidéos, animations, designs) produits par la Société dans le cadre des services convenus.</p>
            <p className="mt-2">Cette licence permet au Client&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>d'utiliser les créatifs uniquement dans le cadre des campagnes publicitaires gérées par la Société&nbsp;;</li>
              <li>de diffuser ces créatifs sur les plateformes Meta Ads, Google Ads et toute autre plateforme utilisée dans le cadre du présent Contrat&nbsp;;</li>
              <li>d'afficher les créatifs sur ses propres canaux promotionnels (site web, réseaux sociaux) tant que le Contrat est en vigueur.</li>
            </ul>

            <p className="font-semibold mt-4">42.2 Propriété intellectuelle</p>
            <p>La Société conserve l'entière propriété intellectuelle de tous les créatifs publicitaires produits, incluant notamment&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>les droits d'auteur&nbsp;;</li>
              <li>les droits de reproduction&nbsp;;</li>
              <li>les droits de modification&nbsp;;</li>
              <li>les droits de distribution.</li>
            </ul>
            <p className="mt-2">Le paiement des honoraires mensuels n'inclut pas le transfert de propriété intellectuelle des créatifs.</p>

            <p className="font-semibold mt-4">42.3 Expiration de la licence à la résiliation</p>
            <p>À la date effective de résiliation du présent Contrat, pour quelque cause que ce soit, la licence d'utilisation accordée au Client prend fin automatiquement.</p>
            <p className="mt-2">Le Client devra&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>cesser immédiatement toute utilisation des créatifs produits par la Société&nbsp;;</li>
              <li>retirer les créatifs de toutes plateformes publicitaires, sites web, réseaux sociaux ou tout autre canal de diffusion&nbsp;;</li>
              <li>s'abstenir de reproduire, modifier, adapter ou distribuer les créatifs sous quelque forme que ce soit.</li>
            </ul>

            <p className="font-semibold mt-4">42.4 Acquisition des droits d'utilisation post-résiliation</p>
            <p>Si le Client souhaite continuer à utiliser les créatifs publicitaires après la résiliation du Contrat, il devra en acquérir les droits d'utilisation permanents.</p>
            <p className="mt-2">Modalités d'acquisition&nbsp;:</p>
            <ul className="list-disc ml-6 mt-1 space-y-1">
              <li>a) Le Client devra formuler une demande écrite à la Société dans un délai maximal de quatorze (14) jours suivant la date effective de résiliation.</li>
              <li>b) La Société établira un devis écrit précisant&nbsp;: la liste des créatifs concernés, le prix de cession des droits d'utilisation, l'étendue des droits cédés (utilisation, durée, territoire), les modalités de paiement.</li>
              <li>c) Les prix seront déterminés en fonction de&nbsp;: la complexité du créatif, le volume concerné, l'étendue des droits demandés, les tarifs en vigueur au moment de la demande.</li>
            </ul>
          </>
        )}
      </Section>
    </div>
  );
};

export default ContractPage15;
