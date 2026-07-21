export interface ImportantClause {
  title: string;
  content: string;
}

export interface ContractData {
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

export const defaultContractData: ContractData = {
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
  warranty:
    "La Société déclare et garantit qu'elle fournira des services avec un soin et une compétence raisonnables.",
  cost: "",
  introduction: "",
  introductionActive: false,
  importantClausesActive: false,
  importantClauses: [],
};
