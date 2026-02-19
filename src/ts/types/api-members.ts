// --- Members Endpoint ---
// Add to end of src/ts/types/api.ts

export interface ClaimMember {
  entityId: string;
  claimEntityId: string;
  playerEntityId: string;
  userName: string;
  inventoryPermission: number;
  buildPermission: number;
  officerPermission: number;
  coOwnerPermission: number;
  createdAt: string;
  updatedAt: string;
  lastLoginTimestamp: string;
}

export interface ClaimMembersResponse {
  members: ClaimMember[];
  count: number;
}
