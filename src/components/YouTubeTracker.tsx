import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiLoadingPromise: Promise<void> | null = null;

function loadYouTubeAPI(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiLoadingPromise) return apiLoadingPromise;

  apiLoadingPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
  return apiLoadingPromise;
}

interface Props {
  videoId: string;
  clientCode?: string | null;
  title?: string;
  className?: string;
  eventType?: string;
  details?: Record<string, any>;
  onWatched?: (videoId: string) => void;
  onCompleted?: (videoId: string) => void;
}

export const YouTubeTracker = ({
  videoId,
  clientCode,
  title,
  className,
  eventType = "video_watched",
  details = {},
  onWatched,
  onCompleted,
}: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const playTrackedRef = useRef(false);
  const completedTrackedRef = useRef(false);
  const pollRef = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const logCompletion = async () => {
      if (completedTrackedRef.current) return;
      completedTrackedRef.current = true;
      onCompleted?.(videoId);
      if (!clientCode) return;
      try {
        await supabase.functions.invoke("log-activity", {
          body: {
            client_code: clientCode,
            event_type: "video_completed",
            status: "ok",
            details: { video_id: videoId, original_event: eventType, ...details },
          },
        });
      } catch (err) {
        console.error("video_completed tracking error:", err);
      }
    };

    const startPolling = () => {
      if (pollRef.current) return;
      pollRef.current = window.setInterval(() => {
        const p = playerRef.current;
        if (!p?.getCurrentTime || !p?.getDuration) return;
        try {
          const current = p.getCurrentTime();
          const duration = p.getDuration();
          if (duration > 0 && current / duration >= 0.9) {
            logCompletion();
            if (pollRef.current) {
              clearInterval(pollRef.current);
              pollRef.current = null;
            }
          }
        } catch {}
      }, 2000);
    };

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    loadYouTubeAPI().then(() => {
      if (cancelled || !containerRef.current) return;
      playerRef.current = new window.YT.Player(containerRef.current, {
        videoId,
        playerVars: { rel: 0, modestbranding: 1 },
        events: {
          onStateChange: async (e: any) => {
            // YT states: -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering
            if (e.data === 1) {
              startPolling();
              if (!playTrackedRef.current) {
                playTrackedRef.current = true;
                onWatched?.(videoId);
                if (clientCode) {
                  try {
                    const now = new Date().toISOString();
                    await supabase
                      .from("client_progress")
                      .update({
                        video_watched: true,
                        last_activity_at: now,
                        updated_at: now,
                      })
                      .eq("client_code", clientCode);
                    await supabase.functions.invoke("log-activity", {
                      body: {
                        client_code: clientCode,
                        event_type: eventType,
                        status: "ok",
                        details: { video_id: videoId, ...details },
                      },
                    });
                  } catch (err) {
                    console.error(`${eventType} tracking error:`, err);
                  }
                }
              }
            } else if (e.data === 0) {
              stopPolling();
              logCompletion();
            } else if (e.data === 2) {
              // paused — keep polling stopped to avoid noise
              stopPolling();
            }
          },
        },
      });
    });
    return () => {
      cancelled = true;
      stopPolling();
      try {
        playerRef.current?.destroy?.();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId, clientCode, eventType, JSON.stringify(details)]);

  return (
    <div className={className}>
      <div ref={containerRef} title={title} className="w-full h-full" />
    </div>
  );
};

export default YouTubeTracker;
