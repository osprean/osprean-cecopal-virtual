import { create } from "zustand";
import type {
  CommandPost,
  Communique,
  CommuniqueStatus,
  DirectorAction,
  Evacuation,
  GroupStatus,
  ID,
  MediaRequest,
  MediaRequestStatus,
  OperationalGroup,
  OperationalLevel,
  OperationalState,
  RoadBlock,
  Shelter,
} from "../types";
import {
  mockCommandPosts,
  mockCommuniques,
  mockDirectorActions,
  mockEvacuations,
  mockGroups,
  mockMediaRequests,
  mockRoadBlocks,
  mockShelters,
} from "../mocks";

interface DireccionState {
  // Plan / level
  level: OperationalLevel;
  activatedAt: string | null;       // ISO
  closedAt: string | null;          // ISO
  // Domain entities
  groups: GroupStatus[];
  mediaRequests: MediaRequest[];
  communiques: Communique[];
  commandPosts: CommandPost[];
  shelters: Shelter[];
  evacuations: Evacuation[];
  roadBlocks: RoadBlock[];
  actions: DirectorAction[];

  // Operations
  setLevel: (level: OperationalLevel, performedBy?: string, notes?: string) => void;
  activate: (performedBy?: string) => void;
  close: (performedBy?: string) => void;
  setGroupState: (id: ID, state: OperationalState) => void;
  decideMediaRequest: (id: ID, status: MediaRequestStatus, performedBy?: string) => void;
  setCommuniqueStatus: (id: ID, status: CommuniqueStatus, performedBy?: string) => void;
  pushAction: (action: DirectorAction) => void;
  reset: () => void;
}

const nowIso = () => new Date().toISOString();

const newAction = (
  type: DirectorAction["type"],
  performedBy: string,
  payload?: Record<string, unknown>,
  notes?: string,
): DirectorAction => ({
  id: `act-${Math.random().toString(36).slice(2, 8)}`,
  emergencyId: "emg-001",
  type,
  performedBy,
  timestamp: nowIso(),
  payload,
  notes,
});

export const useDireccionStore = create<DireccionState>((set) => ({
  level: 2,
  activatedAt: "2026-05-12T08:30:00Z",
  closedAt: null,
  groups: mockGroups,
  mediaRequests: mockMediaRequests,
  communiques: mockCommuniques,
  commandPosts: mockCommandPosts,
  shelters: mockShelters,
  evacuations: mockEvacuations,
  roadBlocks: mockRoadBlocks,
  actions: mockDirectorActions,

  setLevel: (level, performedBy = "Director Plan", notes) =>
    set((state) => ({
      level,
      actions: [
        newAction(
          level > state.level ? "level-escalated" : "level-deescalated",
          performedBy,
          { from: state.level, to: level },
          notes,
        ),
        ...state.actions,
      ],
    })),

  activate: (performedBy = "Director Plan") =>
    set((state) => ({
      activatedAt: state.activatedAt ?? nowIso(),
      closedAt: null,
      actions: [newAction("activated", performedBy), ...state.actions],
    })),

  close: (performedBy = "Director Plan") =>
    set((state) => ({
      closedAt: nowIso(),
      actions: [newAction("closed", performedBy), ...state.actions],
    })),

  setGroupState: (id, state) =>
    set((s) => ({
      groups: s.groups.map((g) =>
        g.id === id ? { ...g, state, lastReport: nowIso() } : g,
      ),
    })),

  decideMediaRequest: (id, status, performedBy = "Director Plan") =>
    set((s) => ({
      mediaRequests: s.mediaRequests.map((r) =>
        r.id === id ? { ...r, status, decidedAt: nowIso() } : r,
      ),
      actions:
        status === "approved"
          ? [
              newAction("support-requested", performedBy, { requestId: id }),
              ...s.actions,
            ]
          : s.actions,
    })),

  setCommuniqueStatus: (id, status, performedBy = "Director Plan") =>
    set((s) => ({
      communiques: s.communiques.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              approvedAt: status === "approved" ? nowIso() : c.approvedAt,
              sentAt: status === "sent" ? nowIso() : c.sentAt,
            }
          : c,
      ),
      actions:
        status === "approved"
          ? [
              newAction("communique-approved", performedBy, { communiqueId: id }),
              ...s.actions,
            ]
          : s.actions,
    })),

  pushAction: (action) =>
    set((s) => ({ actions: [action, ...s.actions] })),

  reset: () =>
    set({
      level: 2,
      activatedAt: "2026-05-12T08:30:00Z",
      closedAt: null,
      groups: mockGroups,
      mediaRequests: mockMediaRequests,
      communiques: mockCommuniques,
      commandPosts: mockCommandPosts,
      shelters: mockShelters,
      evacuations: mockEvacuations,
      roadBlocks: mockRoadBlocks,
      actions: mockDirectorActions,
    }),
}));

// Derived selectors
export const selectGroupByType = (type: OperationalGroup) => (s: DireccionState) =>
  s.groups.find((g) => g.type === type) ?? null;

export const selectPendingMediaCount = (s: DireccionState) =>
  s.mediaRequests.filter((r) => r.status === "pending").length;

export const selectPendingCommuniqueCount = (s: DireccionState) =>
  s.communiques.filter((c) => c.status === "pending-approval" || c.status === "draft").length;
