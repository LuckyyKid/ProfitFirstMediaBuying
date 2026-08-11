import { useState, useCallback, useEffect } from "react";
import { Navigate, Link, useSearchParams } from "react-router-dom";
import { ContractData, ContractLanguage, defaultContractData } from "@/types/contract";
import ContractForm from "@/components/contract/ContractForm";
import ContractDocxPreview from "@/components/contract/ContractDocxPreview";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { FileDown, Eye, PenLine, Mail, ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { supabase } from "@/integrations/supabase/client";
import logoTDIA from "@/assets/contract/logo-tdia.png";
import { fillContractDocxBlob, fillContractDocxBase64, DOCX_MIME } from "@/lib/contract-docx";

type GenerationResult = {
  clientCode: string;
  clientName: string;
  deliveryMode: "embedded" | "email";
  pdfSaved: boolean;
  storageUploaded: boolean;
  envelopeId: string | null;
  emailSentTo: string | null;
  docusignError: string | null;
};

const ContractCreator = () => {
  const { isAuthed } = useAdminAuth();
  const [data, setData] = useState<ContractData>(defaultContractData);
  const [view, setView] = useState<"form" | "preview">("form");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [params] = useSearchParams();
  const dealId = params.get("deal");
  const clientCode = params.get("client");

  // Prefill from a closed deal or directly from a client_progress row.
  useEffect(() => {
    let cancelled = false;
    const prefill = async () => {
      try {
        let deal: any = null;
        let code = clientCode;
        if (dealId) {
          const { data: d } = await (supabase as any)
            .from("closed_deals")
            .select("*")
            .eq("id", dealId)
            .maybeSingle();
          deal = d;
          code = code || d?.client_code || null;
        }
        let client: any = null;
        if (code) {
          const { data: c } = await supabase
            .from("client_progress")
            .select("client_code, client_name, company_name, brand_name, email, phone, deal_value, closing_date")
            .eq("client_code", code)
            .maybeSingle();
          client = c;
        }
        if (cancelled || (!deal && !client)) return;

        const fullName =
          deal?.contact_name || deal?.owner_name || client?.client_name || "";
        const [firstName, ...rest] = (fullName || "").trim().split(/\s+/);
        const lastName = rest.join(" ");
        const brand =
          deal?.owner_business || deal?.company_name || client?.brand_name || client?.company_name || "";
        const email = deal?.owner_email || client?.email || "";
        const amount =
          deal?.payment_type === "one_time"
            ? deal?.contract_value
            : deal?.monthly_amount;
        const prix =
          amount != null
            ? `${Number(amount).toLocaleString()} $${deal?.payment_type === "recurring" ? "/mois" : ""}`
            : client?.deal_value
              ? `${Number(client.deal_value).toLocaleString()} $`
              : "";
        const dateSrv = deal?.closing_date || client?.closing_date || "";

        setData((prev) => ({
          ...prev,
          clientCode: code || prev.clientCode,
          firstName: firstName || prev.firstName,
          lastName: lastName || prev.lastName,
          nomDuBrand: brand || prev.nomDuBrand,
          email: email || prev.email,
          prix: prix || prev.prix,
          dateDeServices: dateSrv || prev.dateDeServices,
        }));
        if (code) toast.success(`Contrat pré-rempli pour ${code}`);
      } catch (e) {
        console.warn("[contract prefill]", e);
      }
    };
    if (dealId || clientCode) prefill();
    return () => { cancelled = true; };
  }, [dealId, clientCode]);

  if (!isAuthed) return <Navigate to="/admin/login" replace />;

  const isEN = data.language === "en";
  const t = (fr: string, en: string) => (isEN ? en : fr);

  const setLanguage = (lang: ContractLanguage) => {
    setData((prev) => (prev.language === lang ? prev : { ...prev, language: lang }));
  };

  const generateDOCX = useCallback(async (deliveryMode: "embedded" | "email" = "embedded") => {
    const code = (data.clientCode || "").trim().toUpperCase();
    if (!code) {
      toast.error(
        data.language === "en"
          ? "Please enter the Client ID to link the contract"
          : "Veuillez renseigner le Client ID pour relier le contrat",
      );
      return;
    }
    setGenerating(true);
    try {
      // Verify client exists
      const { data: client } = await supabase
        .from("client_progress")
        .select("client_code, client_name, company_name, email")
        .eq("client_code", code)
        .maybeSingle();
      if (!client) {
        toast.error(
          data.language === "en"
            ? `No client found with code ${code}`
            : `Aucun client trouvé avec le code ${code}`,
        );
        setGenerating(false);
        return;
      }

      // Fill the .docx template with the current form values — same helpers
      // used by the live preview, so what you see is what the client gets.
      // Base64 comes straight from pizzip (no data-URI prefix, no whitespace,
      // padded to a multiple of 4) — DocuSign's .NET decoder is strict.
      const [blob, docxBase64] = await Promise.all([
        fillContractDocxBlob(data),
        fillContractDocxBase64(data),
      ]);
      const filename = `contrat-${code}-${Date.now()}.docx`;

      // 2) Upload to storage (best-effort — no longer critical to DocuSign flow)
      const path = `${code}/${filename}`;
      let manualUrl: string | null = null;
      let storageUploaded = false;
      const { error: upErr } = await supabase.storage
        .from("closed-deals-contracts")
        .upload(path, blob, { contentType: DOCX_MIME, upsert: true });
      if (upErr) console.warn("[contract upload]", upErr);
      else {
        storageUploaded = true;
        const { data: pub } = supabase.storage
          .from("closed-deals-contracts")
          .getPublicUrl(path);
        manualUrl = pub.publicUrl;
      }

      // 3) Build the DocuSign envelope RIGHT NOW with the fresh base64. We don't
      // rely on the edge function re-fetching the URL — we pass the bytes.
      // DocuSign auto-converts the .docx to PDF for signing.
      const signerEmail = data.email?.trim() || client.email || null;
      const signatoryName = [data.firstName, data.lastName].filter(Boolean).join(" ").trim();
      const fullName = signatoryName || client.client_name || code;
      let envelopeId: string | null = null;
      let emailSentTo: string | null = null;
      let docusignError: string | null = null;
      if (signerEmail && fullName) {
        try {
          // Two distinct edge functions so the Step 7 embedded flow and the
          // admin email flow never step on each other's toes.
          const fnName = deliveryMode === "email"
            ? "send-docusign-contract-email"
            : "create-docusign-envelope";
          const invokeBody = deliveryMode === "email"
            ? {
                email: signerEmail,
                name: fullName,
                client_code: code,
                contract_docx_base64: docxBase64,
              }
            : {
                email: signerEmail,
                name: fullName,
                client_code: code,
                return_url: `${window.location.origin}/step8`,
                contract_docx_base64: docxBase64,
              };
          console.log("[contract → docusign] invoking", fnName, {
            email: signerEmail,
            name: fullName,
            client_code: code,
            docxBase64_length: docxBase64.length,
            docxBase64_mod4: docxBase64.length % 4,
            docxBase64_head: docxBase64.slice(0, 32),
            docxBase64_tail: docxBase64.slice(-16),
          });
          const { data: dsData, error: dsErr } = await supabase.functions.invoke(
            fnName,
            { body: invokeBody },
          );
          console.log("[contract → docusign] response", { dsData, dsErr });
          if (dsErr) {
            // Supabase wraps non-2xx into FunctionsHttpError; the real payload
            // lives on error.context (a Response). Try every known surface —
            // text(), json(), .body — because supabase-js versions differ.
            const ctx: any = (dsErr as any)?.context;
            let detail = "";
            let bodyJson: any = null;
            try {
              if (ctx && typeof ctx.clone === "function" && typeof ctx.text === "function") {
                const raw = await ctx.clone().text();
                detail = raw?.slice(0, 500) || "";
                try { bodyJson = JSON.parse(raw); } catch { /* not JSON */ }
              } else if (ctx?.body) {
                detail = typeof ctx.body === "string" ? ctx.body.slice(0, 500) : JSON.stringify(ctx.body).slice(0, 500);
              }
            } catch (readErr) {
              console.warn("[contract → docusign] could not read error body", readErr);
            }
            console.error("[contract → docusign] non-2xx", {
              message: dsErr.message,
              status: ctx?.status,
              statusText: ctx?.statusText,
              headers: ctx?.headers ? Object.fromEntries((ctx.headers as any).entries?.() ?? []) : null,
              body_raw: detail,
              body_json: bodyJson,
            });
            const humanMsg = bodyJson?.error
              ? (bodyJson.details?.message
                  ? `${bodyJson.error}: ${bodyJson.details.message}`
                  : bodyJson.error)
              : (detail || dsErr.message);
            throw new Error(
              `[${ctx?.status ?? "??"}] ${humanMsg}`.slice(0, 400),
            );
          }
          envelopeId = (dsData as any)?.envelopeId ?? null;
          emailSentTo = (dsData as any)?.emailSentTo ?? null;
          if (!envelopeId) {
            docusignError = data.language === "en"
              ? "DocuSign returned no envelope ID"
              : "DocuSign a répondu sans envelope ID";
          }
        } catch (e: any) {
          console.error("[contract → docusign]", e);
          docusignError = e?.message || (data.language === "en"
            ? "DocuSign send failed"
            : "Envoi DocuSign échoué");
        }
      } else {
        docusignError = data.language === "en"
          ? "Signer email or name is missing"
          : "Email ou nom du signataire manquant";
      }

      // 4) Persist: link the manual URL and the fresh envelope id (or null if it
      // failed). In email mode we don't overwrite the embedded envelope id —
      // Step7 keeps working with its own envelope; the email envelope is a
      // separate DocuSign envelope that the client signs from their inbox.
      const progressUpdate: Record<string, unknown> = {
        manual_contract_pdf_url: manualUrl,
        updated_at: new Date().toISOString(),
      };
      if (deliveryMode === "embedded") {
        progressUpdate.docusign_envelope_id = envelopeId;
        progressUpdate.docusign_link = null;
        progressUpdate.docusign_sent_at = envelopeId ? new Date().toISOString() : null;
      }
      await (supabase as any)
        .from("client_progress")
        .update(progressUpdate)
        .eq("client_code", code);

      // 5) Trigger local download of the .docx
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setResult({
        clientCode: code,
        clientName: client.client_name || client.company_name || code,
        deliveryMode,
        pdfSaved: true,
        storageUploaded,
        envelopeId,
        emailSentTo,
        docusignError,
      });
    } catch (err) {
      console.error("[ContractCreator generateDOCX]", err);
      const detail = (err as Error)?.message?.slice(0, 200) || "";
      toast.error(
        (data.language === "en"
          ? "Error while generating the contract"
          : "Erreur lors de la génération du contrat")
        + (detail ? ` — ${detail}` : ""),
      );
    } finally {
      setGenerating(false);
    }
  }, [data]);

  return (
    <div className="premium-shell min-h-screen bg-background">
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/admin"><ArrowLeft className="w-4 h-4 mr-1" />Admin</Link>
            </Button>
            <img src={logoTDIA} alt="TDIA" className="h-8" />
            <p className="text-sm text-muted-foreground hidden md:block">
              {t("Générateur de contrats", "Contract generator")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className="flex items-center bg-secondary rounded-lg p-1"
              role="group"
              aria-label={t("Langue du contrat", "Contract language")}
            >
              <button
                onClick={() => setLanguage("fr")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${!isEN ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                aria-pressed={!isEN}
              >
                FR
              </button>
              <button
                onClick={() => setLanguage("en")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold uppercase tracking-wider transition-colors ${isEN ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                aria-pressed={isEN}
              >
                EN
              </button>
            </div>
            <div className="hidden sm:flex items-center bg-secondary rounded-lg p-1">
              <button
                onClick={() => setView("form")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "form" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <PenLine className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t("Éditer", "Edit")}
              </button>
              <button
                onClick={() => setView("preview")}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${view === "preview" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Eye className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t("Aperçu", "Preview")}
              </button>
            </div>
            <Button onClick={() => generateDOCX("embedded")} disabled={generating} className="gap-2">
              <FileDown className="w-4 h-4" />
              {generating ? t("Génération...", "Generating...") : t("Télécharger DOCX", "Download DOCX")}
            </Button>
            <Button
              variant="outline"
              disabled={generating || !data.email}
              onClick={() => generateDOCX("email")}
              className="gap-2 hidden md:inline-flex"
              title={t(
                "Envoie le contrat par email via DocuSign (séparé du flow Step 7)",
                "Sends the contract by email via DocuSign (separate from the Step 7 flow)",
              )}
            >
              <Mail className="w-4 h-4" />
              {generating ? t("Envoi...", "Sending...") : t("Envoyer par email", "Send by email")}
            </Button>
          </div>
        </div>
      </header>

      <div className="sm:hidden flex items-center bg-secondary rounded-lg p-1 mx-4 mt-4">
        <button onClick={() => setView("form")} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${view === "form" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <PenLine className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t("Éditer", "Edit")}
        </button>
        <button onClick={() => setView("preview")} className={`flex-1 px-4 py-2 rounded-md text-sm font-medium ${view === "preview" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
          <Eye className="w-4 h-4 inline mr-1.5 -mt-0.5" />{t("Aperçu", "Preview")}
        </button>
      </div>

      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 py-6">
        <div className="hidden sm:grid grid-cols-[minmax(300px,1fr)_minmax(0,3fr)] gap-6">
          <div className="bg-card rounded-xl border border-border p-6 overflow-y-auto max-h-[calc(100vh-120px)]">
            <ContractForm data={data} onChange={setData} />
          </div>
          <div className="overflow-y-auto max-h-[calc(100vh-120px)] rounded-xl">
            <ContractDocxPreview data={data} />
          </div>
        </div>
        <div className="sm:hidden mt-4">
          {view === "form" ? (
            <div className="bg-card rounded-xl border border-border p-5">
              <ContractForm data={data} onChange={setData} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <ContractDocxPreview data={data} />
            </div>
          )}
        </div>
      </main>

      <Dialog open={!!result} onOpenChange={(open) => { if (!open) setResult(null); }}>
        <DialogContent className="sm:max-w-md">
          {result && (
            <>
              <DialogHeader>
                <div className="flex flex-col items-center gap-3 pt-2">
                  {result.envelopeId ? (
                    <CheckCircle2 className="h-14 w-14 text-[hsl(var(--good,142_71%_45%))]" />
                  ) : result.pdfSaved ? (
                    <AlertTriangle className="h-14 w-14 text-yellow-500" />
                  ) : (
                    <XCircle className="h-14 w-14 text-destructive" />
                  )}
                  <DialogTitle className="text-center text-xl">
                    {result.envelopeId
                      ? result.deliveryMode === "email"
                        ? t("Contrat envoyé par email", "Contract sent by email")
                        : t("Contrat prêt pour signature", "Contract ready for signature")
                      : t("Contrat généré, envoi partiel", "Contract generated, partial send")}
                  </DialogTitle>
                  <DialogDescription className="text-center">
                    {t("Client :", "Client:")}{" "}
                    <span className="font-medium text-foreground">{result.clientName}</span>{" "}
                    <span className="text-muted-foreground">({result.clientCode})</span>
                  </DialogDescription>
                </div>
              </DialogHeader>

              <ul className="space-y-3 py-2">
                <li className="flex items-start gap-3">
                  {result.pdfSaved ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--good,142_71%_45%))] mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                  )}
                  <div className="text-sm">
                    <p className="font-medium">{t("Téléchargement du DOCX", "DOCX download")}</p>
                    <p className="text-muted-foreground">
                      {t("Le fichier a été enregistré sur ton appareil.", "The file has been saved to your device.")}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  {result.storageUploaded ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--good,142_71%_45%))] mt-0.5" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500 mt-0.5" />
                  )}
                  <div className="text-sm">
                    <p className="font-medium">{t("Archivage dans Supabase Storage", "Archived in Supabase Storage")}</p>
                    <p className="text-muted-foreground">
                      {result.storageUploaded
                        ? t("Contrat stocké et associé au client.", "Contract stored and linked to the client.")
                        : t(
                            "Upload échoué (non bloquant, DocuSign reçoit quand même le contrat).",
                            "Upload failed (non-blocking — DocuSign still receives the contract).",
                          )}
                    </p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  {result.envelopeId ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-[hsl(var(--good,142_71%_45%))] mt-0.5" />
                  ) : (
                    <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                  )}
                  <div className="text-sm">
                    <p className="font-medium">
                      {result.deliveryMode === "email"
                        ? t("Envoi email DocuSign", "DocuSign email send")
                        : t("Enveloppe DocuSign (Step 7)", "DocuSign envelope (Step 7)")}
                    </p>
                    <p className="text-muted-foreground">
                      {result.envelopeId ? (
                        result.deliveryMode === "email" ? (
                          <>
                            {t("Email envoyé à", "Email sent to")}{" "}
                            <span className="font-medium text-foreground">
                              {result.emailSentTo || t("l'adresse du client", "the client's address")}
                            </span>{" "}
                            {t(
                              "avec le lien de signature DocuSign. Enveloppe :",
                              "with the DocuSign signing link. Envelope:",
                            )}{" "}
                            <span className="font-mono text-xs">{result.envelopeId}</span>.
                          </>
                        ) : (
                          <>
                            {t("Créée avec succès —", "Successfully created —")}{" "}
                            <span className="font-mono text-xs">{result.envelopeId}</span>.{" "}
                            {t(
                              "Le client peut maintenant signer depuis l'étape 7.",
                              "The client can now sign from step 7.",
                            )}
                          </>
                        )
                      ) : (
                        result.docusignError || t("Enveloppe non créée.", "Envelope not created.")
                      )}
                    </p>
                  </div>
                </li>
              </ul>

              <DialogFooter>
                <Button onClick={() => setResult(null)} className="w-full sm:w-auto">
                  {t("Fermer", "Close")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ContractCreator;
