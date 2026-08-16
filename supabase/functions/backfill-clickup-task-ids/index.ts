// backfill-clickup-task-ids — one-shot pour lier les clients existants à leur
// tâche ClickUp déjà présente dans la liste 901714791842.
//
// Ne crée AUCUNE nouvelle tâche (évite les doublons). Matching :
//   1. custom field CF_CLIENT_NAME == client_progress.company_name (normalisé)
//   2. sinon custom field CF_CLIENT_NAME == client_progress.client_name (normalisé)
//   3. sinon custom field CF_EMAIL       == client_progress.email (normalisé)
//   4. sinon fallback : task.name == company_name / client_name
//
// Retourne un rapport JSON : { matched, unmatched, already_linked, errors }.
// Les clients unmatched doivent être linkés manuellement (UPDATE client_progress
// SET clickup_task_id = '...' WHERE client_code = '...').
//
// Mode dry-run par défaut : POST { apply: true } pour écrire dans la DB.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LIST_ID = "901714791842";
const CF_CLIENT_NAME = "63202fcb-ce44-4bc4-ab3d-cf8dc6b9705c";
const CF_EMAIL = "9accfe04-f53b-4b8d-b41c-dfc42f22253c";

interface ClickUpTask {
  id: string;
  name: string;
  custom_fields?: Array<{ id: string; value?: unknown }>;
}

interface ClientRow {
  client_code: string;
  client_name: string | null;
  company_name: string | null;
  email: string | null;
  clickup_task_id: string | null;
}

function norm(s: string | null | undefined): string {
  return (s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

function cfValue(task: ClickUpTask, fieldId: string): string {
  const f = task.custom_fields?.find((x) => x.id === fieldId);
  const v = f?.value;
  if (v == null) return "";
  return String(v);
}

async function fetchAllTasks(token: string): Promise<ClickUpTask[]> {
  const tasks: ClickUpTask[] = [];
  let page = 0;
  // ClickUp paginate à 100 par page ; last_page true quand plus rien.
  for (;;) {
    const url = `https://api.clickup.com/api/v2/list/${LIST_ID}/task?page=${page}&subtasks=false&include_closed=true`;
    const res = await fetch(url, { headers: { Authorization: token } });
    if (!res.ok) {
      throw new Error(`ClickUp list tasks failed ${res.status}: ${(await res.text()).slice(0, 240)}`);
    }
    const json = await res.json();
    const batch: ClickUpTask[] = json?.tasks || [];
    tasks.push(...batch);
    if (batch.length < 100) break; // dernière page
    page += 1;
    if (page > 50) break; // garde-fou 5000 tasks
  }
  return tasks;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("CLICKUP_API_TOKEN");
    if (!token) throw new Error("CLICKUP_API_TOKEN not configured");

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const svcKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supaUrl, svcKey);

    const bodyText = req.method === "POST" ? await req.text() : "";
    const body = bodyText ? JSON.parse(bodyText) : {};
    const apply: boolean = !!body?.apply;

    // 1) Load ClickUp tasks
    const tasks = await fetchAllTasks(token);
    console.log(`[backfill] loaded ${tasks.length} tasks from list ${LIST_ID}`);

    // Build 3 indexes: by CF client_name, by CF email, by task.name
    const byCfClientName = new Map<string, ClickUpTask>();
    const byEmail = new Map<string, ClickUpTask>();
    const byTaskName = new Map<string, ClickUpTask>();
    for (const t of tasks) {
      const cfName = norm(cfValue(t, CF_CLIENT_NAME));
      const cfEmail = norm(cfValue(t, CF_EMAIL));
      const tName = norm(t.name);
      if (cfName && !byCfClientName.has(cfName)) byCfClientName.set(cfName, t);
      if (cfEmail && !byEmail.has(cfEmail)) byEmail.set(cfEmail, t);
      if (tName && !byTaskName.has(tName)) byTaskName.set(tName, t);
    }

    // 2) Load client_progress rows (only active ones — completed_at set, not archived)
    const { data: clients, error: clientsErr } = await sb
      .from("client_progress")
      .select("client_code, client_name, company_name, email, clickup_task_id")
      .not("completed_at", "is", null)
      .is("archived_at", null);
    if (clientsErr) throw new Error(`client_progress load failed: ${clientsErr.message}`);
    const rows = (clients || []) as ClientRow[];
    console.log(`[backfill] loaded ${rows.length} active clients`);

    const alreadyLinked: string[] = [];
    const matched: Array<{ client_code: string; task_id: string; matched_by: string }> = [];
    const unmatched: Array<{ client_code: string; company_name: string | null; client_name: string | null; email: string | null }> = [];
    const errors: Array<{ client_code: string; error: string }> = [];

    for (const c of rows) {
      if (c.clickup_task_id) {
        alreadyLinked.push(c.client_code);
        continue;
      }
      const nCompany = norm(c.company_name);
      const nName = norm(c.client_name);
      const nEmail = norm(c.email);

      let hit: ClickUpTask | undefined;
      let matchedBy = "";
      if (nCompany && byCfClientName.has(nCompany)) {
        hit = byCfClientName.get(nCompany);
        matchedBy = "cf_client_name==company_name";
      } else if (nName && byCfClientName.has(nName)) {
        hit = byCfClientName.get(nName);
        matchedBy = "cf_client_name==client_name";
      } else if (nEmail && byEmail.has(nEmail)) {
        hit = byEmail.get(nEmail);
        matchedBy = "cf_email==email";
      } else if (nCompany && byTaskName.has(nCompany)) {
        hit = byTaskName.get(nCompany);
        matchedBy = "task.name==company_name";
      } else if (nName && byTaskName.has(nName)) {
        hit = byTaskName.get(nName);
        matchedBy = "task.name==client_name";
      }

      if (!hit) {
        unmatched.push({
          client_code: c.client_code,
          company_name: c.company_name,
          client_name: c.client_name,
          email: c.email,
        });
        continue;
      }

      if (apply) {
        const { error: upErr } = await sb
          .from("client_progress")
          .update({ clickup_task_id: hit.id })
          .eq("client_code", c.client_code);
        if (upErr) {
          errors.push({ client_code: c.client_code, error: upErr.message });
          continue;
        }
      }
      matched.push({ client_code: c.client_code, task_id: hit.id, matched_by: matchedBy });
    }

    return new Response(
      JSON.stringify({
        ok: true,
        dry_run: !apply,
        summary: {
          total_active_clients: rows.length,
          already_linked: alreadyLinked.length,
          matched: matched.length,
          unmatched: unmatched.length,
          errors: errors.length,
          clickup_tasks_scanned: tasks.length,
        },
        matched,
        unmatched,
        errors,
      }, null, 2),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[backfill] failed", (e as Error).message);
    return new Response(
      JSON.stringify({ ok: false, error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
