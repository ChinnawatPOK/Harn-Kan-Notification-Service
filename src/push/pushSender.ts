import { Expo, type ExpoPushMessage } from "expo-server-sdk";

export interface PushMessage {
  to: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
}

/** Outcome for one message, in the same order as the input. */
export type PushResult =
  | { token: string; ok: true }
  | { token: string; ok: false; error: string };

export interface PushSender {
  send(messages: PushMessage[]): Promise<PushResult[]>;
}

/**
 * Sends through the Expo Push API in chunks of 100. A chunk whose request
 * fails is reported as failed for every message in it; nothing is retried.
 */
export function createExpoPushSender(accessToken?: string): PushSender {
  const expo = new Expo({ accessToken });

  return {
    async send(messages) {
      const results: PushResult[] = [];
      for (const chunk of expo.chunkPushNotifications(messages.map(toExpoMessage))) {
        const tokens = chunk.map((m) => m.to as string);
        try {
          const tickets = await expo.sendPushNotificationsAsync(chunk);
          tickets.forEach((ticket, i) => {
            results.push(
              ticket.status === "ok"
                ? { token: tokens[i], ok: true }
                : { token: tokens[i], ok: false, error: ticket.details?.error ?? ticket.message },
            );
          });
        } catch (err) {
          const error = err instanceof Error ? err.message : String(err);
          tokens.forEach((token) => results.push({ token, ok: false, error }));
        }
      }
      return results;
    },
  };
}

// "high" asks APNs/FCM to deliver right away instead of when it suits the
// device (FCM holds "normal" while the phone dozes); channelId matches the
// channel the app creates on Android.
function toExpoMessage(message: PushMessage): ExpoPushMessage {
  return { ...message, sound: "default", priority: "high", channelId: "default" };
}
