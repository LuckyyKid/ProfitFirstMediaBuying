import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SLACK = "https://slack.com/api";
const TOKEN = Deno.env.get("SLACK_BOT_TOKEN");

async function slack(method: string, body: Record<string, unknown>) {
  const res = await fetch(`${SLACK}/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  return await res.json();
}

async function slackGet(method: string, qs: Record<string, string> = {}) {
  const url = new URL(`${SLACK}/${method}`);
  for (const [k, v] of Object.entries(qs)) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  return await res.json();
}

function normalizeChannelName(companyName: string): string {
  const base = companyName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
  return `${base}-tdia`.slice(0, 80);
}

async function findChannelByName(name: string): Promise<string | null> {
  let cursor = "";
  do {
    const data = await slackGet("conversations.list", {
      limit: "200",
      types: "private_channel,public_channel",
      exclude_archived: "true",
      ...(cursor ? { cursor } : {}),
    });
    if (!data.ok) return null;
    const hit = data.channels?.find((c: any) => c.name === name);
    if (hit) return hit.id;
    cursor = data.response_metadata?.next_cursor || "";
  } while (cursor);
  return null;
}

const TEAM_NAMES = ["mahdi", "bafing", "isaac"];

async function findTeamUserIds(): Promise<string[]> {
  const ids: string[] = [];
  let cursor = "";
  try {
    do {
      const data = await slackGet("users.list", {
        limit: "200",
        ...(cursor ? { cursor } : {}),
      });
      if (!data.ok) break;
      for (const m of data.members ?? []) {
        if (m.deleted || m.is_bot || m.id === "USLACKBOT") continue;
        const fields = [
          m.profile?.display_name,
          m.profile?.display_name_normalized,
          m.profile?.real_name,
          m.profile?.real_name_normalized,
          m.real_name,
          m.name,
          m.profile?.first_name,
        ]
          .filter(Boolean)
          .map((s: string) => s.toLowerCase());
        if (TEAM_NAMES.some((n) => fields.some((f) => f.includes(n)))) {
          if (!ids.includes(m.id)) ids.push(m.id);
        }
      }
      cursor = data.response_metadata?.next_cursor || "";
    } while (cursor);
  } catch (_) {
    /* ignore */
  }
  return ids;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const result: {
    channelId: string | null;
    channelName: string | null;
    slackUserId: string | null;
    inviteUrl: string | null;
    errors: string[];
  } = { channelId: null, channelName: null, slackUserId: null, inviteUrl: null, errors: [] };

  try {
    if (!TOKEN) {
      return new Response(
        JSON.stringify({ ...result, errors: ["SLACK_BOT_TOKEN not configured"] }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { email, companyName, clientId, clientCode } = await req.json();
    if (!companyName || typeof companyName !== "string") {
      return new Response(JSON.stringify({ error: "companyName required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channelName = normalizeChannelName(companyName);
    result.channelName = channelName;

    // 1) Create private channel
    try {
      const created = await slack("conversations.create", {
        name: channelName,
        is_private: true,
      });
      if (created.ok) {
        result.channelId = created.channel?.id ?? null;
      } else if (created.error === "name_taken") {
        const existingId = await findChannelByName(channelName);
        result.channelId = existingId;
        if (!existingId) result.errors.push("name_taken_but_not_found");
      } else {
        result.errors.push(`create:${created.error}`);
      }
    } catch (e) {
      result.errors.push(`create_exception:${(e as Error).message}`);
    }

    // 2) Lookup user by email
    if (email && typeof email === "string") {
      try {
        const lookup = await slackGet("users.lookupByEmail", { email });
        if (lookup.ok) {
          result.slackUserId = lookup.user?.id ?? null;
        } else {
          result.errors.push(`lookup:${lookup.error}`);
        }
      } catch (e) {
        result.errors.push(`lookup_exception:${(e as Error).message}`);
      }
    }

    // 3) Invite user to channel
    if (result.channelId && result.slackUserId) {
      try {
        const inv = await slack("conversations.invite", {
          channel: result.channelId,
          users: result.slackUserId,
        });
        if (!inv.ok && inv.error !== "already_in_channel") {
          result.errors.push(`invite:${inv.error}`);
        }
      } catch (e) {
        result.errors.push(`invite_exception:${(e as Error).message}`);
      }
    }

    // 4) Invite internal team (mahdi, bafing, isaac)
    if (result.channelId) {
      try {
        const teamIds = await findTeamUserIds();
        if (teamIds.length) {
          const inv = await slack("conversations.invite", {
            channel: result.channelId,
            users: teamIds.join(","),
          });
          if (!inv.ok && inv.error !== "already_in_channel") {
            // Retry one-by-one to skip already_in_channel / not_in_channel issues
            for (const uid of teamIds) {
              const one = await slack("conversations.invite", {
                channel: result.channelId,
                users: uid,
              });
              if (!one.ok && one.error !== "already_in_channel") {
                result.errors.push(`team_invite:${uid}:${one.error}`);
              }
            }
          }
        } else {
          result.errors.push("team_not_found");
        }
      } catch (e) {
        result.errors.push(`team_invite_exception:${(e as Error).message}`);
      }
    }

    // 5) Generate a shared invite link for the channel
    if (result.channelId) {
      try {
        const shared = await slack("conversations.inviteShared", {
          channel: result.channelId,
          ...(email ? { user_emails: [email] } : {}),
        });
        if (shared.ok) {
          result.inviteUrl = shared.invite_link ?? null;
        } else {
          result.errors.push(`inviteShared:${shared.error}`);
        }
      } catch (e) {
        result.errors.push(`inviteShared_exception:${(e as Error).message}`);
      }
    }

    // Persist to client_progress (by clientId or fallback clientCode)
    if (clientId || clientCode) {
      try {
        const supabase = createClient(
          Deno.env.get("SUPABASE_URL")!,
          Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        );
        const patch = {
          slack_channel_id: result.channelId,
          slack_channel_name: result.channelName,
          slack_user_id: result.slackUserId,
        };
        const q = supabase.from("client_progress").update(patch);
        const { error } = clientId
          ? await q.eq("client_id", clientId)
          : await q.eq("client_code", clientCode);
        if (error) result.errors.push(`db:${error.message}`);
      } catch (e) {
        result.errors.push(`db:${(e as Error).message}`);
      }
    }

    console.log("setup-slack-onboarding", JSON.stringify(result));

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("setup-slack-onboarding fatal", e);
    return new Response(
      JSON.stringify({ ...result, errors: [...result.errors, `fatal:${(e as Error).message}`] }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
