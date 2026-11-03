/** What a notification is about, so the app can pick an icon and wording. */
export const NOTIFICATION_TYPES = ['DEAL_CREATED', 'DEAL_CANCELLED', 'DEAL_EXPIRED'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
