"use client";

const STORAGE_KEY = "workspaceId";
let currentWorkspaceId = 1;

export function getCurrentWorkspaceId(): number {
  return currentWorkspaceId;
}

export function setCurrentWorkspaceId(id: number) {
  currentWorkspaceId = id;
  if (typeof window !== "undefined") localStorage.setItem(STORAGE_KEY, String(id));
}

export function loadStoredWorkspaceId(): number | null {
  if (typeof window === "undefined") return null;
  const stored = Number(localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : null;
}

// Drop-in replacement for fetch() that tags every request with the active
// workspace, so API routes can scope data without threading the id through
// every component's props.
export function apiFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set("x-workspace-id", String(currentWorkspaceId));
  return fetch(input, { ...init, headers });
}
