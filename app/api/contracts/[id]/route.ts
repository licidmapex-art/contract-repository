import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { fetchContractWithDetails } from "@/lib/contracts/fetch";
import { deleteContract } from "@/lib/contracts/delete";
import { syncContractTypeMetadata } from "@/lib/entities/link-contract-type";
import {
  addContractFolder,
  removeContractFolder,
  setContractFolders,
} from "@/lib/folders/contract-folders";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await params;
  const contract = await fetchContractWithDetails(id);

  if (!contract) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ contract });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await params;
  const body = await request.json();
  const updates: {
    legal_entity_id?: string | null;
    counterparty_id?: string | null;
    contract_type_id?: string | null;
    folder_id?: string | null;
  } = {};

  if ("legal_entity_id" in body) {
    updates.legal_entity_id = body.legal_entity_id || null;
  }
  if ("counterparty_id" in body) {
    updates.counterparty_id = body.counterparty_id || null;
  }
  if ("contract_type_id" in body) {
    updates.contract_type_id = body.contract_type_id || null;
  }

  const hasFolderIds = "folder_ids" in body && Array.isArray(body.folder_ids);
  const hasAddFolder = "add_folder_id" in body && body.add_folder_id;
  const hasRemoveFolder = "remove_folder_id" in body && body.remove_folder_id;
  const hasLegacyFolder = "folder_id" in body;

  if (
    !Object.keys(updates).length &&
    !hasFolderIds &&
    !hasAddFolder &&
    !hasRemoveFolder &&
    !hasLegacyFolder
  ) {
    return NextResponse.json({ error: "No updates provided" }, { status: 400 });
  }

  const supabase = createAdminClient();

  if (Object.keys(updates).length) {
    const { error } = await supabase.from("contracts").update(updates).eq("id", id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  if (hasFolderIds) {
    await setContractFolders(
      id,
      (body.folder_ids as string[]).filter(Boolean)
    );
  } else if (hasAddFolder) {
    await addContractFolder(id, body.add_folder_id as string);
  } else if (hasRemoveFolder) {
    await removeContractFolder(id, body.remove_folder_id as string);
  } else if (hasLegacyFolder) {
    const folderId = (body.folder_id as string | null) || null;
    if (folderId) {
      await addContractFolder(id, folderId);
    } else {
      await setContractFolders(id, []);
    }
  }

  if ("contract_type_id" in body) {
    await syncContractTypeMetadata(id, body.contract_type_id || null);
  }

  const contract = await fetchContractWithDetails(id);
  return NextResponse.json({ contract });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (auth.response) return auth.response;

  const { id } = await params;

  const contract = await fetchContractWithDetails(id);
  if (!contract) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    await deleteContract(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 500 }
    );
  }
}
