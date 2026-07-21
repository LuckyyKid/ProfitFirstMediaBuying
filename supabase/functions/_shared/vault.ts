// Phase 1B — Vault helpers for storing OAuth credentials.
// Every integration connection maps to ONE vault secret containing a JSON blob.
// The public.vault_* RPCs are SECURITY DEFINER and callable only by service_role.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

/** Store or replace credentials in Vault. Updates the connection row with vault_secret_id. */
export async function storeConnectionSecret(
  supabase: SupabaseClient,
  connectionId: string,
  currentVaultId: string | null,
  creds: Record<string, unknown>,
): Promise<string> {
  const value = JSON.stringify(creds);

  if (currentVaultId) {
    const { error } = await supabase.rpc("vault_update_secret", { _id: currentVaultId, _value: value });
    if (error) throw new Error(`vault_update_secret: ${error.message}`);
    return currentVaultId;
  }

  const name = `gos_integration_${connectionId}_${Date.now()}`;
  const { data, error } = await supabase.rpc("vault_store_secret", { _name: name, _value: value });
  if (error) throw new Error(`vault_store_secret: ${error.message}`);
  const newId = data as string;

  const { error: upErr } = await supabase
    .from("gos_integration_connections")
    .update({ vault_secret_id: newId })
    .eq("id", connectionId);
  if (upErr) throw new Error(`update vault_secret_id: ${upErr.message}`);

  return newId;
}

/** Read credentials JSON from Vault by vault_secret_id (returns null when unset/missing). */
export async function readConnectionSecret(
  supabase: SupabaseClient,
  vaultSecretId: string | null | undefined,
): Promise<Record<string, unknown> | null> {
  if (!vaultSecretId) return null;
  const { data, error } = await supabase.rpc("vault_read_secret", { _id: vaultSecretId });
  if (error) throw new Error(`vault_read_secret: ${error.message}`);
  if (!data) return null;
  try {
    return JSON.parse(data as string) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Delete a Vault secret (on disconnect). */
export async function deleteConnectionSecret(
  supabase: SupabaseClient,
  vaultSecretId: string | null | undefined,
): Promise<void> {
  if (!vaultSecretId) return;
  await supabase.rpc("vault_delete_secret", { _id: vaultSecretId });
}
