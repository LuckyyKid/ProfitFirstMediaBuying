// Actions partagées sur un rapport publié :
//   - downloadReportPdf : télécharger le PDF stocké dans le bucket privé
//     (admin ET client — l'edge function report-pdf-signed-url gère l'auth
//     et retourne un 403 si le rapport n'appartient pas au caller).
//   - resendReportEmail : renvoyer le rapport par courriel au client
//     (admin uniquement — l'edge function report-email-resend enforce ça).
//
// Les erreurs sont typées pour permettre aux appelants d'afficher des
// messages actionnables et adressés au client (jamais e.message brut).

import { supabase } from "@/integrations/supabase/client";

interface SignedUrlResponse {
  url?: string;
  expires_in?: number;
}

interface ResendResponse {
  ok?: boolean;
  email_sent_at?: string;
  recipient?: string;
  pdf_regenerated?: boolean;
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 60) || "rapport";
}

function friendlyFilename(
  clientLabel: string,
  periodeDebut: string,
  periodeFin: string,
): string {
  return `TDIA-Rapport-${slugify(clientLabel)}-${periodeDebut}_${periodeFin}.pdf`;
}

async function extractStatus(err: unknown): Promise<{
  status: number | null;
  body: string | null;
}> {
  const context = (err as { context?: unknown }).context;
  if (context instanceof Response) {
    let body: string | null = null;
    try {
      body = await context.clone().text();
    } catch {
      body = null;
    }
    return { status: context.status, body };
  }
  return { status: null, body: null };
}

export interface DownloadReportInput {
  reportId: string;
  clientLabel: string;
  periodeDebut: string;
  periodeFin: string;
}

export async function downloadReportPdf(input: DownloadReportInput): Promise<void> {
  let signedUrl: string;
  try {
    const { data, error } = await supabase.functions.invoke<SignedUrlResponse>(
      "report-pdf-signed-url",
      { body: { id: input.reportId } },
    );
    if (error) throw error;
    if (!data?.url) throw new Error("URL de téléchargement introuvable.");
    signedUrl = data.url;
  } catch (e) {
    const { status, body } = await extractStatus(e);
    // eslint-disable-next-line no-console
    console.error("[reportActions] report-pdf-signed-url failed", {
      status,
      body,
      message: (e as Error)?.message,
    });
    if (status === 401 || status === 403) {
      throw new Error("Vous n'avez pas accès à ce rapport.");
    }
    if (status === 404) {
      throw new Error(
        "Le PDF de ce rapport n'est pas encore disponible. Réessayez dans quelques minutes.",
      );
    }
    throw new Error(
      "Impossible de récupérer le rapport pour le moment. Réessayez dans quelques minutes.",
    );
  }

  // Récupère le PDF en blob pour forcer un téléchargement (le download
  // attribute n'est pas respecté sur des URLs cross-origin).
  let blob: Blob;
  try {
    const res = await fetch(signedUrl);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    blob = await res.blob();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[reportActions] PDF blob fetch failed", e);
    throw new Error(
      "Le PDF n'a pas pu être téléchargé. Vérifiez votre connexion puis réessayez.",
    );
  }

  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = friendlyFilename(
    input.clientLabel,
    input.periodeDebut,
    input.periodeFin,
  );
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  // Cleanup après un tick pour laisser le navigateur consommer l'URL.
  setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

export interface ResendReportInput {
  reportId: string;
}

export interface ResendReportResult {
  recipient: string;
  sentAt: string;
  pdfRegenerated: boolean;
}

export interface ResendReportInputWithOptions extends ResendReportInput {
  regenerate?: boolean;
}

export async function resendReportEmail(
  input: ResendReportInputWithOptions,
): Promise<ResendReportResult> {
  const body: { id: string; regenerate?: boolean } = { id: input.reportId };
  if (input.regenerate === false) body.regenerate = false;
  try {
    const { data, error } = await supabase.functions.invoke<ResendResponse>(
      "report-email-resend",
      { body },
    );
    if (error) throw error;
    if (!data?.ok || !data.recipient || !data.email_sent_at) {
      throw new Error("Réponse inattendue du serveur.");
    }
    return {
      recipient: data.recipient,
      sentAt: data.email_sent_at,
      pdfRegenerated: Boolean(data.pdf_regenerated),
    };
  } catch (e) {
    const { status, body } = await extractStatus(e);
    // eslint-disable-next-line no-console
    console.error("[reportActions] report-email-resend failed", {
      status,
      body,
      message: (e as Error)?.message,
    });
    if (status === 401 || status === 403) {
      throw new Error(
        "Vous n'avez pas les droits pour renvoyer ce rapport par courriel.",
      );
    }
    if (status === 404) {
      throw new Error(
        "Ce rapport ou son PDF est introuvable — il faut peut-être le republier.",
      );
    }
    if (status === 422) {
      throw new Error(
        "Le client n'a pas d'adresse courriel enregistrée dans sa fiche.",
      );
    }
    throw new Error(
      "L'envoi du courriel a échoué. Réessayez dans quelques minutes.",
    );
  }
}
