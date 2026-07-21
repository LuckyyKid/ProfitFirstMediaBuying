import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { normalizeClientProgress } from "@/lib/onboardingHelpers";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const PLATFORM_VIDEO_IDS = new Set([
  "byY-v7UiUSg",
  "9W6mbJnyK4Q",
  "dAsfQZbo6kM",
  "UUMfoTrsNVA",
  "xvRb99NsQt0",
]);

const isUuid = (value: unknown) =>
  typeof value === "string" && UUID_RE.test(value.trim());

// Stale-while-revalidate: throttle external syncs to once every N ms per client.
const SYNC_TTL_MS = 60_000;
const syncedAt = new Map<string, number>();

function maybeSync(clientCode: string | null | undefined, force = false) {
  if (!clientCode) return;
  const last = syncedAt.get(clientCode) ?? 0;
  if (!force && Date.now() - last < SYNC_TTL_MS) return;
  syncedAt.set(clientCode, Date.now());
  supabase.functions
    .invoke("sync-client-from-crm", { body: { client_code: clientCode, force } })
    .catch((e) => console.warn("[sync-client-from-crm]", clientCode, e));
}

function applyInferredStepState(client: any, logs: any[]) {
  if (!client || logs.length === 0) return client;

  const completedVideos = new Map<string, string>();
  let kickoffAt = client.kickoff_completed_at ?? null;
  let platformsAt = client.platforms_completed_at ?? null;

  for (const log of logs) {
    const details = (log.details ?? {}) as Record<string, any>;
    if (log.event_type === "video_completed") {
      const videoId = details.video_id;
      if (typeof videoId === "string" && PLATFORM_VIDEO_IDS.has(videoId)) {
        completedVideos.set(videoId, log.created_at);
      }
    }
    if (log.event_type === "manual_step_completion") {
      if (details.flag === "platforms_completed_at") platformsAt = platformsAt ?? log.created_at;
      if (details.flag === "kickoff_completed_at") kickoffAt = kickoffAt ?? log.created_at;
    }
    if (log.event_type === "kickoff_completed") {
      kickoffAt = kickoffAt ?? log.created_at;
    }
  }

  if (!platformsAt && completedVideos.size === PLATFORM_VIDEO_IDS.size) {
    const ordered = Array.from(completedVideos.values()).sort();
    platformsAt = ordered[ordered.length - 1] ?? true;
  }

  return normalizeClientProgress({
    ...client,
    platforms_completed_at: client.platforms_completed_at ?? platformsAt,
    kickoff_completed_at: client.kickoff_completed_at ?? kickoffAt,
    kickoff_scheduled: client.kickoff_scheduled || Boolean(kickoffAt || client.kickoff_scheduled_at),
  });
}

export function useAdminClients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const syncedOnce = useRef(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data, error } = await supabase
        .from("client_progress")
        .select("*")
        .order("updated_at", { ascending: false });

      if (!active) return;
      if (error) console.error(error);

      const rows = data ?? [];
      const codes = rows.map((r) => r.client_code).filter(Boolean);

      const { data: logs } = codes.length === 0
        ? { data: [] }
        : await supabase
            .from("client_activity_log")
            .select("client_code, event_type, details, created_at")
            .in("client_code", codes)
            .in("event_type", ["video_completed", "kickoff_completed", "manual_step_completion"]);

      const byCode = new Map<string, any[]>();
      for (const l of logs ?? []) {
        if (!byCode.has(l.client_code)) byCode.set(l.client_code, []);
        byCode.get(l.client_code)!.push(l);
      }

      const enriched = rows.map((r) =>
        applyInferredStepState(r, byCode.get(r.client_code) ?? [])
      );
      if (!active) return;
      setClients(enriched);
      setLoading(false);

      // Background sync — staggered to avoid hammering the external CRM
      if (!syncedOnce.current) {
        syncedOnce.current = true;
        rows.forEach((r, i) => {
          setTimeout(() => maybeSync(r.client_code), i * 200);
        });
      }
    };
    load();

    const channel = supabase
      .channel("admin_clients")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "client_progress" },
        () => load()
      )
      .subscribe();

    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, []);

  return { clients, loading };
}

export function useClientDetail(clientRef: string | undefined) {
  const [client, setClient] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const refetch = async (force = false) => {
    if (!clientRef) return;
    const localQuery = supabase.from("client_progress").select("*");
    const { data: local } = await (isUuid(clientRef)
      ? localQuery.eq("client_id", clientRef).maybeSingle()
      : localQuery.eq("client_code", clientRef).maybeSingle());

    const { data: logs } = local?.client_code
      ? await supabase
          .from("client_activity_log")
          .select("client_code, event_type, details, created_at")
          .eq("client_code", local.client_code)
          .in("event_type", ["video_completed", "kickoff_completed", "manual_step_completion"])
      : { data: [] };

    setClient(applyInferredStepState(local, logs ?? []));
    setLoading(false);

    if (local?.client_code) {
      if (force) {
        setSyncing(true);
        try {
          await supabase.functions.invoke("sync-client-from-crm", {
            body: { client_code: local.client_code, force: true },
          });
          syncedAt.set(local.client_code, Date.now());
        } finally {
          setSyncing(false);
        }
      } else {
        maybeSync(local.client_code);
      }
    }
  };

  useEffect(() => {
    if (!clientRef) return;
    let active = true;
    refetch();

    const channel = supabase
      .channel(`admin_client_${clientRef}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "client_progress",
          filter: `${isUuid(clientRef) ? "client_id" : "client_code"}=eq.${clientRef}`,
        },
        () => active && refetch()
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientRef]);

  return { client, loading, syncing, refetch: () => refetch(true) };
}

export function useFormAnswers(clientCode: string | undefined) {
  const [welcome, setWelcome] = useState<any[]>([]);
  const [founder, setFounder] = useState<any[]>([]);
  useEffect(() => {
    if (!clientCode) return;
    const load = async () => {
      const { data } = await supabase
        .from("client_form_answers")
        .select("*")
        .eq("client_code", clientCode)
        .order("created_at", { ascending: true });
      setWelcome((data ?? []).filter((a) => a.form_type === "welcome_quiz"));
      setFounder((data ?? []).filter((a) => a.form_type === "founder_scan"));
    };
    load();
  }, [clientCode]);
  return { welcome, founder };
}

export function useActivityLog(clientCode: string | undefined) {
  const [logs, setLogs] = useState<any[]>([]);
  useEffect(() => {
    if (!clientCode) return;
    let active = true;
    const load = async () => {
      const { data } = await supabase
        .from("client_activity_log")
        .select("*")
        .eq("client_code", clientCode)
        .order("created_at", { ascending: false })
        .limit(100);
      if (!active) return;
      setLogs(data ?? []);
    };
    load();
    const channel = supabase
      .channel(`activity_${clientCode}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_activity_log", filter: `client_code=eq.${clientCode}` },
        (payload) => setLogs((prev) => [payload.new, ...prev])
      )
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [clientCode]);
  return logs;
}

export function usePlatformAccess(clientCode: string | undefined) {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!clientCode) return;
    const load = async () => {
      const { data } = await supabase
        .from("client_platform_access")
        .select("*")
        .eq("client_code", clientCode);
      setItems(data ?? []);
    };
    load();
  }, [clientCode]);
  return items;
}

function clientProgressMatch(clientId?: string | null, clientCode?: string | null) {
  if (isUuid(clientId)) return { column: "client_id", value: clientId.trim() } as const;
  if (clientCode?.trim()) return { column: "client_code", value: clientCode.trim() } as const;
  throw new Error("Client introuvable: aucun ID/code valide");
}

export async function archiveClient(clientId?: string | null, clientCode?: string | null, archive = true) {
  const match = clientProgressMatch(clientId, clientCode);
  const { error } = await supabase
    .from("client_progress")
    .update({ archived_at: archive ? new Date().toISOString() : null })
    .eq(match.column, match.value);
  if (error) throw error;
}

export async function deleteClient(clientId?: string | null, clientCode?: string | null) {
  // Best-effort cleanup of related rows (RLS-permitting). Ignore errors on related tables.
  if (clientCode) {
    await supabase.from("client_form_answers").delete().eq("client_code", clientCode);
    await supabase.from("client_platform_access").delete().eq("client_code", clientCode);
    await supabase.from("client_activity_log").delete().eq("client_code", clientCode);
  }
  const match = clientProgressMatch(clientId, clientCode);
  const { error } = await supabase.from("client_progress").delete().eq(match.column, match.value);
  if (error) throw error;
}

