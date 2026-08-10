import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
  p: (value: string, fallback?: string) => string;
  onChange?: (data: ContractData) => void;
}

const ContractPage2 = ({ data, p, onChange }: Props) => {
  const isEN = data.language === "en";
  return (
    <div className={pageClassName} style={pageStyle}>
      <p>
        {isEN
          ? "Any termination of this Contract (regardless of the reason) shall not affect the rights or obligations accrued by either party, nor shall it affect the entry into force or continued effect of any provision whose explicit or implicit intent is to enter into force or remain in force upon or after termination."
          : "Toute résiliation du présent Contrat (quelle qu'en soit l'occasion) n'affectera pas les droits ou les obligations accumulés par l'une ou l'autre des parties et n'affectera pas non plus l'entrée en vigueur ou le maintien en vigueur de toute disposition dont l'intention explicite ou implicite est d'entrer en vigueur ou de rester en vigueur au moment de la résiliation ou après celle-ci."}
      </p>

      <Section title={isEN ? "6. Warranty" : "6. Garantie"}>
        <p
          style={{ whiteSpace: "pre-wrap", outline: "none" }}
          contentEditable={!!onChange}
          suppressContentEditableWarning
          onBlur={(e) => onChange?.({ ...data, warranty: e.currentTarget.textContent || "" })}
        >
          {p(data.warranty, "{{warranty}}")}
        </p>
      </Section>

      <Section title={isEN ? "7. Relationship between the parties" : "7. Relations entre les parties"}>
        <p>
          {isEN
            ? "The parties acknowledge and agree that the services provided by the Company, its employees, agents or subcontractors are provided as independent contractors, and that nothing in this Contract shall be deemed to constitute a partnership, joint venture or otherwise between the parties."
            : "Les parties reconnaissent et conviennent que les services fournis par la Société, ses employés, ses agents ou ses sous-traitants le sont, en tant qu'entrepreneurs indépendants, et que rien dans le présent Contrat ne peut être considéré comme constituant un partenariat, une coentreprise ou autre, entre les parties."}
        </p>
      </Section>

      <Section title={isEN ? "8. Confidentiality" : "8. Confidentialité"}>
        <p>
          {isEN
            ? "Neither party shall use, copy, adapt, modify or part with information belonging to the other party that is disclosed to or comes into its possession in connection with this Contract and that is of a confidential nature."
            : "Aucune des parties n'utilisera, ne copiera, n'adaptera, ne modifiera ou ne se séparera des informations de l'autre partie qui sont divulguées ou qui entrent en sa possession dans le cadre du présent Contrat et qui sont de nature confidentielle."}
        </p>
      </Section>

      <Section title={isEN ? "9. Notices" : "9. Avis"}>
        {isEN ? (
          <>
            <p>Any notice that may be given by a party under this Contract shall be deemed to have been duly delivered if delivered in person, by first-class mail, by fax or by email to the other party's address as specified in this Contract or to any other address notified in writing to the other party.</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>first-class mail, 2 days from the postmark date;</li>
              <li>by email when the Party sending the communication receives an email delivery confirmation.</li>
            </ul>
          </>
        ) : (
          <>
            <p>Tout avis qui peut être donné par une partie en vertu du présent Contrat est réputé avoir été dûment remis s'il est remis en main propre, par courrier de première classe, par télécopie ou par courrier électronique à l'adresse de l'autre partie telle que spécifiée dans le présent Contrat ou à toute autre adresse notifiée par écrit à l'autre partie.</p>
            <ul className="list-disc ml-6 mt-2 space-y-1">
              <li>courrier de première classe, 2 jours à compter de la date du cachet de la poste&nbsp;;</li>
              <li>par courrier électronique lorsque la Partie qui envoie cette communication reçoit une confirmation de cette livraison par courrier électronique.</li>
            </ul>
          </>
        )}
      </Section>

      <Section title={isEN ? "10. Entire agreement" : "10. Accord intégral"}>
        <p>
          {isEN
            ? "This Contract contains the entire agreement between the parties. Any prior written or oral agreement between them regarding the subject matter of this Contract is null and void. There are no representations, agreements, understandings or arrangements, oral or written, between the parties concerning the subject matter of this Contract that are not fully expressed herein. This Contract is covered by our mutual confidentiality agreement."
            : "Le présent Contrat contient l'intégralité de l'accord entre les parties. Tout accord écrit ou oral antérieur entre elles concernant l'objet du présent Contrat est nul et non avenu. Il n'existe aucune déclaration, aucun accord, aucune entente ou aucun arrangement, oral ou écrit, entre les parties concernant l'objet du présent Contrat qui ne soit pas entièrement exprimé dans les présentes. Le présent Contrat est couvert par notre accord de confidentialité mutuel."}
        </p>
      </Section>

      <Section title={isEN ? "11. Amendments" : "11. Modifications"}>
        <p>
          {isEN
            ? "Any amendment to the Contract must be made in writing and signed by all members."
            : "Toute modification du Contrat doit être faite par écrit et signée par tous les membres."}
        </p>
      </Section>

      <Section title={isEN ? "12. Governing law" : "12. Loi applicable"}>
        <p>
          {isEN
            ? "All matters relating to the interpretation of this Contract and to the rights and responsibilities of the parties hereto shall be governed by the laws of Canada."
            : "Toutes les questions relatives à l'interprétation du présent Contrat et aux droits et responsabilités des parties aux présentes sont régies par les lois du Canada."}
        </p>
      </Section>

      <Section title={isEN ? "13. Severability" : "13. Divisibilité"}>
        <p>
          {isEN
            ? "If any provision of this Contract is declared invalid, void or unenforceable by a court of competent jurisdiction, the remaining provisions shall remain in force."
            : "Si l'une des dispositions du présent Contrat est déclarée invalide, nulle ou inapplicable par un tribunal de la juridiction compétente, les autres dispositions resteront en vigueur."}
        </p>
      </Section>
    </div>
  );
};

export default ContractPage2;
