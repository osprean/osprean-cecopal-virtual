import { create } from "zustand";
import type {
  BroadcastChannel,
  ChannelStatus,
  CommunicationTemplate,
  ID,
  PublicationRecord,
  PublicationStatus,
} from "../types";
import {
  mockChannels,
  mockPublications,
  mockTemplates,
} from "../mocks";

const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
const nowIso = () => new Date().toISOString();

interface GabineteState {
  templates: CommunicationTemplate[];
  channels: BroadcastChannel[];
  publications: PublicationRecord[];

  setChannelStatus: (id: ID, status: ChannelStatus) => void;
  publishToChannel: (communiqueId: ID, channelId: ID, reach?: number) => void;
  retractPublication: (communiqueId: ID, channelId: ID) => void;
  setPublicationStatus: (
    communiqueId: ID,
    channelId: ID,
    status: PublicationStatus,
  ) => void;
}

export const useGabineteStore = create<GabineteState>((set) => ({
  templates: mockTemplates,
  channels: mockChannels,
  publications: mockPublications,

  setChannelStatus: (id, status) =>
    set((s) => ({
      channels: s.channels.map((c) => (c.id === id ? { ...c, status } : c)),
    })),

  publishToChannel: (communiqueId, channelId, reach) =>
    set((s) => {
      const exists = s.publications.find(
        (p) => p.communiqueId === communiqueId && p.channelId === channelId,
      );
      const channel = s.channels.find((c) => c.id === channelId);
      const next: PublicationRecord = {
        communiqueId,
        channelId,
        status: "published",
        publishedAt: nowIso(),
        reach: reach ?? channel?.audienceReach,
      };
      return {
        publications: exists
          ? s.publications.map((p) =>
              p.communiqueId === communiqueId && p.channelId === channelId ? next : p,
            )
          : [next, ...s.publications],
        channels: s.channels.map((c) =>
          c.id === channelId ? { ...c, lastSentAt: nowIso() } : c,
        ),
      };
    }),

  retractPublication: (communiqueId, channelId) =>
    set((s) => ({
      publications: s.publications.map((p) =>
        p.communiqueId === communiqueId && p.channelId === channelId
          ? { ...p, status: "retracted" }
          : p,
      ),
    })),

  setPublicationStatus: (communiqueId, channelId, status) =>
    set((s) => ({
      publications: s.publications.map((p) =>
        p.communiqueId === communiqueId && p.channelId === channelId
          ? { ...p, status }
          : p,
      ),
    })),
}));

// We piggyback on the existing direccion communiques store for the actual
// communique CRUD; this gabinete store just owns broadcast channels + templates.
export { newId as _newId };
