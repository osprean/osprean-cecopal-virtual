import type {
  BroadcastChannel,
  CommunicationTemplate,
  PublicationRecord,
} from "../types";

export const mockTemplates: CommunicationTemplate[] = [
  {
    id: "tpl-evac",
    category: "evacuation",
    title: "EVACUACIÓN PREVENTIVA — {{zona}}",
    body: "Se ordena la evacuación preventiva de {{zona}} por riesgo de {{causa}}. Diríjase al punto de encuentro: {{punto}}. Lleve consigo medicación, documentación y un abrigo. Siga indicaciones de los servicios de emergencia. Información: 112.",
    audience: "population",
    defaultPriority: "critical",
  },
  {
    id: "tpl-conf",
    category: "confinement",
    title: "CONFINAMIENTO — {{zona}}",
    body: "Por riesgo de {{causa}}, se decreta el confinamiento de {{zona}}. Permanezca en su domicilio con puertas y ventanas cerradas. Apague climatizaciones. Atienda únicamente a fuentes oficiales. Información: 112.",
    audience: "population",
    defaultPriority: "critical",
  },
  {
    id: "tpl-prev",
    category: "preventive",
    title: "ALERTA PREVENTIVA — {{titulo}}",
    body: "Se activa el plan {{plan}} en fase preventiva por {{causa}}. La situación se mantiene bajo control. Se ruega evitar desplazamientos no esenciales en {{zona}}. Información: 112.",
    audience: "population",
    defaultPriority: "high",
  },
  {
    id: "tpl-warn",
    category: "population-warning",
    title: "AVISO A POBLACIÓN — {{titulo}}",
    body: "Información oficial sobre {{titulo}}: {{detalle}}. Se ruega máxima precaución y atención a las indicaciones del personal de emergencias. Información: 112.",
    audience: "population",
    defaultPriority: "medium",
  },
  {
    id: "tpl-clear",
    category: "all-clear",
    title: "FIN DE LA EMERGENCIA — {{zona}}",
    body: "Se da por finalizada la situación de emergencia en {{zona}}. Los servicios continúan trabajando en la normalización. Agradecemos la colaboración ciudadana.",
    audience: "population",
    defaultPriority: "medium",
  },
];

export const mockChannels: BroadcastChannel[] = [
  { id: "ch-press", kind: "press", status: "online", audienceReach: 320_000, lastSentAt: "2026-05-13T10:35:00Z" },
  { id: "ch-x", kind: "social-x", status: "online", audienceReach: 145_000, lastSentAt: "2026-05-13T11:05:00Z" },
  { id: "ch-ig", kind: "social-instagram", status: "online", audienceReach: 92_000, lastSentAt: "2026-05-13T11:05:00Z" },
  { id: "ch-fb", kind: "social-facebook", status: "degraded", audienceReach: 68_000, lastSentAt: "2026-05-13T09:30:00Z" },
  { id: "ch-esa", kind: "es-alert", status: "online", audienceReach: 4_500, lastSentAt: "2026-05-13T09:55:00Z" },
  { id: "ch-rne", kind: "rne", status: "online", audienceReach: 210_000, lastSentAt: "2026-05-13T10:35:00Z" },
  { id: "ch-mail", kind: "internal-mail", status: "online", audienceReach: 480, lastSentAt: "2026-05-13T11:30:00Z" },
  { id: "ch-bo", kind: "official-bulletin", status: "offline", audienceReach: undefined, lastSentAt: undefined },
];

export const mockPublications: PublicationRecord[] = [
  { communiqueId: "com-503", channelId: "ch-press", status: "published", publishedAt: "2026-05-13T10:35:00Z", reach: 320_000 },
  { communiqueId: "com-503", channelId: "ch-x", status: "published", publishedAt: "2026-05-13T10:36:00Z", reach: 145_000 },
  { communiqueId: "com-503", channelId: "ch-rne", status: "published", publishedAt: "2026-05-13T10:35:00Z", reach: 210_000 },
  { communiqueId: "com-501", channelId: "ch-esa", status: "approved" },
  { communiqueId: "com-502", channelId: "ch-press", status: "draft" },
];
