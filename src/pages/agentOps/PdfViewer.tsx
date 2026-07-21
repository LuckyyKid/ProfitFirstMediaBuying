import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { proxyUrl } from "@/agentOps/api";
import { sanitizeRunId } from "@/agentOps/runId";
import { getTrackedRuns, trackRun } from "@/agentOps/trackedRuns";
import { BackendErrorBanner, SectionHeader } from "@/components/agentOps/Primitives";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export default function PdfViewer() {
  const [params, setParams] = useSearchParams();
  const id = sanitizeRunId(params.get("id"));
  const [draft, setDraft] = useState(id);
  const [err, setErr] = useState<string>();
  const [blobUrl, setBlobUrl] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const tracked = useMemo(() => getTrackedRuns(), [id]);

  useEffect(() => { setDraft(id); }, [id]);
  useEffect(() => { if (id) trackRun(id); }, [id]);

  // Fetch PDF with auth headers and convert to a local blob URL so the
  // browser can render it inline (iframes cannot send Authorization).
  useEffect(() => {
    if (!id) { setBlobUrl(""); return; }
    let cancelled = false;
    let created = "";
    setLoading(true);
    setErr(undefined);
    const upstream = proxyUrl(`/api/v1/runs/${encodeURIComponent(id)}/final-pdf`);
    fetch(upstream, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
        Accept: "application/pdf",
      },
    })
      .then(async (res) => {
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(`PDF fetch failed (${res.status}) ${text.slice(0, 200)}`);
        }
        const blob = await res.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setBlobUrl(created);
      })
      .catch((e) => { if (!cancelled) setErr((e as Error).message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
  }, [id]);

  const open = () => {
    const v = sanitizeRunId(draft);
    if (v) { setErr(undefined); setParams({ id: v }); }
  };

  return (
    <div className="space-y-4">
      {err && <BackendErrorBanner message={err} />}
      <SectionHeader title="PDF Viewer" subtitle={id || "no run loaded"} right={
        <div className="flex gap-2 items-center">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") open(); }}
            placeholder="run id (uuid)"
            className="w-[320px] font-mono text-xs"
          />
          <Button onClick={open} variant="default">Load</Button>
          {blobUrl && <Button asChild variant="outline"><a href={blobUrl} target="_blank" rel="noreferrer" download={`run-${id.slice(0,8)}.pdf`}>Open / Download</a></Button>}
        </div>
      } />
      {tracked.length > 0 && (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="text-muted-foreground self-center">Recent:</span>
          {tracked.map(r => (
            <button
              key={r}
              onClick={() => setParams({ id: r })}
              className="px-2 py-1 rounded border border-border hover:bg-accent font-mono"
            >{r.slice(0, 8)}…</button>
          ))}
        </div>
      )}
      {!id ? (
        <Card className="glass-card p-10 text-center text-sm text-muted-foreground">
          Entrez un Run ID ci-dessus pour charger son PDF final.
        </Card>
      ) : loading ? (
        <Card className="glass-card p-10 text-center text-sm text-muted-foreground">
          Chargement du PDF…
        </Card>
      ) : blobUrl ? (
        <>
          <div className="rounded-md border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 text-xs px-3 py-2">
            Si Brave (ou un bloqueur) empêche l'affichage inline, utilisez{" "}
            <a href={blobUrl} target="_blank" rel="noreferrer" className="underline font-medium">Ouvrir dans un nouvel onglet</a>
            {" "}ou{" "}
            <a href={blobUrl} download={`run-${id.slice(0,8)}.pdf`} className="underline font-medium">Télécharger</a>.
          </div>
          <div className="flex gap-2">
            <Button asChild>
              <a href={blobUrl} target="_blank" rel="noreferrer">Ouvrir dans un nouvel onglet</a>
            </Button>
            <Button variant="outline" asChild>
              <a href={blobUrl} download={`run-${id.slice(0,8)}.pdf`}>Télécharger le PDF</a>
            </Button>
          </div>
          <Card className="glass-card p-0 overflow-hidden">
            <iframe
              key={blobUrl}
              title="Final PDF"
              src={blobUrl}
              className="w-full h-[80vh] bg-white"
            />
          </Card>
        </>
      ) : null}
    </div>
  );
}
