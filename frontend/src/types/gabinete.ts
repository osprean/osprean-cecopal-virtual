import type { ID, ISODateString } from "./common";
import type { CommuniqueAudience } from "./direccion";

export type TemplateCategory =
  | "evacuation"
  | "confinement"
  | "preventive"
  | "population-warning"
  | "all-clear";

export const TEMPLATE_LABEL: Record<TemplateCategory, string> = {
  evacuation: "EVACUACIÓN",
  confinement: "CONFINAMIENTO",
  preventive: "ALERTA PREVENTIVA",
  "population-warning": "AVISO POBLACIÓN",
  "all-clear": "FIN DE EMERGENCIA",
};

export interface CommunicationTemplate {
  id: ID;
  category: TemplateCategory;
  title: string;
  body: string;          // texto base, puede contener {{placeholders}}
  audience: CommuniqueAudience;
  defaultPriority: "critical" | "high" | "medium" | "low";
}

export type ChannelKind =
  | "press"
  | "social-x"
  | "social-instagram"
  | "social-facebook"
  | "es-alert"
  | "rne"
  | "internal-mail"
  | "official-bulletin";

export const CHANNEL_LABEL: Record<ChannelKind, string> = {
  press: "Nota de prensa",
  "social-x": "X / Twitter",
  "social-instagram": "Instagram",
  "social-facebook": "Facebook",
  "es-alert": "ES-Alert",
  rne: "RNE / Radio Pública",
  "internal-mail": "Mail Interno",
  "official-bulletin": "Boletín Oficial",
};

export type ChannelStatus = "online" | "degraded" | "offline";

export interface BroadcastChannel {
  id: ID;
  kind: ChannelKind;
  status: ChannelStatus;
  audienceReach?: number;
  lastSentAt?: ISODateString;
}

export type PublicationStatus =
  | "draft"
  | "pending-approval"
  | "approved"
  | "scheduled"
  | "published"
  | "retracted";

export interface PublicationRecord {
  communiqueId: ID;
  channelId: ID;
  status: PublicationStatus;
  publishedAt?: ISODateString;
  reach?: number;
}
