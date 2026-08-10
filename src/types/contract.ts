export type ContractLanguage = "fr" | "en";

export interface ImportantClause {
  title: string;
  content: string;
}

export interface ContractData {
  language: ContractLanguage;
  clientCode: string;
  dateDeServices: string;
  nomDuBrand: string;
  firstName: string;
  lastName: string;
  prix: string;
  email: string;
  signatureClient: string;
  periodeTestActive: boolean;
  periodeTestMois: string;
  warranty: string;
  cost: string;
  introduction: string;
  introductionActive: boolean;
  importantClausesActive: boolean;
  importantClauses: ImportantClause[];
}

export const defaultWarrantyByLang: Record<ContractLanguage, string> = {
  fr: "La Société déclare et garantit qu'elle fournira des services avec un soin et une compétence raisonnables.",
  en: "The Company represents and warrants that it will provide the services with reasonable care and skill.",
};

export const defaultContractData: ContractData = {
  language: "fr",
  clientCode: "",
  dateDeServices: "",
  nomDuBrand: "",
  firstName: "",
  lastName: "",
  prix: "",
  email: "",
  signatureClient: "",
  periodeTestActive: true,
  periodeTestMois: "3",
  warranty: defaultWarrantyByLang.fr,
  cost: "",
  introduction: "",
  introductionActive: false,
  importantClausesActive: false,
  importantClauses: [],
};
