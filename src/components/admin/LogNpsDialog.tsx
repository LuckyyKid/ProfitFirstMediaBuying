import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface LogNpsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: {
    client_code: string;
    client_name?: string | null;
    company_name?: string | null;
  } | null;
  onLogged?: () => void;
}

// Modal pour saisir un NPS relationnel après un call stratégique/renewal.
// Appelle l'edge function pulse-nps-log, qui crée la survey + response et
// applique les mêmes side-effects que pulse-response (Slack + ClickUp).
export function LogNpsDialog({ open, onOpenChange, client, onLogged }: LogNpsDialogProps) {
  const [score, setScore] = useState<number | null>(null);
  const [verbatim, setVerbatim] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reset = () => {
    setScore(null);
    setVerbatim("");
  };

  const handleClose = (v: boolean) => {
    if (!v && !submitting) reset();
    onOpenChange(v);
  };

  const submit = async () => {
    if (!client || score == null) return;
    setSubmitting(true);
    const t = toast.loading("Enregistrement du NPS…");
    try {
      const { data, error } = await supabase.functions.invoke("pulse-nps-log", {
        body: {
          client_code: client.client_code,
          score,
          verbatim: verbatim.trim() || undefined,
        },
      });
      toast.dismiss(t);
      if (error || (data && (data as any).error)) {
        toast.error(error?.message || (data as any)?.error || "Échec de l'enregistrement");
        return;
      }
      const d = data as any;
      const missing = d?.clickup_task_missing;
      toast.success(
        missing
          ? `NPS ${score}/10 loggé. Slack : ${d.slack_posted ? "ok" : "échec"}. ClickUp : pas de tâche liée.`
          : `NPS ${score}/10 loggé. Slack : ${d.slack_posted ? "ok" : "échec"}. ClickUp : ${d.clickup_commented ? "ok" : "échec"}.`,
      );
      onLogged?.();
      handleClose(false);
    } catch (e: any) {
      toast.dismiss(t);
      toast.error(e?.message || "Erreur inattendue");
    } finally {
      setSubmitting(false);
    }
  };

  const clientLabel = client?.company_name || client?.client_name || client?.client_code || "";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Logger un NPS relationnel</DialogTitle>
          <DialogDescription>
            Après un call stratégique ou renewal — {clientLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm mb-2 block">Score (0-10)</Label>
            <div className="grid grid-cols-11 gap-1">
              {Array.from({ length: 11 }, (_, n) => (
                <Button
                  key={n}
                  type="button"
                  variant={score === n ? "default" : "outline"}
                  size="sm"
                  className="h-9 p-0 text-xs"
                  onClick={() => setScore(n)}
                  disabled={submitting}
                >
                  {n}
                </Button>
              ))}
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0 = détracteur</span>
              <span>10 = promoteur</span>
            </div>
          </div>

          <div>
            <Label htmlFor="nps-verbatim" className="text-sm mb-2 block">
              Note / verbatim (optionnel)
            </Label>
            <Textarea
              id="nps-verbatim"
              rows={3}
              maxLength={1000}
              placeholder="Ce que le client a dit, mot pour mot si possible…"
              value={verbatim}
              onChange={(e) => setVerbatim(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => handleClose(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button onClick={submit} disabled={submitting || score == null}>
            {submitting ? "Envoi…" : "Enregistrer + poster"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
