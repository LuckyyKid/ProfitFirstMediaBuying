import { useEffect, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type WorkflowBlockKey = "setup" | "diagnosis" | "planning" | "execution" | "live" | "learning";

export type WorkflowStatus = {
  block_key: WorkflowBlockKey;
  status: string | null;
  completed_at: string | null;
};

export const DONE_STATUSES = new Set(["COMPLETED", "APPROVED", "READY", "PRÊT"]);

export function isWorkflowDone(status?: string | null) {
  return DONE_STATUSES.has((status || "").toUpperCase());
}

export async function fetchWorkflowStatuses(clientId: string): Promise<Record<WorkflowBlockKey, WorkflowStatus | undefined>> {
  const { data, error } = await (supabase as any)
    .from("gos_client_workflow_statuses")
    .select("block_key,status,completed_at")
    .eq("client_id", clientId);

  if (error) {
    console.warn("workflow status load failed", error.message);
    return {} as Record<WorkflowBlockKey, WorkflowStatus | undefined>;
  }

  return ((data ?? []) as WorkflowStatus[]).reduce((acc, row) => {
    acc[row.block_key] = row;
    return acc;
  }, {} as Record<WorkflowBlockKey, WorkflowStatus | undefined>);
}

function useWorkflowBlock(clientId: string | undefined, blockKey: WorkflowBlockKey) {
  const [status, setStatus] = useState<WorkflowStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!clientId) return;
    setLoading(true);
    (supabase as any)
      .from("gos_client_workflow_statuses")
      .select("block_key,status,completed_at")
      .eq("client_id", clientId)
      .eq("block_key", blockKey)
      .maybeSingle()
      .then(({ data, error }: any) => {
        if (cancelled) return;
        if (error) console.warn("workflow block status load failed", error.message);
        setStatus(data ?? null);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [clientId, blockKey]);

  const markCompleted = async () => {
    if (!clientId) return;
    setSaving(true);
    const completedAt = new Date().toISOString();
    const { data, error } = await (supabase as any)
      .from("gos_client_workflow_statuses")
      .upsert({
        client_id: clientId,
        block_key: blockKey,
        status: "COMPLETED",
        completed_at: completedAt,
      }, { onConflict: "client_id,block_key" })
      .select("block_key,status,completed_at")
      .single();
    setSaving(false);
    if (error) {
      toast.error("Impossible de marquer comme terminé: " + error.message);
      return;
    }
    setStatus(data);
    toast.success("Section marquée comme terminée");
  };

  return { status, loading, saving, done: isWorkflowDone(status?.status), markCompleted };
}

export function MarkBlockDoneButton({
  clientId,
  blockKey,
  label = "Marquer comme terminé",
  doneLabel = "Terminé",
  disabled,
}: {
  clientId: string | undefined;
  blockKey: WorkflowBlockKey;
  label?: string;
  doneLabel?: string;
  disabled?: boolean;
}) {
  const { loading, saving, done, markCompleted } = useWorkflowBlock(clientId, blockKey);

  return (
    <button
      className={done ? "gos-btn-secondary" : "gos-btn-primary"}
      onClick={markCompleted}
      disabled={!clientId || loading || saving || done || disabled}
      style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
    >
      {saving || loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
      {done ? doneLabel : label}
    </button>
  );
}