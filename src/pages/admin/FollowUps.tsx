import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, BellRing, ExternalLink, Mail, MailCheck, RefreshCcw, Send } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useAdminClients } from "@/hooks/useAdminClients";
import { ONBOARDING_STEPS, currentStepIndex, timeAgo } from "@/lib/onboardingHelpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  TwentyPage,
  PageHeader,
  NavPill,
  NavDivider,
  InsightStrip,
  StatPill,
  ViewBar,
  FilterChipBar,
  TwentyTableWrap,
  TwentyTable,
  TwentyThead,
  Th,
  TwentyRow,
  Td,
  EmptyRow,
  LoadingRow,
} from "@/components/admin-shell";

type Tab = "all" | "callback_due" | "followup_sent";

const TABS = [
  { key: "all", label: "Tous (en suivi)" },
  { key: "callback_due", label: "À rappeler" },
  { key: "followup_sent", label: "Suivi envoyé" },
] as const;

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

  const activeTabLabel = TABS.find((t) => t.key === tab)?.label ?? "";
  const chips = [
    ...(tab !== "all" ? [{ key: "tab", label: activeTabLabel, onRemove: () => setTab("all") }] : []),
    ...(search.trim() ? [{ key: "search", label: <>Recherche: {search}</>, onRemove: () => setSearch("") }] : []),
  ];

  return (
    <TwentyPage>
      <PageHeader
        icon={BellRing}
        title="Suivi des clients"
        description="Emails de relance, callbacks et statut de suivi"
        actions={
          <>
            <NavPill to="/admin" icon={ArrowLeft}>Dashboard</NavPill>
            <NavDivider />
            <Button variant="ghost" size="sm" onClick={runChecks} disabled={running} className="h-7 px-2 text-xs hover:bg-muted">
              <RefreshCcw className={`h-3.5 w-3.5 mr-1 ${running ? "animate-spin" : ""}`} />
              Cycle de suivi
            </Button>
          </>
        }
      />

      <InsightStrip>
        <StatPill label="À rappeler" value={counts.callback} tone="amber" onClick={() => setTab("callback_due")} active={tab === "callback_due"} />
        <StatPill label="Suivi envoyé" value={counts.sent} tone="blue" onClick={() => setTab("followup_sent")} active={tab === "followup_sent"} />
        <StatPill label="Total en suivi" value={counts.total} onClick={() => setTab("all")} active={tab === "all"} />
      </InsightStrip>

      <ViewBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Rechercher (nom, entreprise, email, code)…"
        filters={TABS}
        activeFilter={tab}
        onFilterChange={(k) => setTab(k as Tab)}
        total={rows.length}
      />

      <FilterChipBar chips={chips} onReset={() => { setTab("all"); setSearch(""); }} />

      <TwentyTableWrap>
        <TwentyTable>
          <TwentyThead>
            <Th>Client</Th>
            <Th>Entreprise</Th>
            <Th>Étape bloquée</Th>
            <Th>Statut suivi</Th>
            <Th>Email envoyé</Th>
            <Th>Relances</Th>
            <Th>À rappeler depuis</Th>
            <Th>Dernière activité</Th>
            <Th className="w-24"></Th>
          </TwentyThead>
          <tbody>
            {loading ? (
              <LoadingRow colSpan={9} />
            ) : rows.length === 0 ? (
              <EmptyRow colSpan={9} title="Aucun client en suivi" />
            ) : rows.map((c) => {
              const detailRef = c.client_id || c.client_code;
              const stepIdx = c.followup_step != null ? c.followup_step : currentStepIndex(c);
              const stepLabel = ONBOARDING_STEPS[stepIdx]?.label ?? "—";
              const callbackHours = hoursSince(c.callback_due_at);
              const sentHours = hoursSince(c.followup_sent_at);
              const callback = !!c.callback_due_at;
              return (
                <TwentyRow key={detailRef} className={callback ? "bg-amber-50/50" : ""}>
                  <Td>
                    <div className="font-medium text-foreground">{c.client_name || "—"}</div>
                    <div className="text-[10px] text-muted-foreground font-mono">{c.client_code}</div>
                    <div className="text-[10px] text-muted-foreground">{c.email || ""}</div>
                  </Td>
                  <Td>{c.company_name || c.brand_name || "—"}</Td>
                  <Td>
                    <div>Étape {stepIdx + 1}</div>
                    <div className="text-[10px] text-muted-foreground">{stepLabel}</div>
                  </Td>
                  <Td>
                    {callback ? (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border border-amber-200 bg-amber-50 text-amber-700">
                        À rappeler
                      </span>
                    ) : (
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium border border-sky-200 bg-sky-50 text-sky-700">
                        Suivi envoyé
                      </span>
                    )}
                  </Td>
                  <Td>
                    {c.followup_sent_at ? (
                      <>
                        <div>il y a {timeAgo(c.followup_sent_at)}</div>
                        <div className="text-[10px] text-muted-foreground">{sentHours}h</div>
                      </>
                    ) : "—"}
                  </Td>
                  <Td className="tabular-nums">{c.followup_count || 0}×</Td>
                  <Td>
                    {callback ? (
                      <span className={callbackHours && callbackHours >= 24 ? "text-amber-700 font-medium" : ""}>
                        {timeAgo(c.callback_due_at)} ({callbackHours}h)
                      </span>
                    ) : "—"}
                  </Td>
                  <Td className="text-[10px] text-muted-foreground whitespace-nowrap">{timeAgo(c.last_activity_at)}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => sendWelcome(c)}
                        disabled={!c.email}
                        title={c.welcome_sent_at ? "Renvoyer bienvenue" : "Envoyer bienvenue"}
                        className="h-6 w-6 hover:bg-background"
                      >
                        {c.welcome_sent_at ? <MailCheck className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => sendFollowNow(c)}
                        disabled={!c.email}
                        title={c.followup_sent_at ? "Renvoyer suivi" : "Envoyer suivi"}
                        className="h-6 w-6 hover:bg-background"
                      >
                        <Send className="h-3.5 w-3.5" />
                      </Button>
                      <Button asChild size="icon" variant="ghost" className="h-6 w-6 hover:bg-background">
                        <Link to={`/admin/clients/${encodeURIComponent(detailRef)}`}>
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </Button>
                    </div>
                  </Td>
                </TwentyRow>
              );
            })}
          </tbody>
        </TwentyTable>
      </TwentyTableWrap>

      <div className="px-4 md:px-6 py-3 border-t border-border bg-secondary/40 text-[11px] text-muted-foreground shrink-0 space-y-0.5">
        <div className="font-medium text-foreground text-xs mb-1">Comment ça marche</div>
        <div>1. Un client bloqué &gt; 24h sur une étape reçoit automatiquement un email de relance.</div>
        <div>2. Si 24h après le suivi l'étape n'a toujours pas bougé, le statut passe à « À rappeler ».</div>
        <div>3. À ce stade, l'admin prend le relais (appel, Slack) puis fait avancer le client.</div>
        <div>4. Quand le client avance d'étape, le compteur de suivi se réinitialise automatiquement.</div>
      </div>
    </TwentyPage>
  );
};

export default FollowUps;
