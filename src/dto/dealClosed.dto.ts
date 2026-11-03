import { z } from "zod";
import {
  dealCreatedSchema,
  requiredId,
  requiredMessage,
} from "./dealCreated.dto";
import { parseMessage } from "./parse";

export const DEAL_CLOSED_EVENT_TYPES = ["deal.cancelled", "deal.expired"] as const;

/**
 * `deal.cancelled` and `deal.expired`: the `deal.created` payload plus the
 * participants whose money is being refunded. `participantIds` may be empty
 * (nobody had paid yet).
 */
export const dealClosedSchema = dealCreatedSchema.extend({
  eventType: z.enum(DEAL_CLOSED_EVENT_TYPES, {
    error: (issue) =>
      typeof issue.input === "string" && issue.input.trim() !== ""
        ? `Unexpected eventType "${issue.input}"`
        : requiredMessage("eventType"),
  }),
  participantIds: z.array(requiredId("participantIds"), {
    error: 'Field "participantIds" is required and must be an array of strings',
  }),
});

export type DealClosedEvent = z.output<typeof dealClosedSchema>;

export function parseDealClosed(content: Buffer): DealClosedEvent {
  return parseMessage(dealClosedSchema, content);
}
