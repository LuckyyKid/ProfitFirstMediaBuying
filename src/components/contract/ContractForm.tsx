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
          <Field label={t("Nom de la marque / entreprise", "Brand / company name")}>
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
          <Field label={t("Coût (article 2 — texte libre)", "Cost (article 2 — free text)")}>
            <Textarea
              rows={3}
              value={data.cost}
              onChange={(e) => update("cost", e.target.value)}
              placeholder={t(
                "Ex: Le Client paiera 2 597 $ CAD par mois pendant les 3 premiers mois, puis 3 500 $ CAD par mois.",
                "e.g. The Client will pay CAD $2,597 per month for the first 3 months, then CAD $3,500 per month.",
              )}
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("Introduction (début du contrat)", "Introduction (start of contract)")}
            </Label>
            <Switch
              checked={data.introductionActive}
              onCheckedChange={(checked) => update("introductionActive", checked as any)}
            />
          </div>
          {data.introductionActive && (
            <Field label={t("Texte de l'introduction", "Introduction text")}>
              <Textarea
                rows={4}
                value={data.introduction}
                onChange={(e) => update("introduction", e.target.value)}
                placeholder={t(
                  "Texte d'introduction qui apparaîtra au tout début du contrat...",
                  "Introduction text that will appear at the very beginning of the contract...",
                )}
              />
            </Field>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          {t("Détails du contrat", "Contract details")}
        </h2>
        <div className="grid gap-4">
          <Field label={t("Date de début des services", "Services start date")}>
            <Input type="date" value={data.dateDeServices} onChange={(e) => update("dateDeServices", e.target.value)} />
          </Field>
          <Field label={t("Prix mensuel (CAD)", "Monthly price (CAD)")}>
            <Input
              value={data.prix}
              onChange={(e) => update("prix", e.target.value)}
              placeholder={t("Ex: 1 500", "e.g. 1,500")}
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
            <Field label={t("Durée de la période de test (mois)", "Trial period length (months)")}>
              <Input
                value={data.periodeTestMois}
                onChange={(e) => update("periodeTestMois", e.target.value)}
                placeholder={t("Ex: 3", "e.g. 3")}
              />
            </Field>
          )}
          <Field label={t("Clause de garantie (article 6)", "Warranty clause (article 6)")}>
            <Textarea
              rows={4}
              value={data.warranty}
              onChange={(e) => update("warranty", e.target.value)}
              placeholder={t("Texte de la clause de garantie...", "Warranty clause text...")}
            />
          </Field>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">
          {t("Clauses importantes", "Important clauses")}
        </h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm font-medium text-muted-foreground">
              {t("Activer les clauses importantes", "Enable important clauses")}
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
