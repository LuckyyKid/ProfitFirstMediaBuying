export type ContractLanguage = "fr" | "en";

export interface ImportantClause {
  title: string;
  content: string;
}

// Les 7 variables du template 2026 : Service_date, Company_name, Trial_Price,
// Normal_Price, Trial_Month_Number, Creative_minimum, Client_Signatory_name
// (composé de firstName + lastName).
export interface ContractData {
  language: ContractLanguage;
  clientCode: string;
  dateDeServices: string;      // {{Service_date}}
  nomDuBrand: string;          // {{Company_name}}
  firstName: string;           // concat → {{Client_Signatory_name}}
  lastName: string;
  prix: string;                // {{Normal_Price}} (mensuel après période de test)
  prixEssai: string;           // {{Trial_Price}} (mensuel pendant période de test)
  creativeMinimum: string;     // {{Creative_minimum}}
  email: string;
  signatureClient: string;
  periodeTestActive: boolean;
  periodeTestMois: string;     // {{Trial_Month_Number}}
  importantClausesActive: boolean;
  importantClauses: ImportantClause[];
}

export const defaultContractData: ContractData = {
  language: "fr",
  clientCode: "",
  dateDeServices: "",
  nomDuBrand: "",
  firstName: "",
  lastName: "",
  prix: "",
  prixEssai: "",
  creativeMinimum: "12",
  email: "",
  signatureClient: "",
  periodeTestActive: true,
  periodeTestMois: "3",
  importantClausesActive: false,
  importantClauses: [],
};
