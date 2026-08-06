import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "admin_notifications_last_seen";
const LOOKBACK_DAYS = 30;

export const NotificationBell = () => {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const fetchCount = async () => {
      const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();
      const { data } = await supabase
        .from("client_activity_log")
        .select("created_at")
        .eq("status", "error")
        .gte("created_at", since)
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const lastSeenRaw = localStorage.getItem(STORAGE_KEY);
      const lastSeen = lastSeenRaw ? new Date(lastSeenRaw).getTime() : 0;
      const count = (data ?? []).filter((r: any) => new Date(r.created_at).getTime() > lastSeen).length;
      setUnread(count);
    };

    fetchCount();
    const channel = supabase
      .channel("notification-bell")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_activity_log", filter: "status=eq.error" },
        () => fetchCount(),
      )
      .subscribe();

    const onFocus = () => fetchCount();
    window.addEventListener("focus", onFocus);
    const onStorage = (e: StorageEvent) => { if (e.key === STORAGE_KEY) fetchCount(); };
    window.addEventListener("storage", onStorage);

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return (
    <Button asChild size="sm" variant="hero" className="relative">
      <Link to="/admin/notifications">
        <Bell className="h-4 w-4 mr-2" />
        Notifications
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </Link>
    </Button>
  );
};
