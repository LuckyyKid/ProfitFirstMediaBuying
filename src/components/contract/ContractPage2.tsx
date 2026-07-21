import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
  p: (value: string, fallback?: string) => string;
  onChange?: (data: ContractData) => void;
}

const ContractPage2 = ({ data, p, onChange }: Props) => (
  <div className={pageClassName} style={pageStyle}>
    <p>
      Toute résiliation du présent Contrat (quelle qu'en soit l'occasion) n'affectera pas les droits ou les obligations accumulés par l'une ou l'autre des parties et n'affectera pas non plus l'entrée en vigueur ou le maintien en vigueur de toute disposition dont l'intention explicite ou implicite est d'entrer en vigueur ou de rester en vigueur au moment de la résiliation ou après celle-ci.
    </p>

    <Section title="6. Garantie">
      <p
        style={{ whiteSpace: "pre-wrap", outline: "none" }}
        contentEditable={!!onChange}
        suppressContentEditableWarning
        onBlur={(e) => onChange?.({ ...data, warranty: e.currentTarget.textContent || "" })}
      >
        {p(data.warranty, "{{warranty}}")}
      </p>
    </Section>

    <Section title="7. Relations entre les parties">
      <p>Les parties reconnaissent et conviennent que les services fournis par la Société, ses employés, ses agents ou ses sous-traitants le sont, en tant qu'entrepreneurs indépendants, et que rien dans le présent Contrat ne peut être considéré comme constituant un partenariat, une coentreprise ou autre, entre les parties.</p>
    </Section>

    <Section title="8. Confidentialité">
      <p>Aucune des parties n'utilisera, ne copiera, n'adaptera, ne modifiera ou ne se séparera des informations de l'autre partie qui sont divulguées ou qui entrent en sa possession dans le cadre du présent Contrat et qui sont de nature confidentielle.</p>
    </Section>

    <Section title="9. Avis">
      <p>Tout avis qui peut être donné par une partie en vertu du présent Contrat est réputé avoir été dûment remis s'il est remis en main propre, par courrier de première classe, par télécopie ou par courrier électronique à l'adresse de l'autre partie telle que spécifiée dans le présent Contrat ou à toute autre adresse notifiée par écrit à l'autre partie.</p>
      <ul className="list-disc ml-6 mt-2 space-y-1">
        <li>courrier de première classe, 2 jours à compter de la date du cachet de la poste&nbsp;;</li>
        <li>par courrier électronique lorsque la Partie qui envoie cette communication reçoit une confirmation de cette livraison par courrier électronique.</li>
      </ul>
    </Section>

    <Section title="10. Accord intégral">
      <p>Le présent Contrat contient l'intégralité de l'accord entre les parties. Tout accord écrit ou oral antérieur entre elles concernant l'objet du présent Contrat est nul et non avenu. Il n'existe aucune déclaration, aucun accord, aucune entente ou aucun arrangement, oral ou écrit, entre les parties concernant l'objet du présent Contrat qui ne soit pas entièrement exprimé dans les présentes. Le présent Contrat est couvert par notre accord de confidentialité mutuel.</p>
    </Section>

    <Section title="11. Modifications">
      <p>Toute modification du Contrat doit être faite par écrit et signée par tous les membres.</p>
    </Section>

    <Section title="12. Loi applicable">
      <p>Toutes les questions relatives à l'interprétation du présent Contrat et aux droits et responsabilités des parties aux présentes sont régies par les lois du Canada.</p>
    </Section>

    <Section title="13. Divisibilité">
      <p>Si l'une des dispositions du présent Contrat est déclarée invalide, nulle ou inapplicable par un tribunal de la juridiction compétente, les autres dispositions resteront en vigueur.</p>
    </Section>
  </div>
);

export default ContractPage2;
