import { createAdminClient } from "@/lib/supabase/admin";

export async function deleteContract(contractId: string): Promise<void> {
  const supabase = createAdminClient();

  const { data: documents } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("contract_id", contractId);

  if (documents?.length) {
    const paths = documents.map((d) => d.storage_path);
    const { error: storageError } = await supabase.storage
      .from("contracts")
      .remove(paths);

    if (storageError) {
      console.warn("Storage cleanup warning:", storageError.message);
    }
  }

  const { error } = await supabase
    .from("contracts")
    .delete()
    .eq("id", contractId);

  if (error) {
    throw new Error(error.message);
  }
}
