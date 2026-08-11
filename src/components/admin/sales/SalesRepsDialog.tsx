import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import type { SalesRep } from "@/hooks/useSalesLeads";

interface Props {
  reps: SalesRep[];
  onClose: () => void;
  onSaved: () => void;
}

export const SalesRepsDialog = ({ reps, onClose, onSaved }: Props) => {
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const addRep = async () => {
    if (!newName.trim()) {
      toast.error("Le nom du vendeur est requis");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("sales_reps" as any)
      .insert({ name: newName.trim(), email: newEmail.trim() || null });
    setBusy(false);
    if (error) {
      toast.error(error.message || "Ajout impossible");
      return;
    }
    setNewName("");
    setNewEmail("");
    toast.success("Vendeur ajouté");
    onSaved();
  };

  const toggleActive = async (rep: SalesRep) => {
    const { error } = await supabase
      .from("sales_reps" as any)
      .update({ active: !rep.active })
      .eq("id", rep.id);
    if (error) {
      toast.error(error.message || "Mise à jour impossible");
      return;
    }
    onSaved();
  };

  const remove = async (rep: SalesRep) => {
    if (!confirm(`Supprimer ${rep.name} ? Les leads existants ne seront plus assignés.`))
      return;
    const { error } = await supabase.from("sales_reps" as any).delete().eq("id", rep.id);
    if (error) {
      toast.error(error.message || "Suppression impossible");
      return;
    }
    toast.success("Vendeur supprimé");
    onSaved();
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Vendeurs</DialogTitle>
        </DialogHeader>

        <div className="space-y-2">
          {reps.length === 0 && (
            <p className="text-sm text-muted-foreground italic">Aucun vendeur enregistré.</p>
          )}
          {reps.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 p-3 rounded border border-border/40 bg-background/40"
            >
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                {r.email && (
                  <div className="text-xs text-muted-foreground truncate">{r.email}</div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Label className="text-xs">Actif</Label>
                <Switch checked={r.active} onCheckedChange={() => toggleActive(r)} />
              </div>
              <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => remove(r)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <div className="border-t border-border/40 pt-4 space-y-2">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">
            Ajouter un vendeur
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input
              placeholder="Nom"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Input
              placeholder="Email (optionnel)"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
            />
          </div>
          <Button onClick={addRep} disabled={busy} size="sm">
            <Plus className="h-4 w-4 mr-2" /> Ajouter
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Fermer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
