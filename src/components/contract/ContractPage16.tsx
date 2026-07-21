import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
  date: string;
  p: (value: string, fallback?: string) => string;
}

const ContractPage16 = ({ date }: Props) => (
  <div className={pageClassName} style={pageStyle}>
    <ul className="list-disc ml-6 space-y-1">
      <li>d) Le transfert de droits ne sera effectif qu'après&nbsp;: acceptation écrite du devis, paiement intégral, signature d'un contrat de cession de droits distinct.</li>
    </ul>

    <Section title="">
      <p className="font-semibold mt-4">42.5 Prix indicatifs</p>
      <p>Les prix de cession des droits d'utilisation permanents peuvent varier selon les catégories suivantes (titre indicatif)&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>Créatifs statiques simples (visuels avec texte)&nbsp;: 150 $ à 500 $ CAD par créatif</li>
        <li>Créatifs animés ou carrousels&nbsp;: 300 $ à 800 $ CAD par créatif</li>
        <li>Vidéos courtes (jusqu'à 30 secondes)&nbsp;: 500 $ à 1 500 $ CAD par vidéo</li>
        <li>Vidéos longues (plus de 30 secondes)&nbsp;: 1 000 $ à 3 000 $ CAD par vidéo</li>
        <li>Forfait créatifs (ensemble de la production d'un mois)&nbsp;: à déterminer selon le volume</li>
      </ul>

      <p className="font-semibold mt-4">42.6 Utilisation sans autorisation</p>
      <p>Toute utilisation des créatifs par le Client après la résiliation du Contrat, sans avoir acquis les droits conformément à l'article 42.4, constitue une violation du droit d'auteur et de la propriété intellectuelle de la Société.</p>
      <p className="mt-2">Dans un tel cas, la Société se réserve le droit de&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>exiger la cessation immédiate de l'utilisation&nbsp;;</li>
        <li>réclamer des dommages-intérêts équivalant à trois (3) fois le prix de cession qui aurait été applicable&nbsp;;</li>
        <li>intenter toute action en justice appropriée.</li>
      </ul>

      <p className="font-semibold mt-4">42.7 Éléments fournis par le Client</p>
      <p>Les éléments fournis par le Client (logos, images, photos de produits, textes, marques de commerce) demeurent la propriété exclusive du Client. La Société conserve toutefois le droit d'utiliser ces éléments dans le cadre de la création des créatifs publicitaires durant la durée du Contrat.</p>

      <p className="font-semibold mt-4">42.8 Créatifs générés par intelligence artificielle</p>
      <p>Si des créatifs sont produits en tout ou en partie à l'aide d'outils d'intelligence artificielle, les mêmes règles de propriété intellectuelle et d'acquisition de droits s'appliquent. La Société divulguera, sur demande du Client, l'utilisation d'outils d'IA dans la production des créatifs concernés.</p>

      <p className="font-semibold mt-4">42.9 Archivage et conservation</p>
      <p>La Société conservera une copie des créatifs produits pendant une période minimale de douze (12) mois suivant la résiliation du Contrat, afin de permettre au Client d'en faire l'acquisition si désiré. Passé ce délai, la Société n'est plus tenue de conserver ou de mettre à disposition les créatifs.</p>

      <p className="font-semibold mt-4">42.10 Créatifs en cours de production</p>
      <p>Si le Contrat est résilié alors que des créatifs sont en cours de production, le Client devra payer la valeur des travaux réalisés à la date de résiliation.</p>
      <p className="mt-2">Le Client pourra choisir&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>de renoncer aux créatifs non finalisés&nbsp;;</li>
        <li>de payer pour leur finalisation et d'en acquérir les droits selon les modalités de l'article 42.4.</li>
      </ul>
    </Section>

    <p className="font-bold mt-8">EN FOI DE QUOI, les parties ont dûment apposé leur signature en ce {date}.</p>
  </div>
);

export default ContractPage16;
