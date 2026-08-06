import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ExternalLink, Mail, MessageSquare, RefreshCcw, Search, Send, Hash, CheckCheck } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { timeAgo } from "@/lib/onboardingHelpers";

const STORAGE_KEY = "admin_notifications_last_seen";
const LOOKBACK_DAYS = 30;

type Row = {
  id: string;
  client_code: string | null;
  event_type: string;
  status: string | null;
  error: string | null;
  details: any;
  created_at: string;
  client_name?: string | null;
  company_name?: string | null;
  email?: string | null;
  phone?: string | null;
};

const EVENT_LABEL: Record<string, { label: string; icon: any }> = {
  followup_sms_sent: { label: "SMS de suivi", icon: MessageSquare },
  followup_email_sent: { label: "Email de suivi", icon: Send },
  callback_slack_notify: { label: "Notification Slack callback", icon: Hash },
  welcome_email_sent: { label: "Email de bienvenue", icon: Mail },
  slack_invite: { label: "Invitation Slack", icon: Hash },
  slack_channel_setup: { label: "Setup canal Slack", icon: Hash },
};

const eventInfo = (evt: string) => EVENT_LABEL[evt] ?? { label: evt, icon: RefreshCcw };

const Notifications = () => {
  const { isAuthed } = useAdminAuth();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 3600 * 1000).toISOString();
    const { data: errors } = await supabase
      .from("client_activity_log")
      .select("id, client_code, event_type, status, error, details, created_at")
      .eq("status", "error")
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(200);

    const codes = Array.from(new Set((errors ?? []).map((e: any) => e.client_code).filter(Boolean)));
    let clientMap: Record<string, any> = {};
    if (codes.length) {
      const { data: clients } = await supabase
        .from("client_progress")
        .select("client_code, client_name, company_name, email, phone")
        .in("client_code", codes as string[]);
      clientMap = Object.fromEntries((clients ?? []).map((c: any) => [c.client_code, c]));
    }

    setRows(
      (errors ?? []).map((e: any) => ({
        ...e,
        client_name: e.client_code ? clientMap[e.client_code]?.client_name : null,
        company_name: e.client_code ? clientMap[e.client_code]?.company_name : null,
        email: e.client_code ? clientMap[e.client_code]?.email : null,
        phone: e.client_code ? clientMap[e.client_code]?.phone : null,
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    load();
    const channel = supabase
      .channel("notifications-list")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "client_activity_log", filter: "status=eq.error" },
        () => load(),
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const hay = [r.client_code, r.client_name, r.company_name, r.email, r.event_type, r.error]
        .filter(Boolean).join(" ").toLowerCase();
      return hay.includes(q);
    });
  }, [rows, search]);

  const markAllRead = () => {
    localStorage.setItem(STORAGE_KEY, new Date().toISOString());
    window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
    toast.success("Notifications marquées comme lues");
  };

  useEffect(() => {
    if (!loading && rows.length > 0) {
      const timer = setTimeout(() => {
        localStorage.setItem(STORAGE_KEY, new Date().toISOString());
        window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [loading, rows.length]);

  const retry = async (r: Row) => {
    if (!r.client_code) { toast.error("Aucun code client"); return; }
    setRetryingId(r.id);
    try {
      if (r.event_type === "followup_sms_sent") {
        const { data, error } = await supabase.functions.invoke("follow-up-stuck-clients", {
          body: { client_code: r.client_code, channel: "sms" },
        });
        if (error) throw error;
        if ((data as any)?.smsSent > 0) toast.success("SMS renvoyé");
        else toast.message("Aucun SMS envoyé — vérifie le téléphone");
      } else if (r.event_type === "followup_email_sent") {
        const { data, error } = await supabase.functions.invoke("follow-up-stuck-clients", {
          body: { client_code: r.client_code, channel: "email" },
        });
        if (error) throw error;
        if ((data as any)?.sent > 0) toast.success("Email renvoyé");
        else toast.message("Aucun email envoyé — vérifie l'email");
      } else if (r.event_type === "callback_slack_notify") {
        const { error } = await supabase.functions.invoke("follow-up-stuck-clients", {
          body: { client_code: r.client_code },
        });
        if (error) throw error;
        toast.success("Notification Slack retentée");
      } else if (r.event_type === "welcome_email_sent" && r.email) {
        const { error } = await supabase.functions.invoke("send-client-welcome-email", {
          body: { to: r.email, client_code: r.client_code, company_name: r.company_name },
        });
        if (error) throw error;
        toast.success("Email de bienvenue renvoyé");
      } else {
        toast.message("Réessai non supporté pour ce type d'événement — ouvre la fiche client");
      }
      await load();
    } catch (e) {
      toast.error((e as Error).message || "Échec du réessai");
    } finally {
      setRetryingId(null);
    }
  };

  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  return (
    <div className="premium-shell min-h-screen px-3 sm:px-4 md:px-8 py-6 sm:py-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Dashboard</Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Notifications</h1>
              <p className="text-sm text-muted-foreground">
                Envois automatiques qui ont échoué (email, SMS, Slack) — 30 derniers jours.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={markAllRead}>
              <CheckCheck className="h-4 w-4 mr-2" />
              Tout marquer lu
            </Button>
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCcw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Recharger
            </Button>
          </div>
        </header>

        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Rechercher (client, event, erreur…)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="text-sm text-muted-foreground">
              {filtered.length} {filtered.length > 1 ? "erreurs" : "erreur"}
            </span>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quand</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Événement</TableHead>
                  <TableHead>Erreur</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Aucune erreur récente. Tout roule.
                    </TableCell>
                  </TableRow>
                )}
                {filtered.map((r) => {
                  const info = eventInfo(r.event_type);
                  const Icon = info.icon;
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-sm whitespace-nowrap">
                        <div>il y a {timeAgo(r.created_at)}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleString("fr-FR", { timeZone: "America/Toronto" })}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {r.client_code ? (
                          <>
                            <div className="font-medium">{r.client_name || r.company_name || "—"}</div>
                            <div className="text-xs text-muted-foreground">{r.client_code}</div>
                          </>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-2">
                          <Icon className="h-4 w-4 text-muted-foreground" />
                          {info.label}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm max-w-md">
                        <div className="text-destructive text-xs break-words">
                          {r.error || (r.details ? JSON.stringify(r.details) : "—")}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => retry(r)}
                            disabled={!r.client_code || retryingId === r.id}
                            title="Réessayer"
                          >
                            <RefreshCcw className={`h-4 w-4 ${retryingId === r.id ? "animate-spin" : ""}`} />
                          </Button>
                          {r.client_code && (
                            <Button asChild size="sm" variant="outline">
                              <Link to={`/admin/clients/${encodeURIComponent(r.client_code)}`}>
                                <ExternalLink className="h-3 w-3" />
                              </Link>
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Notifications;
