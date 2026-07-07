import { createAdminClient } from "@/lib/supabase/admin";
import {
  DEFAULT_GEMINI_MODEL,
  parseGeminiApiKeysFromEnv,
} from "@/lib/gemini/config";
import {
  API_KEYS_MIGRATION_SQL,
  getSupabaseSqlEditorUrl,
  isMissingSchemaError,
} from "@/lib/gemini/migration";
import type { ApiKeyTestStatus, PublicApiKey } from "@/lib/types";

export {
  API_KEYS_MIGRATION_SQL,
  getSupabaseSqlEditorUrl,
  isMissingSchemaError,
};

export type { ApiKeyTestStatus, PublicApiKey };

type ApiKeyRow = PublicApiKey & { api_key: string };

const CACHE_TTL_MS = 30_000;
let cachedKeys: string[] | null = null;
let cacheExpiresAt = 0;
let migrationRequired: boolean | null = null;

export function invalidateGeminiKeyCache(): void {
  cachedKeys = null;
  cacheExpiresAt = 0;
}

export async function isApiKeysMigrationRequired(): Promise<boolean> {
  if (migrationRequired !== null) return migrationRequired;

  const supabase = createAdminClient();
  const { error } = await supabase.from("api_keys").select("id").limit(1);
  migrationRequired = Boolean(error && isMissingSchemaError(error));
  return migrationRequired;
}

export function getApiKeysMigrationSql(): string {
  return API_KEYS_MIGRATION_SQL;
}

export const API_KEYS_MIGRATION_MESSAGE =
  "Database setup required. Run migration 016 in the Supabase SQL Editor (see Settings → API Keys).";

function throwIfMigrationRequired(error: unknown): void {
  if (isMissingSchemaError(error)) {
    migrationRequired = true;
    throw new Error(API_KEYS_MIGRATION_MESSAGE);
  }
}

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return "••••••••";
  return `${trimmed.slice(0, 4)}${"•".repeat(Math.min(trimmed.length - 8, 12))}${trimmed.slice(-4)}`;
}

export function toPublicApiKey(row: ApiKeyRow): PublicApiKey {
  const { api_key, ...rest } = row;
  return {
    ...rest,
    api_key_masked: maskApiKey(api_key),
  };
}

async function loadGeminiKeysFromDb(): Promise<string[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("api_key")
    .eq("provider", "gemini")
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) {
      migrationRequired = true;
      return [];
    }
    throw new Error(error.message);
  }

  migrationRequired = false;

  return (data ?? [])
    .map((row) => row.api_key?.trim())
    .filter((key): key is string => Boolean(key));
}

export async function getGeminiApiKeys(): Promise<string[]> {
  const now = Date.now();
  if (cachedKeys && now < cacheExpiresAt) {
    return cachedKeys;
  }

  const fromDb = await loadGeminiKeysFromDb();
  if (fromDb.length) {
    cachedKeys = fromDb;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return fromDb;
  }

  const fromEnv = parseGeminiApiKeysFromEnv({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
  });

  if (fromEnv.length) {
    cachedKeys = fromEnv;
    cacheExpiresAt = now + CACHE_TTL_MS;
    return fromEnv;
  }

  throw new Error(
    "No Gemini API keys configured. Add keys in Settings → API Keys, or set GEMINI_API_KEY in .env.local. " +
      "Get keys from https://aistudio.google.com/apikey"
  );
}

export async function getGeminiModelName(): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_settings")
    .select("value")
    .eq("key", "gemini_model")
    .maybeSingle();

  if (error) {
    if (isMissingSchemaError(error)) {
      migrationRequired = true;
    } else {
      throw new Error(error.message);
    }
  } else {
    migrationRequired = false;
    const fromDb = data?.value?.trim();
    if (fromDb) return fromDb;
  }

  return process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

export async function setGeminiModelName(model: string): Promise<string> {
  const trimmed = model.trim();
  if (!trimmed) {
    throw new Error("Model name is required");
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert({ key: "gemini_model", value: trimmed });

  if (error) {
    throwIfMigrationRequired(error);
    throw new Error(error.message);
  }

  migrationRequired = false;

  return trimmed;
}

export async function listGeminiApiKeys(): Promise<PublicApiKey[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("provider", "gemini")
    .order("sort_order", { ascending: true });

  if (error) {
    if (isMissingSchemaError(error)) {
      migrationRequired = true;
      return [];
    }
    throw new Error(error.message);
  }

  migrationRequired = false;

  return (data as ApiKeyRow[] | null)?.map(toPublicApiKey) ?? [];
}

export async function importEnvGeminiKeysIfEmpty(): Promise<PublicApiKey[]> {
  const existing = await listGeminiApiKeys();
  if (existing.length) return existing;

  const envKeys = parseGeminiApiKeysFromEnv({
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
  });

  if (!envKeys.length) return [];

  const supabase = createAdminClient();
  const rows = envKeys.map((api_key, index) => ({
    provider: "gemini",
    label: index === 0 ? "Primary (from env)" : `Backup ${index} (from env)`,
    api_key,
    sort_order: index,
  }));

  const { error } = await supabase.from("api_keys").insert(rows);
  if (error) {
    if (isMissingSchemaError(error)) {
      migrationRequired = true;
      return [];
    }
    throw new Error(error.message);
  }

  migrationRequired = false;

  invalidateGeminiKeyCache();
  return listGeminiApiKeys();
}

export async function createGeminiApiKey(input: {
  api_key: string;
  label?: string;
}): Promise<PublicApiKey> {
  const api_key = input.api_key.trim();
  if (!api_key) {
    throw new Error("API key is required");
  }

  const supabase = createAdminClient();
  const { data: siblings } = await supabase
    .from("api_keys")
    .select("sort_order")
    .eq("provider", "gemini")
    .order("sort_order", { ascending: false })
    .limit(1);

  const nextOrder = (siblings?.[0]?.sort_order ?? -1) + 1;

  const { data, error } = await supabase
    .from("api_keys")
    .insert({
      provider: "gemini",
      label: input.label?.trim() || `Key ${nextOrder + 1}`,
      api_key,
      sort_order: nextOrder,
    })
    .select("*")
    .single();

  if (error || !data) {
    throwIfMigrationRequired(error);
    throw new Error(error?.message ?? "Failed to save API key");
  }

  invalidateGeminiKeyCache();
  return toPublicApiKey(data as ApiKeyRow);
}

export async function updateGeminiApiKey(
  id: string,
  input: { label?: string; api_key?: string }
): Promise<PublicApiKey> {
  const updates: Partial<ApiKeyRow> = {};

  if (input.label !== undefined) {
    updates.label = input.label.trim();
  }

  if (input.api_key !== undefined) {
    const api_key = input.api_key.trim();
    if (!api_key) {
      throw new Error("API key cannot be empty");
    }
    updates.api_key = api_key;
  }

  if (!Object.keys(updates).length) {
    throw new Error("Nothing to update");
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .update(updates)
    .eq("id", id)
    .eq("provider", "gemini")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "API key not found");
  }

  invalidateGeminiKeyCache();
  return toPublicApiKey(data as ApiKeyRow);
}

export async function getGeminiApiKeyValue(id: string): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .select("api_key")
    .eq("id", id)
    .eq("provider", "gemini")
    .single();

  if (error || !data?.api_key) {
    throw new Error("API key not found");
  }

  return data.api_key;
}

export async function deleteGeminiApiKey(id: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("api_keys")
    .delete()
    .eq("id", id)
    .eq("provider", "gemini");

  if (error) {
    throwIfMigrationRequired(error);
    throw new Error(error.message);
  }

  migrationRequired = false;

  invalidateGeminiKeyCache();
}

export async function reorderGeminiApiKeys(orderedIds: string[]): Promise<void> {
  if (!orderedIds.length) {
    throw new Error("orderedIds is required");
  }

  const supabase = createAdminClient();
  const { data: existing, error: listError } = await supabase
    .from("api_keys")
    .select("id")
    .eq("provider", "gemini");

  if (listError) {
    throw new Error(listError.message);
  }

  const existingIds = new Set((existing ?? []).map((row) => row.id));
  if (orderedIds.length !== existingIds.size) {
    throw new Error("orderedIds must include every Gemini API key");
  }

  for (const id of orderedIds) {
    if (!existingIds.has(id)) {
      throw new Error("orderedIds contains unknown key id");
    }
  }

  for (let index = 0; index < orderedIds.length; index++) {
    const { error } = await supabase
      .from("api_keys")
      .update({ sort_order: index })
      .eq("id", orderedIds[index])
      .eq("provider", "gemini");

    if (error) {
      throw new Error(error.message);
    }
  }

  invalidateGeminiKeyCache();
}

export async function recordGeminiApiKeyTest(
  id: string,
  result: { status: ApiKeyTestStatus; message: string }
): Promise<PublicApiKey> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("api_keys")
    .update({
      last_test_status: result.status,
      last_test_message: result.message,
      last_tested_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("provider", "gemini")
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "API key not found");
  }

  return toPublicApiKey(data as ApiKeyRow);
}
