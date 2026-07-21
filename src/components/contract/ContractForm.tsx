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
        <h2 className="font-display text-base font-semibold text-foreground">Lien avec le client</h2>
        <Field label="Client ID (obligatoire — ex: CLI-XXXXXXXX)">
          <Input
            value={data.clientCode}
            onChange={(e) => update("clientCode", e.target.value.trim().toUpperCase())}
            placeholder="CLI-XXXXXXXX"
            className="font-mono"
          />
        </Field>
        <p className="text-xs text-muted-foreground">
          Le contrat sera relié à ce client dans le dashboard admin et stocké dans son dossier.
        </p>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">Informations du client</h2>
        <div className="grid gap-4">
          <Field label="Nom de la marque / entreprise">
            <Input value={data.nomDuBrand} onChange={(e) => update("nomDuBrand", e.target.value)} placeholder="Ex: Boutique XYZ" />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Prénom du signataire">
              <Input value={data.firstName} onChange={(e) => update("firstName", e.target.value)} placeholder="Ex: Jean" />
            </Field>
            <Field label="Nom du signataire">
              <Input value={data.lastName} onChange={(e) => update("lastName", e.target.value)} placeholder="Ex: Dupont" />
            </Field>
          </div>
          <Field label="Email du client">
            <Input type="email" value={data.email} onChange={(e) => update("email", e.target.value)} placeholder="Ex: client@example.com" />
          </Field>
          <Field label="Coût (article 2 — texte libre)">
            <Textarea
              rows={3}
              value={data.cost}
              onChange={(e) => update("cost", e.target.value)}
              placeholder="Ex: Le Client paiera 2 597 $ CAD par mois pendant les 3 premiers mois, puis 3 500 $ CAD par mois."
            />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm font-medium text-muted-foreground">Introduction (début du contrat)</Label>
            <Switch
              checked={data.introductionActive}
              onCheckedChange={(checked) => update("introductionActive", checked as any)}
            />
          </div>
          {data.introductionActive && (
            <Field label="Texte de l'introduction">
              <Textarea
                rows={4}
                value={data.introduction}
                onChange={(e) => update("introduction", e.target.value)}
                placeholder="Texte d'introduction qui apparaîtra au tout début du contrat..."
              />
            </Field>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">Détails du contrat</h2>
        <div className="grid gap-4">
          <Field label="Date de début des services">
            <Input type="date" value={data.dateDeServices} onChange={(e) => update("dateDeServices", e.target.value)} />
          </Field>
          <Field label="Prix mensuel (CAD)">
            <Input value={data.prix} onChange={(e) => update("prix", e.target.value)} placeholder="Ex: 1 500" />
          </Field>
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm font-medium text-muted-foreground">Période de test</Label>
            <Switch
              checked={data.periodeTestActive}
              onCheckedChange={(checked) => update("periodeTestActive", checked as any)}
            />
          </div>
          {data.periodeTestActive && (
            <Field label="Durée de la période de test (mois)">
              <Input value={data.periodeTestMois} onChange={(e) => update("periodeTestMois", e.target.value)} placeholder="Ex: 3" />
            </Field>
          )}
          <Field label="Clause de garantie (article 6)">
            <Textarea
              rows={4}
              value={data.warranty}
              onChange={(e) => update("warranty", e.target.value)}
              placeholder="Texte de la clause de garantie..."
            />
          </Field>
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">Clauses importantes</h2>
        <div className="grid gap-4">
          <div className="flex items-center justify-between rounded-lg border border-border p-3">
            <Label className="text-sm font-medium text-muted-foreground">Activer les clauses importantes</Label>
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
                    <Label className="text-sm font-medium text-muted-foreground">Clause #{index + 1}</Label>
                    <Button variant="ghost" size="icon" onClick={() => removeClause(index)} className="h-7 w-7">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                  <Input
                    value={clause.title}
                    onChange={(e) => updateClause(index, { title: e.target.value })}
                    placeholder="Titre de la clause"
                  />
                  <Textarea
                    rows={3}
                    value={clause.content}
                    onChange={(e) => updateClause(index, { content: e.target.value })}
                    placeholder="Contenu de la clause..."
                  />
                </div>
              ))}
              <Button variant="outline" onClick={addClause} className="gap-2">
                <Plus className="w-4 h-4" />
                Ajouter une clause
              </Button>
            </>
          )}
        </div>
      </div>

      <div>
        <h2 className="font-display text-xl font-semibold text-foreground mb-4">Signature du client</h2>
        {data.signatureClient ? (
          <div className="relative border border-border rounded-lg p-4 bg-muted/30">
            <img src={data.signatureClient} alt="Signature client" className="max-h-20 mx-auto" />
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
              Glissez-déposez la signature ici ou <span className="text-primary underline">cliquez pour parcourir</span>
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
