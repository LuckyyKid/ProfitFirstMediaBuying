import { useEffect, useRef } from "react";

// Keeps the screen on during voice recording. Silently no-ops on browsers that
// don't support the Wake Lock API (iOS Safari < 16.4 mostly). Re-requests the
// lock when the tab returns to foreground since browsers release it on hide.

type Sentinel = { released: boolean; release: () => Promise<void> };

export function useWakeLock(active: boolean) {
  const sentinelRef = useRef<Sentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    const nav = navigator as Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<Sentinel> };
    };
    if (!nav.wakeLock) return;

    let cancelled = false;

    const acquire = async () => {
      try {
        const sentinel = await nav.wakeLock!.request("screen");
        if (cancelled) {
          sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
      } catch (_e) {
        // Denied or unsupported — swallow.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !sentinelRef.current?.released) {
        acquire();
      }
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      sentinelRef.current?.release().catch(() => undefined);
      sentinelRef.current = null;
    };
  }, [active]);
}
