// Creates a Google Drive folder named after the company and persists it on client_progress.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const GATEWAY = "https://connector-gateway.lovable.dev/google_drive";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const GOOGLE_DRIVE_API_KEY = Deno.env.get("GOOGLE_DRIVE_API_KEY");
    if (!LOVABLE_API_KEY || !GOOGLE_DRIVE_API_KEY) {
      throw new Error("Google Drive connector not configured");
    }

    const { companyName, clientCode, clientId } = await req.json();
    if (!companyName) throw new Error("companyName required");

    const folderName = String(companyName).trim();

    // 1) Create folder
    const createRes = await fetch(`${GATEWAY}/drive/v3/files?fields=id,name,webViewLink`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: folderName,
        mimeType: "application/vnd.google-apps.folder",
      }),
    });
    const createBody = await createRes.text();
    if (!createRes.ok) throw new Error(`drive create failed (${createRes.status}): ${createBody.slice(0, 300)}`);
    const folder = JSON.parse(createBody);

    // 2) Make link-shareable (anyone with link can view)
    try {
      await fetch(`${GATEWAY}/drive/v3/files/${folder.id}/permissions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "X-Connection-Api-Key": GOOGLE_DRIVE_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role: "reader", type: "anyone", allowFileDiscovery: false }),
      });
    } catch (e) {
      console.warn("[drive] permission update failed:", (e as Error).message);
    }

    const folderUrl: string =
      folder.webViewLink || `https://drive.google.com/drive/folders/${folder.id}`;

    // 3) Persist on client_progress
    if (clientCode || clientId) {
      const sb = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      );
      const patch = { drive_folder_id: folder.id, drive_folder_url: folderUrl };
      const q = sb.from("client_progress").update(patch);
      const { error } = clientCode
        ? await q.eq("client_code", clientCode)
        : await q.eq("client_id", clientId);
      if (error) console.warn("[drive] db update failed:", error.message);
    }

    return new Response(
      JSON.stringify({ ok: true, folderId: folder.id, folderUrl, folderName }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[create-client-drive-folder]", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
