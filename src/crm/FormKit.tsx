import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Save } from "lucide-react";

export type FieldDef = { key: string; label: string; type?: "text" | "number" | "textarea" | "date" | "checkbox"; placeholder?: string; span?: 1 | 2 };

export function AutoForm({
  fields, initial, onSave, title, description, extra,
}: {
  fields: FieldDef[];
  initial: Record<string, any>;
  onSave: (values: Record<string, any>) => Promise<void> | void;
  title?: string;
  description?: string;
  extra?: React.ReactNode;
}) {
  const [values, setValues] = useState<Record<string, any>>(initial ?? {});
  const [saving, setSaving] = useState(false);

  const set = (k: string, v: any) => setValues(p => ({ ...p, [k]: v }));

  const submit = async () => {
    setSaving(true);
    try {
      const cleaned: Record<string, any> = {};
      for (const f of fields) {
        let v = values[f.key];
        if (f.type === "number") v = v === "" || v == null ? null : Number(v);
        if (v === "") v = null;
        cleaned[f.key] = v;
      }
      await onSave(cleaned);
      toast.success("Enregistré");
    } catch (e: any) {
      toast.error(e?.message ?? "Erreur");
    } finally { setSaving(false); }
  };

  return (
    <Card className="p-5">
      {(title || description) && (
        <div className="mb-4">
          {title && <h3 className="font-semibold text-lg">{title}</h3>}
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
        </div>
      )}
      <div className="grid grid-cols-2 gap-4">
        {fields.map(f => (
          <div key={f.key} className={f.span === 2 || f.type === "textarea" ? "col-span-2" : "col-span-1"}>
            <Label className="text-xs">{f.label}</Label>
            {f.type === "textarea" ? (
              <Textarea rows={3} value={values[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
            ) : f.type === "checkbox" ? (
              <div className="pt-2"><input type="checkbox" checked={!!values[f.key]} onChange={e => set(f.key, e.target.checked)} /></div>
            ) : (
              <Input type={f.type ?? "text"} value={values[f.key] ?? ""} onChange={e => set(f.key, e.target.value)} placeholder={f.placeholder} />
            )}
          </div>
        ))}
      </div>
      {extra}
      <div className="mt-5 flex justify-end">
        <Button onClick={submit} disabled={saving}><Save className="h-4 w-4 mr-1" /> Enregistrer</Button>
      </div>
    </Card>
  );
}
