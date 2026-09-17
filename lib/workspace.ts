import { NextRequest } from "next/server";
import { listWorkspaces } from "@/lib/db";

// Every data-touching API route is scoped to the workspace selected client-side,
// sent as this header (see lib/apiFetch.ts). Falls back to the first workspace
// if the header is missing/invalid so old clients/requests don't 500.
export async function getWorkspaceId(req: NextRequest): Promise<number> {
  const header = req.headers.get("x-workspace-id");
  const id = header ? Number(header) : NaN;
  if (Number.isFinite(id) && id > 0) return id;
  const workspaces = await listWorkspaces();
  return workspaces[0]?.id ?? 1;
}
