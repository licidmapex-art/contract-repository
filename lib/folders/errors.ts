export function isMissingFoldersTableError(message: string): boolean {
  return (
    /could not find the table.*folders/i.test(message) ||
    /relation "public\.folders" does not exist/i.test(message) ||
    /schema cache.*folders/i.test(message)
  );
}

export function isMissingSortOrderColumnError(message: string): boolean {
  return /sort_order/i.test(message);
}

export function isMissingContractFoldersTableError(message: string): boolean {
  return (
    /could not find the table.*contract_folders/i.test(message) ||
    /relation "public\.contract_folders" does not exist/i.test(message) ||
    /schema cache.*contract_folders/i.test(message)
  );
}
