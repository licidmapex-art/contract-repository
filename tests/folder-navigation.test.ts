import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildMoveTargetOptions,
  compareFolderSiblings,
  filterContractsByFolderPath,
  getFolderLevel,
  reorderSiblingIds,
  UNASSIGNED_FOLDER_ID,
} from "../lib/folders/navigation";
import { ContractWithDetails } from "../lib/types";

function mockContract(
  overrides: Partial<ContractWithDetails> & { id: string }
): ContractWithDetails {
  const folderIds =
    overrides.folder_ids ??
    (overrides.folder_id ? [overrides.folder_id] : []);

  return {
    id: overrides.id,
    contract_number: 1,
    title: overrides.title ?? "Test",
    status: "active",
    legal_entity_id: null,
    counterparty_id: null,
    contract_type_id: null,
    folder_id: folderIds[0] ?? null,
    folder_ids: folderIds,
    created_at: "2025-01-01",
    documents: [],
    metadata_values: overrides.metadata_values ?? [],
    relationships: [],
    effective_status: "active",
    pending_review_count: 0,
    legal_entity: overrides.legal_entity ?? null,
    counterparty: overrides.counterparty ?? null,
    contract_type: overrides.contract_type ?? null,
    display_name: overrides.display_name,
  };
}

const folders = [
  { id: "gas", name: "Natural gas", parent_id: null, sort_order: 1 },
  { id: "h2", name: "Hydrogen", parent_id: null, sort_order: 0 },
  { id: "eu", name: "EU", parent_id: "gas", sort_order: 0 },
];

test("getFolderLevel always includes unassigned at root", () => {
  const contracts = [
    mockContract({ id: "1", folder_id: "gas" }),
    mockContract({ id: "2", folder_id: null }),
  ];

  const level = getFolderLevel(folders, contracts, []);
  const unassigned = level.chips.find((c) => c.id === UNASSIGNED_FOLDER_ID);

  assert.ok(unassigned);
  assert.equal(unassigned?.count, 1);
  assert.ok(level.chips.some((c) => c.id === "gas"));
  assert.ok(level.chips.some((c) => c.id === "h2"));
});

test("getFolderLevel includes unassigned inside a folder", () => {
  const contracts = [
    mockContract({ id: "1", folder_id: "gas" }),
    mockContract({ id: "2", folder_id: "eu" }),
  ];

  const level = getFolderLevel(folders, contracts, [
    { kind: "folder", id: "gas", name: "Natural gas" },
  ]);
  const unassigned = level.chips.find((c) => c.id === UNASSIGNED_FOLDER_ID);

  assert.ok(unassigned);
  assert.equal(unassigned?.count, 1);
  assert.ok(level.chips.some((c) => c.id === "eu"));
});

test("filterContractsByFolderPath handles unassigned at root", () => {
  const contracts = [
    mockContract({ id: "1", folder_id: null }),
    mockContract({ id: "2", folder_id: "gas" }),
  ];

  const result = filterContractsByFolderPath(contracts, folders, [
    { kind: "unassigned" },
  ]);

  assert.equal(result.length, 1);
  assert.equal(result[0].id, "1");
});

test("filterContractsByFolderPath filters by folder subtree", () => {
  const contracts = [
    mockContract({ id: "1", folder_id: "gas" }),
    mockContract({ id: "2", folder_id: "eu" }),
    mockContract({ id: "3", folder_id: "h2" }),
  ];

  const result = filterContractsByFolderPath(contracts, folders, [
    { kind: "folder", id: "gas", name: "Natural gas" },
  ]);

  assert.equal(result.length, 2);
});

test("getFolderLevel shows empty folders with zero count", () => {
  const level = getFolderLevel(folders, [], []);
  const hydrogen = level.chips.find((c) => c.id === "h2");
  assert.equal(hydrogen?.count, 0);
});

test("filterContractsByFolderPath filters by folder subtree with multiple tags", () => {
  const contracts = [
    mockContract({ id: "1", folder_ids: ["gas", "h2"] }),
    mockContract({ id: "2", folder_ids: ["eu"] }),
    mockContract({ id: "3", folder_ids: ["h2"] }),
  ];

  const result = filterContractsByFolderPath(contracts, folders, [
    { kind: "folder", id: "gas", name: "Natural gas" },
  ]);

  assert.equal(result.length, 2);
  assert.ok(result.some((c) => c.id === "1"));
  assert.ok(result.some((c) => c.id === "2"));
});

test("getFolderLevel sorts folders by sort_order", () => {
  const level = getFolderLevel(folders, [], []);
  const folderIds = level.chips
    .filter((chip) => !chip.isUnassigned)
    .map((chip) => chip.id);

  assert.deepEqual(folderIds, ["h2", "gas"]);
});

test("reorderSiblingIds moves dragged folder before target", () => {
  const next = reorderSiblingIds(["h2", "gas", "eu"], "eu", "h2");
  assert.deepEqual(next, ["eu", "h2", "gas"]);
});

test("compareFolderSiblings uses sort_order before name", () => {
  assert.equal(
    compareFolderSiblings(
      { id: "a", name: "Zulu", parent_id: null, sort_order: 0 },
      { id: "b", name: "Alpha", parent_id: null, sort_order: 1 }
    ),
    -1
  );
});

test("buildMoveTargetOptions excludes folder and its descendants", () => {
  const options = buildMoveTargetOptions("gas", folders);
  const ids = options.map((o) => o.id);
  assert.ok(!ids.includes("gas"));
  assert.ok(!ids.includes("eu"));
  assert.ok(ids.includes("h2"));
  assert.ok(ids.includes(null));
});
