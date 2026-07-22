import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, ExternalLink, Mail, MailCheck, RefreshCcw, Search, Send } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAdminClients } from "@/hooks/useAdminClients";
import {
  ONBOARDING_STEPS,
  currentStepIndex,
  timeAgo,
} from "@/lib/onboardingHelpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tab = "all" | "callback_due" | "followup_sent";

const hoursSince = (iso?: string | null) => {
  if (!iso) return null;
  const diff = Date.now() - new Date(iso).getTime();
  return Math.floor(diff / (1000 * 60 * 60));
};

const FollowUps = () => {
  const { isAuthed } = useAdminAuth();
  const { clients, loading } = useAdminClients();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [running, setRunning] = useState(false);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return clients
      .filter((c) => !c.archived_at)
      .filter((c) => c.followup_sent_at || c.callback_due_at)
      .filter((c) => {
        if (tab === "callback_due") return !!c.callback_due_at;
        if (tab === "followup_sent") return !!c.followup_sent_at && !c.callback_due_at;
        return true;
      })
      .filter((c) => {
        if (!q) return true;
        const hay = [c.client_code, c.client_name, c.company_name, c.email]
          .filter(Boolean).join(" ").toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // À rappeler first, then most recent follow-up
        const aCallback = a.callback_due_at ? 1 : 0;
        const bCallback = b.callback_due_at ? 1 : 0;
        if (aCallback !== bCallback) return bCallback - aCallback;
        const aT = new Date(a.callback_due_at || a.followup_sent_at || 0).getTime();
        const bT = new Date(b.callback_due_at || b.followup_sent_at || 0).getTime();
        return bT - aT;
      });
  }, [clients, tab, search]);

  const counts = useMemo(() => {
    const active = clients.filter((c) => !c.archived_at);
    return {
      callback: active.filter((c) => c.callback_due_at).length,
      sent: active.filter((c) => c.followup_sent_at && !c.callback_due_at).length,
      total: active.filter((c) => c.followup_sent_at || c.callback_due_at).length,
    };
  }, [clients]);

  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  const runChecks = async () => {
    setRunning(true);
    const { error } = await supabase.functions.invoke("follow-up-stuck-clients", { body: {} });
    setRunning(false);
    if (error) toast.error("Erreur lors du déclenchement");
    else toast.success("Cycle de suivi exécuté");
  };

  const sendWelcome = async (c: any) => {
    if (!c.email) { toast.error("Aucun email"); return; }
    const t = toast.loading("Envoi de l'email de bienvenue…");
    const { error } = await supabase.functions.invoke("send-client-welcome-email", {
      body: {
        to: c.email,
        client_code: c.client_code,
        company_name: c.company_name || c.brand_name,
        contact_name: c.client_name,
        slack_invite_url: c.slack_invite_url,
        slack_channel_name: c.slack_channel_name,
        payment_url: c.stripe_payment_url,
      },
    });
    toast.dismiss(t);
    if (error) toast.error(error.message || "Échec");
    else toast.success(`Bienvenue envoyé à ${c.email}`);
  };

  const sendFollowNow = async (c: any) => {
    if (!c.email) { toast.error("Aucun email"); return; }
    const t = toast.loading("Envoi de l'email de suivi…");
    const { data, error } = await supabase.functions.invoke("follow-up-stuck-clients", {
      body: { client_code: c.client_code },
    });
    toast.dismiss(t);
    if (error) toast.error(error.message || "Échec");
    else if ((data as any)?.sent > 0) toast.success(`Suivi envoyé à ${c.email}`);
    else toast.message("Aucun email envoyé");
  };

  return (
    <div className="premium-shell min-h-screen px-4 md:px-8 py-8">
      <div className="max-w-[1400px] mx-auto space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" />Dashboard</Link>
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Suivi des clients</h1>
              <p className="text-sm text-muted-foreground">
                Qui a reçu un email de relance, depuis combien de temps, et qui doit être rappelé.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={runChecks} disabled={running}>
            <RefreshCcw className={`h-4 w-4 mr-2 ${running ? "animate-spin" : ""}`} />
            Lancer un cycle de suivi
          </Button>
        </header>

        <div className="grid grid-cols-3 gap-3">
          <StatCard label="À rappeler" value={counts.callback} tone="amber" active={tab === "callback_due"} onClick={() => setTab("callback_due")} />
          <StatCard label="Suivi envoyé" value={counts.sent} tone="sky" active={tab === "followup_sent"} onClick={() => setTab("followup_sent")} />
          <StatCard label="Total en suivi" value={counts.total} active={tab === "all"} onClick={() => setTab("all")} />
        </div>

        <Card className="p-4 space-y-4 glass-card">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (nom, entreprise, email, code)…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={tab} onValueChange={(v) => setTab(v as Tab)}>
              <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous (en suivi)</SelectItem>
                <SelectItem value="callback_due">À rappeler</SelectItem>
                <SelectItem value="followup_sent">Suivi envoyé</SelectItem>
              </SelectContent>
            </Select>
            <div className="text-xs text-muted-foreground">{rows.length} client{rows.length > 1 ? "s" : ""}</div>
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Entreprise</TableHead>
                  <TableHead>Étape bloquée</TableHead>
                  <TableHead>Statut suivi</TableHead>
                  <TableHead>Email envoyé</TableHead>
                  <TableHead>Relances</TableHead>
                  <TableHead>À rappeler depuis</TableHead>
                  <TableHead>Dernière activité</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Chargement…</TableCell></TableRow>
                ) : rows.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Aucun client en suivi</TableCell></TableRow>
                ) : rows.map((c) => {
                  const detailRef = c.client_id || c.client_code;
                  const stepIdx = c.followup_step != null ? c.followup_step : currentStepIndex(c);
                  const stepLabel = ONBOARDING_STEPS[stepIdx]?.label ?? "—";
                  const callbackHours = hoursSince(c.callback_due_at);
                  const sentHours = hoursSince(c.followup_sent_at);
                  const callback = !!c.callback_due_at;
                  return (
                    <TableRow key={detailRef} className={callback ? "bg-amber-500/5" : ""}>
                      <TableCell>
                        <div className="font-medium">{c.client_name || "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{c.client_code}</div>
                        <div className="text-xs text-muted-foreground">{c.email || ""}</div>
                      </TableCell>
                      <TableCell>{c.company_name || c.brand_name || "—"}</TableCell>
                      <TableCell className="text-sm">
                        <div>Étape {stepIdx + 1}</div>
                        <div className="text-xs text-muted-foreground">{stepLabel}</div>
                      </TableCell>
                      <TableCell>
                        {callback ? (
                          <span className="inline-block px-2 py-0.5 rounded-md text-xs border border-amber-500/40 bg-amber-500/10 text-amber-300 font-medium">
                            📞 À rappeler
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 rounded-md text-xs border border-sky-500/40 bg-sky-500/10 text-sky-300">
                            ✉️ Suivi envoyé
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {c.followup_sent_at ? (
                          <>
                            <div>il y a {timeAgo(c.followup_sent_at)}</div>
                            <div className="text-xs text-muted-foreground">{sentHours}h</div>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">{c.followup_count || 0}×</TableCell>
                      <TableCell className="text-sm">
                        {callback ? (
                          <span className={callbackHours && callbackHours >= 24 ? "text-amber-300 font-medium" : ""}>
                            {timeAgo(c.callback_due_at)} ({callbackHours}h)
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{timeAgo(c.last_activity_at)}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendWelcome(c)}
                            disabled={!c.email}
                            title={c.welcome_sent_at ? "Renvoyer email de bienvenue" : "Envoyer email de bienvenue"}
                          >
                            {c.welcome_sent_at ? <MailCheck className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => sendFollowNow(c)}
                            disabled={!c.email}
                            title={c.followup_sent_at ? "Renvoyer email de suivi" : "Envoyer email de suivi"}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                          <Button asChild size="sm" variant="outline">
                            <Link to={`/admin/clients/${encodeURIComponent(detailRef)}`}>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </Card>

        <Card className="p-4 glass-card text-xs text-muted-foreground space-y-1">
          <div className="font-medium text-foreground">Comment ça marche</div>
          <div>1. Un client bloqué &gt; 24h sur une étape reçoit automatiquement un email de relance (✉️ Suivi envoyé).</div>
          <div>2. Si 24h après le suivi l'étape n'a toujours pas bougé, le statut passe à 📞 À rappeler.</div>
          <div>3. À ce stade, l'admin prend le relais (appel, message Slack) puis fait avancer le client.</div>
          <div>4. Quand le client avance d'étape, le compteur de suivi se réinitialise automatiquement.</div>
        </Card>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, tone, active, onClick }: { label: string; value: number; tone?: "amber" | "sky"; active?: boolean; onClick?: () => void }) => (
  <Card
    onClick={onClick}
    className={`p-4 glass-card cursor-pointer transition ${active ? "ring-2 ring-primary/60" : "hover:ring-1 hover:ring-primary/40"}`}
  >
    <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
    <div className={`text-2xl font-bold mt-1 ${tone === "amber" ? "text-amber-400" : tone === "sky" ? "text-sky-400" : ""}`}>
      {value}
    </div>
  </Card>
);

export default FollowUps;
