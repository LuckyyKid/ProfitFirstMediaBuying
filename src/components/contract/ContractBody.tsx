import { ContractData } from "@/types/contract";
import { Section, pageStyle, pageClassName } from "./ContractSection";

interface Props {
  data: ContractData;
  p: (value: string, fallback?: string) => string;
}

// Toutes les pages du corps du contrat (articles 6 à 30) découpées en
// `.contract-page` divs pour l'export PDF (html2canvas boucle sur ce sélecteur).
// L'ordre suit exactement le template 2026 FR/EN fourni par le client.
const ContractBody = ({ data, p }: Props) => {
  const isEN = data.language === "en";
  const creativeMin = p(data.creativeMinimum, "{{Creative_minimum}}");

  return (
    <>
      {/* ─── Articles 6 à 9 ─────────────────────────────────────────────── */}
      <div className={pageClassName} style={pageStyle}>
        <Section title={isEN ? "6. Warranty" : "6. Garantie"}>
          <p>
            {isEN
              ? "The Company represents and warrants that it will provide services with reasonable care and skill."
              : "La Société déclare et garantit qu'elle fournira des services avec un soin et une compétence raisonnables."}
          </p>
        </Section>

        <Section title={isEN ? "7. Relationship between the parties" : "7. Relations entre les parties"}>
          <p>
            {isEN
              ? "The parties acknowledge and agree that the services provided by the Company, its employees, agents, or subcontractors are provided as independent contractors, and that nothing in this Agreement shall be construed as constituting a partnership, joint venture, or other relationship between the parties."
              : "Les parties reconnaissent et conviennent que les services fournis par la Société, ses employés, ses agents ou ses sous-traitants le sont, en tant qu'entrepreneurs indépendants, et que rien dans le présent Contrat ne peut être considéré comme constituant un partenariat, une coentreprise ou autre, entre les parties."}
          </p>
        </Section>

        <Section title={isEN ? "8. Confidentiality" : "8. Confidentialité"}>
          <p>
            {isEN
              ? "Neither party will use, copy, adapt, modify, or part with the other party's information that is disclosed or comes into its possession under this Agreement and that is confidential in nature."
              : "Aucune des parties n'utilisera, ne copiera, n'adaptera, ne modifiera ou ne se séparera des informations de l'autre partie qui sont divulguées ou qui entrent en sa possession dans le cadre du présent Contrat et qui sont de nature confidentielle."}
          </p>
        </Section>

        <Section title={isEN ? "9. Notices" : "9. Avis"}>
          {isEN ? (
            <>
              <p>
                Any notice given by a party under this Agreement is deemed to have been duly
                delivered if delivered by hand, by first-class mail, by fax, or by email to the
                other party's address as specified in this Agreement or to any other address
                notified in writing to the other party.
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>First-class mail: 2 days from the postmark date;</li>
                <li>
                  By email: when the sending Party receives confirmation of delivery of that email.
                </li>
              </ul>
            </>
          ) : (
            <>
              <p>
                Tout avis qui peut être donné par une partie en vertu du présent Contrat est réputé
                avoir été dûment remis s'il est remis en main propre, par courrier de première
                classe, par télécopie ou par courrier électronique à l'adresse de l'autre partie
                telle que spécifiée dans le présent Contrat ou à toute autre adresse notifiée par
                écrit à l'autre partie.
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Courrier de première classe, 2 jours à compter de la date du cachet de la poste&nbsp;;</li>
                <li>
                  Par courrier électronique lorsque la Partie qui envoie cette communication reçoit
                  une confirmation de cette livraison par courrier électronique.
                </li>
              </ul>
            </>
          )}
        </Section>
      </div>

      {/* ─── Articles 10 à 14 ───────────────────────────────────────────── */}
      <div className={pageClassName} style={pageStyle}>
        <Section title={isEN ? "10. Entire agreement" : "10. Accord intégral"}>
          <p>
            {isEN
              ? "This Agreement contains the entire agreement between the parties. Any prior written or oral agreement between them regarding the subject matter of this Agreement is null and void. There is no representation, agreement, understanding, or arrangement, oral or written, between the parties regarding the subject matter of this Agreement that is not fully expressed herein. This Agreement is covered by our mutual confidentiality agreement."
              : "Le présent Contrat contient l'intégralité de l'accord entre les parties. Tout accord écrit ou oral antérieur entre elles concernant l'objet du présent Contrat est nul et non avenu. Il n'existe aucune déclaration, aucun accord, aucune entente ou aucun arrangement, oral ou écrit, entre les parties concernant l'objet du présent Contrat qui ne soit pas entièrement exprimé dans les présentes. Le présent Contrat est couvert par notre accord de confidentialité mutuel."}
          </p>
        </Section>

        <Section title={isEN ? "11. Amendments" : "11. Modifications"}>
          <p>
            {isEN
              ? "Any amendment to the Agreement must be made in writing and signed by all members."
              : "Toute modification du Contrat doit être faite par écrit et signée par tous les membres."}
          </p>
        </Section>

        <Section title={isEN ? "12. Governing law" : "12. Loi applicable"}>
          <p>
            {isEN
              ? "All matters relating to the interpretation of this Agreement and the rights and responsibilities of the parties hereto are governed by the laws of Canada."
              : "Toutes les questions relatives à l'interprétation du présent Contrat et aux droits et responsabilités des parties aux présentes sont régies par les lois du Canada."}
          </p>
        </Section>

        <Section title={isEN ? "13. Severability" : "13. Divisibilité"}>
          <p>
            {isEN
              ? "If any provision of this Agreement is declared invalid, void, or unenforceable by a court of competent jurisdiction, the other provisions will remain in effect."
              : "Si l'une des dispositions du présent Contrat est déclarée invalide, nulle ou inapplicable par un tribunal de la juridiction compétente, les autres dispositions resteront en vigueur."}
          </p>
        </Section>

        <Section title={isEN ? "14. Headings" : "14. Titres"}>
          <p>
            {isEN
              ? "The headings preceding the paragraphs of this Agreement are for reference purposes only, do not form part of this Agreement, and shall not be taken into account in interpreting any part of this Agreement."
              : "Les titres qui précèdent les paragraphes du présent Contrat sont uniquement destinés à faciliter les références, ne font pas partie du présent Contrat et ne doivent pas être pris en compte dans l'interprétation de toute partie du présent Contrat."}
          </p>
        </Section>
      </div>

      {/* ─── Article 15 (Livrable & niveau de service) ──────────────────── */}
      <div className={pageClassName} style={pageStyle}>
        <Section title={isEN ? "15. Deliverables and service level" : "15. Livrable et niveau de service"}>
          {isEN ? (
            <>
              <p>
                The Company will provide a detailed monthly report (spending by platform, key
                performance indicators, analysis, recommendations) within ten (10) business days
                following the end of each month, as well as continuous access to advertising
                dashboards, subject to the Client maintaining the access provided.
              </p>
              <p className="mt-3">
                It will respond to written communications within 24 to 48 business hours, with
                urgent requests treated as priority. It will produce a minimum of {creativeMin}{" "}
                advertising creatives per month, including up to four (4) revision cycles each,
                with any additional revisions billed at then-current rates. It will hold a weekly
                strategy meeting, a monthly meeting, and an in-depth quarterly review, to be
                scheduled by mutual agreement; any rescheduling not reported 24 hours in advance
                may result in the loss of the session concerned.
              </p>
            </>
          ) : (
            <>
              <p>
                La Société transmettra un rapport mensuel détaillé (dépenses par plateforme,
                indicateurs de performance, analyse, recommandations) dans les dix (10) jours
                ouvrables suivant la fin de chaque mois, ainsi qu'un accès continu aux tableaux de
                bord publicitaires, sous réserve du maintien des accès fournis par le Client.
              </p>
              <p className="mt-3">
                Elle répondra aux communications écrites dans un délai de 24 à 48 heures ouvrables,
                les demandes urgentes étant traitées en priorité. Elle produira un minimum de{" "}
                {creativeMin} créatifs publicitaires par mois, incluant jusqu'à quatre (4) cycles
                de révision chacun, toute révision additionnelle étant facturée aux tarifs en
                vigueur. Elle tiendra une réunion stratégique hebdomadaire, une réunion mensuelle
                et une revue trimestrielle approfondie, à planifier d'un commun accord&nbsp;; tout
                report non signalé 24 heures à l'avance peut entraîner la perte de la séance.
              </p>
            </>
          )}
        </Section>

        <Section title={isEN ? "16. Delays, defaults and financial consequences" : "16. Retards, défauts et conséquences financières"}>
          {isEN ? (
            <>
              <p>
                If the Company fails to deliver the monthly report within the timeframe set out in
                Article 15 for a reason attributable to it, excluding a lack of access, a delay in
                Client validation, or a case of force majeure, the Client will be entitled, as its
                sole remedy, to a credit equal to five percent (5%) of the fees for the month
                concerned.
              </p>
              <p className="mt-3">
                Any amount unpaid at maturity will bear interest at a rate of two percent (2%) per
                month (24% annually), calculated daily. The Company may suspend services seven (7)
                days after the due date and terminate the Agreement if the default persists for
                fifteen (15) days after written notice; fees remain payable during the suspension,
                with no liability on the Company's part for any resulting loss of performance. The
                Client shall reimburse the Company for all reasonable collection costs, including
                attorneys' fees.
              </p>
            </>
          ) : (
            <>
              <p>
                Si la Société omet de transmettre le rapport mensuel dans le délai prévu (art. 15)
                pour une cause qui lui est imputable à l'exclusion d'un défaut d'accès, d'un retard
                de validation du Client ou d'un cas de force majeure, le Client aura droit, à titre
                de seul recours, à une remise de cinq pour cent (5&nbsp;%) des honoraires du mois
                concerné.
              </p>
              <p className="mt-3">
                Tout montant impayé à échéance porte intérêt au taux de deux pour cent (2&nbsp;%)
                par mois (24&nbsp;% annuellement), calculé quotidiennement. La Société peut
                suspendre les services sept (7) jours après l'échéance et résilier le Contrat si le
                défaut persiste quinze (15) jours après avis écrit&nbsp;; les honoraires demeurent
                exigibles durant la suspension, sans responsabilité de la Société pour les pertes
                de performance en résultant. Le Client rembourse à la Société tous les frais
                raisonnables de recouvrement, incluant les honoraires d'avocats.
              </p>
            </>
          )}
        </Section>
      </div>

      {/* ─── Articles 17 à 19 ───────────────────────────────────────────── */}
      <div className={pageClassName} style={pageStyle}>
        <Section title={isEN ? "17. Indemnification" : "17. Indemnisation"}>
          <p>
            {isEN
              ? "The Client shall indemnify the Company against any claim arising from content it provides, from any violation of third-party rights (copyright, trademarks, image rights, etc.) related to its products or communications, or from any legal non-compliance of its products or services. The Company shall indemnify the Client against any claim arising exclusively from a proven breach of confidentiality or from gross or intentional misconduct on its part, up to the total fees paid over the preceding twelve (12) months."
              : "Le Client indemnise la Société contre toute réclamation résultant du contenu qu'il fournit, d'une violation de droits de tiers (droits d'auteur, marques, image, etc.) liée à ses produits ou communications, ou d'une non-conformité légale de ses produits ou services. La Société indemnise le Client contre toute réclamation résultant exclusivement d'une violation prouvée de confidentialité ou d'une faute lourde ou intentionnelle de sa part, jusqu'à concurrence des honoraires versés au cours des douze (12) mois précédents."}
          </p>
        </Section>

        <Section title={isEN ? "18. Regulatory compliance" : "18. Conformité réglementaire"}>
          <p>
            {isEN
              ? "The Client warrants that its products, services, and advertising claims comply with applicable laws and that it holds the authorizations necessary to market them, including in regulated sectors (alcohol, health, financial services, real estate, games and contests, consumer protection, and personal information protection). The Company may refuse, suspend, or require proof of compliance for any campaign it deems non-compliant, without this constituting a breach of the Agreement; the Client remains solely responsible for the legal compliance of its products, services, and marketing communications."
              : "Le Client garantit que ses produits, services et allégations publicitaires respectent les lois applicables et qu'il détient les autorisations nécessaires à leur commercialisation, notamment dans les secteurs réglementés (alcool, santé, services financiers, immobilier, jeux et concours, protection du consommateur et des renseignements personnels). La Société peut refuser, suspendre ou exiger une preuve de conformité pour toute campagne qu'elle estime non conforme, sans que cela constitue une violation du Contrat&nbsp;; le Client demeure seul responsable de la conformité légale de ses produits, services et communications marketing."}
          </p>
        </Section>

        <Section title={isEN ? "19. Assignment and subcontracting" : "19. Cession et sous-traitance"}>
          <p>
            {isEN
              ? "The Client may not assign the Agreement without the Company's prior written consent; the Company may assign it to an affiliate or a successor in the event of a merger or reorganization. The Company may use subcontractors (graphic designers, copywriters, video editors, media buyers, consultants) while remaining fully responsible to the Client for the proper performance of the services, and while imposing equivalent confidentiality obligations on them."
              : "Le Client ne peut céder le Contrat sans l'accord écrit préalable de la Société&nbsp;; la Société peut le céder à une entité affiliée ou un successeur en cas de fusion ou réorganisation. La Société peut recourir à des sous-traitants (graphistes, rédacteurs, monteurs, média buyers, consultants) tout en demeurant pleinement responsable envers le Client de la bonne exécution des services, et en leur imposant des obligations de confidentialité équivalentes."}
          </p>
        </Section>
      </div>

      {/* ─── Articles 20 à 22 ───────────────────────────────────────────── */}
      <div className={pageClassName} style={pageStyle}>
        <Section title={isEN ? "20. Fee adjustment and revision" : "20. Ajustement et révision des tarifs"}>
          <p>
            {isEN
              ? "The Company may revise its fees once every twelve (12)-month period, not to exceed a ten percent (10%) increase unless otherwise agreed in writing, upon at least sixty (60) days' written notice before the effective date. The Client's failure to object in writing before that date constitutes acceptance of the new rates."
              : "La Société peut réviser ses honoraires une fois par période de douze (12) mois, sans excéder dix pour cent (10&nbsp;%) de majoration sauf accord écrit distinct, moyennant un avis écrit d'au moins soixante (60) jours avant l'entrée en vigueur. L'absence d'opposition écrite du Client avant cette date vaut acceptation des nouveaux tarifs."}
          </p>
        </Section>

        <Section title={isEN ? "21. Additional and out-of-scope services" : "21. Services additionnels et hors périmètre"}>
          <p>
            {isEN
              ? "Unless otherwise agreed in writing, the following are considered out of scope: organic SEO, software or SaaS application development, and the creation of custom AI tools (custom models, AI automations, chatbots, advanced API integrations). Any request for an out-of-scope service will be assessed by the Company and will be subject to a separate written quote or amendment specifying the scope, timelines, and fees, to be accepted by the Client before execution; billing will be hourly, flat-rate, or project-based, at rates in effect at the time of the request."
              : "Sauf entente écrite distincte, sont hors périmètre&nbsp;: le SEO organique, le développement d'applications logicielles ou SaaS, et la création d'outils d'IA personnalisés (modèles sur mesure, automatisations, chatbots, intégrations API avancées). Toute demande hors scope sera évaluée par la Société et fera l'objet d'un devis ou avenant écrit précisant l'étendue, les délais et les honoraires, à accepter par le Client avant exécution&nbsp;; la facturation se fait à taux horaire, au forfait ou selon un modèle de projet, aux tarifs en vigueur au moment de la demande."}
          </p>
        </Section>

        <Section title={isEN ? "22. Initial optimization period and limitation of warranty" : "22. Période d'optimisation initiale et limitation de garantie"}>
          <p>
            {isEN
              ? "The parties acknowledge that an initial optimization period of thirty (30) to forty-five (45) days following the launch of campaigns is necessary to test audiences, creatives, and messaging, and to allow platform algorithms to stabilize; performance during this period is not representative of long-term results and depends on external factors (competitiveness of the offer, market positioning, seasonality, competition, allocated budget). If results remain reasonably below expectations after this period, the Company will conduct a strategic review and make reasonable adjustments at no additional cost — the Client's sole remedy in this regard."
              : "Les parties reconnaissent qu'une période d'optimisation de trente (30) à quarante-cinq (45) jours suivant le lancement des campagnes est nécessaire pour tester les audiences, créatifs et messages, et permettre aux algorithmes des plateformes de se stabiliser&nbsp;; les performances durant cette période ne sont pas représentatives des résultats à long terme et dépendent de facteurs externes (compétitivité de l'offre, positionnement, saisonnalité, concurrence, budget alloué). Si les résultats demeurent raisonnablement inférieurs aux attentes après cette période, la Société procédera à une révision stratégique et à des ajustements raisonnables sans frais additionnels, seul recours du Client à cet égard."}
          </p>
        </Section>
      </div>

      {/* ─── Articles 23 à 24 ───────────────────────────────────────────── */}
      <div className={pageClassName} style={pageStyle}>
        <Section title={isEN ? "23. Early termination for cause" : "23. Résiliation anticipée pour cause"}>
          {isEN ? (
            <>
              <p>
                The Company may terminate the Agreement outright in the event of: persistent
                payment default exceeding fifteen (15) days after written notice; false or
                misleading representations; abusive, harassing, or threatening conduct; a breach of
                advertising platform policies attributable to the Client resulting in a risk of
                account suspension; or repeated failure to comply with contractual obligations
                despite written notice to correct.
              </p>
              <p className="mt-3">
                The Client may terminate for cause in the event of substantial non-performance of
                services for thirty (30) consecutive days without reasonable justification, a
                serious and proven breach of confidentiality by the Company, or demonstrated gross
                negligence by the Company — following written notice detailing the alleged breach
                and a reasonable fifteen (15)-day period to remedy it, where possible.
              </p>
              <p className="mt-3">
                In all cases, amounts owed up to the effective date of termination remain payable,
                neither party may claim indirect damages or lost profits related to the end of the
                Agreement, and post-termination obligations continue to apply.
              </p>
            </>
          ) : (
            <>
              <p>
                La Société peut résilier le Contrat de plein droit en cas de&nbsp;: défaut de
                paiement persistant plus de quinze (15) jours après avis écrit&nbsp;; fausse
                déclaration&nbsp;; comportement abusif, harcelant ou menaçant&nbsp;; violation des
                politiques des plateformes publicitaires imputable au Client entraînant un risque
                de suspension de compte&nbsp;; ou non-respect répété des obligations
                contractuelles malgré avis de correction.
              </p>
              <p className="mt-3">
                Le Client peut résilier pour cause en cas de non-prestation substantielle pendant
                trente (30) jours sans justification raisonnable, de violation grave et prouvée de
                la confidentialité, ou de faute lourde démontrée de la Société, après avis écrit
                détaillant le manquement et délai raisonnable de quinze (15) jours pour corriger,
                lorsque possible.
              </p>
              <p className="mt-3">
                Dans tous les cas, les montants dus jusqu'à la date de résiliation demeurent
                exigibles, aucune partie ne peut réclamer de dommages indirects ou de pertes de
                profits liés à la fin du Contrat, et les obligations post-résiliation continuent de
                s'appliquer.
              </p>
            </>
          )}
        </Section>

        <Section title={isEN ? "24. Post-termination obligations" : "24. Obligations post-résiliation"}>
          <p>
            {isEN
              ? "Subject to full payment of all amounts owed, the Company will: transfer or remove its access to the Client's accounts within seven (7) business days of termination; provide available performance reports and strategic documents (creatives remaining governed by Article 30); provide a reasonable handover file (status of campaigns, budgets, recommendations); and offer a knowledge-transfer session of up to two (2) hours as well as post-termination support limited to five (5) cumulative hours over thirty (30) days, beyond which any assistance will be billed at then-current rates. Termination does not release the Client from fees owed or expenses incurred before the effective date."
              : "Sous réserve du paiement intégral des sommes dues, la Société&nbsp;: transfère ou retire ses accès aux comptes du Client dans les sept (7) jours ouvrables suivant la résiliation&nbsp;; remet les rapports et documents stratégiques disponibles (les créatifs demeurant régis par l'art. 30)&nbsp;; fournit un fichier de passation raisonnable (état des campagnes, budgets, recommandations)&nbsp;; et offre une séance de transfert de connaissances d'un maximum de deux (2) heures ainsi qu'un support post-résiliation limité à cinq (5) heures cumulatives sur trente (30) jours, au-delà desquels toute assistance est facturée aux tarifs en vigueur. La résiliation ne libère pas le Client des honoraires échus ni des frais engagés avant la date effective."}
          </p>
        </Section>
      </div>

      {/* ─── Articles 25 à 27 ───────────────────────────────────────────── */}
      <div className={pageClassName} style={pageStyle}>
        <Section title={isEN ? "25. Dispute resolution" : "25. Résolution des différends"}>
          <p>
            {isEN
              ? "In the event of a dispute, the parties will first attempt to reach an amicable settlement in good faith within thirty (30) days following written notice. Failing that, legal proceedings will be brought exclusively before the competent courts of the judicial district of Montreal, Quebec, in the French language. The losing party shall reimburse the other party for court costs and reasonable attorneys' fees, subject to the court's decision."
              : "En cas de différend, les parties tentent d'abord un règlement à l'amiable, de bonne foi, dans les trente (30) jours suivant un avis écrit. À défaut, le recours judiciaire sera intenté exclusivement devant les tribunaux compétents du district judiciaire de Montréal, Québec, en langue française. La partie qui succombe rembourse à l'autre les frais judiciaires et honoraires raisonnables d'avocats, sous réserve de la décision du tribunal."}
          </p>
        </Section>

        <Section title={isEN ? "26. Severability" : "26. Divisibilité"}>
          <p>
            {isEN
              ? "If any provision of this Agreement is declared invalid, illegal, or unenforceable, in whole or in part, by a competent court, that provision will be deemed modified to the minimum extent necessary to render it valid and enforceable, while remaining as faithful as possible to the parties' original economic intent. If such modification is not possible, the provision concerned will be deemed severed from the Agreement. The invalidity or unenforceability of any provision will not in any way affect the validity, legality, or enforceability of the other provisions of this Agreement, which will remain in full force and effect."
              : "Si l'une quelconque des dispositions du présent Contrat est déclarée invalide, illégale ou inapplicable, en tout ou en partie, par un tribunal compétent, cette disposition sera réputée modifiée dans la mesure minimale nécessaire afin de la rendre valide et applicable, tout en respectant le plus fidèlement possible l'intention économique initiale des parties. Si une telle modification n'est pas possible, la disposition concernée sera réputée dissociée du Contrat. La nullité ou l'inapplicabilité d'une disposition n'affectera en aucun cas la validité, la légalité ou l'applicabilité des autres dispositions du présent Contrat, lesquelles demeureront pleinement en vigueur et exécutoires."}
          </p>
        </Section>

        <Section title={isEN ? "27. Waiver" : "27. Renonciation"}>
          <p>
            {isEN
              ? "The failure of either party to exercise, in whole or in part, any right, remedy, or power provided for in this Agreement shall not be construed as a waiver of that right, remedy, or power, nor shall it prevent its subsequent exercise. No waiver of any provision of this Agreement will be valid unless made in writing and signed by the party granting it. A one-time waiver of an obligation or breach shall not be construed as a continuing or general waiver of that obligation or of any other provision of the Agreement."
              : "Le fait pour l'une des parties de ne pas exercer, en tout ou en partie, un droit, recours ou pouvoir prévu au présent Contrat ne saurait être interprété comme une renonciation à ce droit, recours ou pouvoir, ni empêcher son exercice ultérieur. Aucune renonciation à une disposition du présent Contrat ne sera valide à moins d'être formulée par écrit et signée par la partie qui y consent. Une renonciation ponctuelle à une obligation ou à un manquement ne saurait être interprétée comme une renonciation continue ou générale à cette obligation ou à toute autre disposition du Contrat."}
          </p>
        </Section>
      </div>

      {/* ─── Articles 28 à 30 ───────────────────────────────────────────── */}
      <div className={pageClassName} style={pageStyle}>
        <Section title={isEN ? "28. Access to and ownership of advertising accounts" : "28. Accès et propriété des comptes publicitaires"}>
          <p>
            {isEN
              ? "The Client remains at all times the sole owner of its advertising and analytics accounts (Business Manager, Meta Ads, Google Ads, Google Analytics, and others); this Agreement does not grant the Company any ownership rights over them. Administrator access granted to the Company is limited to the term of the Agreement, does not constitute a transfer of ownership, and may be revoked by the Client at the end of the Agreement, subject to post-termination obligations. The Client remains responsible for the creation, maintenance, and payment methods associated with its accounts; the Company is not responsible for any suspension or loss of access resulting from the Client's actions or omissions."
              : "Le Client demeure en tout temps l'unique propriétaire de ses comptes publicitaires et analytiques (Business Manager, Meta Ads, Google Ads, Google Analytics et autres)&nbsp;; le Contrat ne confère à la Société aucun droit de propriété sur ceux-ci. L'accès administrateur accordé à la Société est limité à la durée du Contrat, ne constitue pas un transfert de propriété, et peut être retiré à la fin du Contrat sous réserve des obligations post-résiliation. Le Client demeure responsable de la création, du maintien et des moyens de paiement liés à ses comptes&nbsp;; la Société n'est pas responsable d'une suspension ou perte d'accès résultant d'actions ou d'omissions du Client."}
          </p>
        </Section>

        <Section title={isEN ? "29. Attribution and use of results" : "29. Attribution et utilisation des résultats"}>
          <p>
            {isEN
              ? "Subject to confidentiality obligations, the Company may use campaign results (ROAS, sales, growth, cost per acquisition, etc.) for promotional purposes (case studies, sales presentations, website, social media). Upon written request, the Client may require that this use be anonymized or its scope limited; any testimonial attributed to the Client will be validated in writing before publication."
              : "Sous réserve de la confidentialité, la Société peut utiliser les résultats des campagnes (ROAS, ventes, croissance, coût d'acquisition, etc.) à des fins promotionnelles (études de cas, présentations, site web, réseaux sociaux). Sur demande écrite, le Client peut exiger l'anonymisation de cette utilisation ou en limiter la portée&nbsp;; tout témoignage attribué au Client sera validé par écrit avant publication."}
          </p>
        </Section>

        <Section title={isEN ? "30. Intellectual property in creatives" : "30. Propriété intellectuelle et droits d'utilisation des créatifs"}>
          {isEN ? (
            <>
              <p>
                Advertising creatives (visuals, ad copy, videos, animations, designs) produced by
                the Company for the Client become the Client's exclusive property once the fees
                for the corresponding month are paid in full, including copyright, reproduction,
                modification, and distribution rights. The Client may then use them without
                restriction, on any channel of its choosing, including after termination of the
                Agreement.
              </p>
              <p className="mt-3">
                Materials provided by the Client (logos, images, trademarks) remain its exclusive
                property at all times. The same ownership rules apply to creatives produced using
                AI tools, the use of which will be disclosed upon request. If the Agreement is
                terminated while a creative is in production, the Client shall pay the value of the
                work completed to obtain ownership of it, or may choose to forgo it.
              </p>
            </>
          ) : (
            <>
              <p>
                Les créatifs publicitaires (visuels, textes, vidéos, animations, designs) produits
                par la Société pour le Client deviennent la propriété exclusive du Client dès que
                les honoraires du mois correspondant sont payés en totalité, incluant les droits
                d'auteur, de reproduction, de modification et de distribution. Le Client peut alors
                les utiliser sans restriction, sur tout canal de son choix, y compris après la
                résiliation du Contrat.
              </p>
              <p className="mt-3">
                Les éléments fournis par le Client (logos, images, marques) demeurent en tout temps
                sa propriété exclusive. Les mêmes règles de propriété s'appliquent aux créatifs
                produits avec des outils d'IA, dont l'utilisation sera divulguée sur demande. En
                cas de résiliation pendant la production d'un créatif, le Client paie la valeur des
                travaux réalisés pour en obtenir la propriété, ou peut choisir d'y renoncer.
              </p>
            </>
          )}
        </Section>
      </div>
    </>
  );
};

export default ContractBody;
