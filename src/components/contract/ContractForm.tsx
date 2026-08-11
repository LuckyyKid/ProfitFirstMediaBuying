import { useCallback, useRef } from "react";
import { ContractData, ImportantClause } from "@/types/contract";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface ContractFormProps {
  data: ContractData;
  onChange: (data: ContractData) => void;
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="space-y-1.5">
    <Label className="text-sm font-medium text-muted-foreground">{label}</Label>
    {children}
  </div>
);

const ContractForm = ({ data, onChange }: ContractFormProps) => {
  const isEN = data.language === "en";
  const t = (fr: string, en: string) => (isEN ? en : fr);

  const update = (field: keyof ContractData, value: any) => {
    onChange({ ...data, [field]: value });
  };

  const clauses = data.importantClauses ?? [];

  const updateClause = (index: number, patch: Partial<ImportantClause>) => {
    const next = [...clauses];
    next[index] = { ...next[index], ...patch };
    onChange({ ...data, importantClauses: next });
  };

  const addClause = () =>
    onChange({ ...data, importantClauses: [...clauses, { title: "", content: "" }] });

  const removeClause = (index: number) =>
    onChange({ ...data, importantClauses: clauses.filter((_, i) => i !== index) });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSignatureFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) update("signatureClient", result);
      };
      reader.readAsDataURL(file);
    },
    [data],
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleSignatureFile(file);
    },
    [handleSignatureFile],
  );

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-3">
        <h2 className="font-display text-base font-semibold text-foreground">
          {t("Lien avec le client", "Link to the client")}
        </h2>
        <Field label={t("Client ID (obligatoire — ex: CLI-XXXXXXXX)", "Client ID (required — e.g. CLI-XXXXXXXX)")}>
          <Input
            value={data.clientCode}
            onChange={(e) => update("clientCode", e.target.value.trim().toUpperCase())}
            placeholder="CLI-XXXXXXXX"
            className="font-mono"
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          {t(
            "Le contrat sera relié à ce client dans le dashboard admin et stocké dans son dossier.",
            "The contract will be linked to this client in the admin dashboard and stored in their folder.",
          )}
        </p>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          {t("Informations du client", "Client information")}
        </h2>
        <div className="grid gap-4">
          <Field label={t("Nom de l'entreprise (Company_name)", "Company name (Company_name)")}>
            <Input
              value={data.nomDuBrand}
              onChange={(e) => update("nomDuBrand", e.target.value)}
              placeholder={t("Ex: Boutique XYZ", "e.g. XYZ Boutique")}
            />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("Prénom du signataire", "Signer's first name")}>
              <Input
                value={data.firstName}
                onChange={(e) => update("firstName", e.target.value)}
                placeholder={t("Ex: Jean", "e.g. John")}
              />
            </Field>
            <Field label={t("Nom du signataire", "Signer's last name")}>
              <Input
                value={data.lastName}
                onChange={(e) => update("lastName", e.target.value)}
                placeholder={t("Ex: Dupont", "e.g. Smith")}
              />
            </Field>
          </div>
          <Field label={t("Email du client", "Client email")}>
            <Input
              type="email"
              value={data.email}
              onChange={(e) => update("email", e.target.value)}
              placeholder={t("Ex: client@example.com", "e.g. client@example.com")}
            />
          </Field>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          {t("Détails du contrat", "Contract details")}
        </h2>
        <div className="grid gap-4">
          <Field label={t("Date de début des services (Service_date)", "Services start date (Service_date)")}>
            <Input
              type="date"
              value={data.dateDeServices}
              onChange={(e) => update("dateDeServices", e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("Période de test", "Trial period")}
            </Label>
            <Switch
              checked={data.periodeTestActive}
              onCheckedChange={(checked) => update("periodeTestActive", checked as any)}
            />
          </div>
          {data.periodeTestActive && (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Durée de la période de test — mois (Trial_Month_Number)", "Trial length — months (Trial_Month_Number)")}>
                <Input
                  value={data.periodeTestMois}
                  onChange={(e) => update("periodeTestMois", e.target.value)}
                  placeholder={t("Ex: 3", "e.g. 3")}
                />
              </Field>
              <Field label={t("Prix pendant la période de test (Trial_Price)", "Trial-period price (Trial_Price)")}>
                <Input
                  value={data.prixEssai}
                  onChange={(e) => update("prixEssai", e.target.value)}
                  placeholder={t("Ex: 2 597 $ CAD", "e.g. CAD $2,597")}
                />
              </Field>
            </div>
          )}
          <Field
            label={
              data.periodeTestActive
                ? t("Prix mensuel après période de test (Normal_Price)", "Monthly price after trial (Normal_Price)")
                : t("Prix mensuel (Normal_Price)", "Monthly price (Normal_Price)")
            }
          >
            <Input
              value={data.prix}
              onChange={(e) => update("prix", e.target.value)}
              placeholder={t("Ex: 3 500 $ CAD", "e.g. CAD $3,500")}
            />
          </Field>
          <Field label={t("Créatifs minimum par mois (Creative_minimum)", "Minimum creatives per month (Creative_minimum)")}>
            <Input
              value={data.creativeMinimum}
              onChange={(e) => update("creativeMinimum", e.target.value)}
              placeholder={t("Ex: 12", "e.g. 12")}
            />
          </Field>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          {t("Clauses additionnelles (optionnel)", "Additional clauses (optional)")}
        </h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("Ajouter des clauses personnalisées", "Add custom clauses")}
            </Label>
            <Switch
              checked={data.importantClausesActive}
              onCheckedChange={(checked) => update("importantClausesActive", checked)}
            />
          </div>

          {data.importantClausesActive && (
            <>
              {clauses.map((clause, index) => (
                <div key={index} className="space-y-2 rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium text-muted-foreground">
                      {t("Clause #", "Clause #")}
                      {index + 1}
                    </Label>
                    <Button variant="ghost" size="icon" onClick={() => removeClause(index)} className="h-7 w-7">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    value={clause.title}
                    onChange={(e) => updateClause(index, { title: e.target.value })}
                    placeholder={t("Titre de la clause", "Clause title")}
                  />
                  <Textarea
                    rows={3}
                    value={clause.content}
                    onChange={(e) => updateClause(index, { content: e.target.value })}
                    placeholder={t("Contenu de la clause...", "Clause content...")}
                  />
                </div>
              ))}
              <Button variant="outline" onClick={addClause} className="gap-2">
                <Plus className="w-4 h-4" />
                {t("Ajouter une clause", "Add a clause")}
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          {t("Signature du client", "Client signature")}
        </h2>
        {data.signatureClient ? (
          <div className="relative border border-border rounded-lg p-4 bg-muted/30">
            <img src={data.signatureClient} alt={t("Signature client", "Client signature")} className="max-h-20 mx-auto" />
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 right-2"
              onClick={() => update("signatureClient", "")}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <div
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/30 transition-colors"
          >
            <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {isEN ? (
                <>
                  Drop the signature here or{" "}
                  <span className="text-primary underline">click to browse</span>
                </>
              ) : (
                <>
                  Glissez-déposez la signature ici ou{" "}
                  <span className="text-primary underline">cliquez pour parcourir</span>
                </>
              )}
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSignatureFile(file);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ContractForm;
