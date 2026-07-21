import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage11 = () => (
  <div className={pageClassName} style={pageStyle}>
    <ul className="list-disc ml-6 space-y-1">
      <li>les frais engagés avant la date effective de résiliation&nbsp;;</li>
      <li>toute facture en cours à cette date.</li>
    </ul>

    <Section title="">
      <p className="font-semibold mt-4">32.4 Fichier de passation</p>
      <p>La Société fournira un fichier de passation raisonnable comprenant&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>l'état des campagnes actives&nbsp;;</li>
        <li>les budgets en cours&nbsp;;</li>
        <li>les recommandations stratégiques pertinentes.</li>
      </ul>
      <p className="mt-2">Ce document vise à faciliter la transition vers un nouveau prestataire ou une gestion interne.</p>

      <p className="font-semibold mt-4">32.5 Formation de transition</p>
      <p>La Société offrira une séance de formation ou de transfert de connaissances d'une durée maximale de deux (2) heures, incluse dans le cadre de la résiliation. Toute formation additionnelle fera l'objet d'une facturation distincte.</p>

      <p className="font-semibold mt-4">32.6 Support post-résiliation</p>
      <p>La Société offrira un support post-résiliation limité à un maximum de cinq (5) heures cumulatives sur une période de trente (30) jours suivant la résiliation. Au-delà de cette limite ou de cette période, toute assistance sera facturée selon les tarifs en vigueur.</p>
    </Section>

    <Section title="33. Résolution des différends">
      <p className="font-semibold">33.1 Négociation préalable obligatoire</p>
      <p>En cas de différend, litige ou réclamation découlant du présent Contrat ou s'y rapportant, les parties s'engagent à tenter de régler le différend à l'amiable, de bonne foi, dans un délai de trente (30) jours suivant la notification écrite du différend par l'une des parties. Durant cette période, les parties conviennent de collaborer activement afin de parvenir à une solution mutuellement acceptable.</p>

      <p className="font-semibold mt-4">33.2 Médiation</p>
      <p>À défaut de règlement amiable dans le délai prévu ci-dessus, le différend sera soumis à un processus de médiation tenu à Montréal, Québec, devant un médiateur choisi d'un commun accord entre les parties. Les frais de médiation seront partagés également, sauf entente contraire.</p>

      <p className="font-semibold mt-4">33.3 Compétence juridictionnelle</p>
      <p>Si la médiation échoue ou n'aboutit pas à une résolution complète du différend, les parties conviennent que tout recours judiciaire sera intenté exclusivement devant les tribunaux compétents du district judiciaire de Montréal, province de Québec. Les parties reconnaissent expressément la compétence exclusive de ces tribunaux.</p>

      <p className="font-semibold mt-4">33.4 Langue</p>
      <p>Toute procédure judiciaire ou arbitrale découlant du présent Contrat sera conduite en langue française.</p>

      <p className="font-semibold mt-4">33.5 Frais judiciaires</p>
      <p>La partie qui succombe dans un litige sera tenue de rembourser à l'autre partie les frais judiciaires et honoraires raisonnables d'avocats engagés pour faire valoir ses droits, sous réserve de la décision du tribunal compétent.</p>
    </Section>
  </div>
);

export default ContractPage11;
