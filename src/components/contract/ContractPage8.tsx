import { Section, pageStyle, pageClassName } from "./ContractSection";

const ContractPage8 = () => (
  <div className={pageClassName} style={pageStyle}>
    <Section title="26. Cession et sous-traitance">
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
    </Section>

    <Section title="27. Ajustement et révision des tarifs">
      <p className="font-semibold">27.1 Révision annuelle</p>
      <p>La Société se réserve le droit de réviser ses honoraires une fois par période de douze (12) mois suivant l'entrée en vigueur du présent Contrat ou la dernière révision tarifaire. Toute augmentation annuelle ne pourra excéder dix pour cent (10 %) des honoraires alors en vigueur, sauf accord écrit distinct entre les parties.</p>

      <p className="font-semibold mt-4">27.2 Avis préalable</p>
      <p>Toute modification tarifaire devra faire l'objet d'un avis écrit transmis au Client au moins soixante (60) jours avant sa prise d'effet. L'absence d'opposition écrite du Client avant la date d'entrée en vigueur vaudra acceptation des nouveaux tarifs.</p>

      <p className="font-semibold mt-4">27.3 Droit de résiliation</p>
      <p>Si l'augmentation proposée excède dix pour cent (10 %) ou si le Client refuse les nouveaux tarifs, celui-ci pourra résilier le Contrat sans pénalité, moyennant un avis écrit transmis avant l'entrée en vigueur des nouveaux tarifs. La résiliation prendra effet à la date précédant l'application des nouveaux honoraires.</p>
    </Section>

    <Section title="28. Services additionnels et hors périmètre">
      <p className="font-semibold">28.1 Services non inclus</p>
      <p>Sauf stipulation expresse prévue à l'Annexe A ou dans une entente écrite distincte, les services suivants sont considérés comme hors du périmètre («&nbsp;hors scope&nbsp;») du présent Contrat&nbsp;:</p>
      <ul className="list-disc ml-6 mt-1 space-y-1">
        <li>SEO organique et stratégie de référencement naturel&nbsp;;</li>
        <li>Développement d'applications logicielles ou SaaS&nbsp;;</li>
      </ul>
    </Section>
  </div>
);

export default ContractPage8;
