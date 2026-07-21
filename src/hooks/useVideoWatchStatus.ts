import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useVideoWatchStatus(clientCode: string | null | undefined) {
  const [watchedMap, setWatchedMap] = useState<Record<string, boolean>>({});
  const [completedMap, setCompletedMap] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!clientCode) return;
    supabase
      .from("client_activity_log")
      .select("details, event_type")
      .eq("client_code", clientCode)
      .then(({ data, error }) => {
        if (error || !data) return;
        const watched: Record<string, boolean> = {};
        const completed: Record<string, boolean> = {};
        for (const row of data) {
          const details = row.details as Record<string, any> | null;
          const vid = details?.video_id as string | undefined;
          if (!vid) continue;
          watched[vid] = true;
          if (row.event_type === "video_completed") completed[vid] = true;
        }
        setWatchedMap(watched);
        setCompletedMap(completed);
      });
  }, [clientCode]);

  const isWatched = useCallback(
    (videoId: string) => !!watchedMap[videoId],
    [watchedMap]
  );
  const isCompleted = useCallback(
    (videoId: string) => !!completedMap[videoId],
    [completedMap]
  );

  const markWatched = useCallback((videoId: string) => {
    setWatchedMap((prev) => ({ ...prev, [videoId]: true }));
  }, []);
  const markCompleted = useCallback((videoId: string) => {
    setCompletedMap((prev) => ({ ...prev, [videoId]: true }));
    setWatchedMap((prev) => ({ ...prev, [videoId]: true }));
  }, []);

  return { isWatched, isCompleted, markWatched, markCompleted };
}
