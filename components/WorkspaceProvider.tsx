"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getCurrentWorkspaceId, loadStoredWorkspaceId, setCurrentWorkspaceId } from "@/lib/apiFetch";

type Workspace = { id: number; name: string };

type WorkspaceContextValue = {
  workspaceId: number;
  workspaces: Workspace[];
  ready: boolean;
  switchWorkspace: (id: number) => void;
  refreshWorkspaces: () => Promise<Workspace[]>;
};

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [workspaceId, setWorkspaceId] = useState(getCurrentWorkspaceId());
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [ready, setReady] = useState(false);

  async function refreshWorkspaces(): Promise<Workspace[]> {
    const res = await fetch("/api/workspaces");
    const data = await res.json();
    setWorkspaces(data.workspaces);
    return data.workspaces as Workspace[];
  }

  useEffect(() => {
    (async () => {
      const list = await refreshWorkspaces();
      const stored = loadStoredWorkspaceId();
      const valid = stored && list.some((w) => w.id === stored) ? stored : (list[0]?.id ?? 1);
      setCurrentWorkspaceId(valid);
      setWorkspaceId(valid);
      setReady(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function switchWorkspace(id: number) {
    setCurrentWorkspaceId(id);
    setWorkspaceId(id);
  }

  return (
    <WorkspaceContext.Provider
      value={{ workspaceId, workspaces, ready, switchWorkspace, refreshWorkspaces }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used within WorkspaceProvider");
  return ctx;
}
