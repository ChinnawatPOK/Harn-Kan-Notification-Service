import { z } from "zod";
import { CATEGORIES } from "../constants/categories";
import { parseMessage } from "./parse";

export const requiredMessage = (field: string) =>
  `Field "${field}" is required and must be a non-empty string`;

export const requiredString = (field: string) =>
  z
    .string({ error: requiredMessage(field) })
    .refine((v) => v.trim() !== "", { error: requiredMessage(field) });

export const requiredId = (field: string) =>
  z.union([z.number().transform(String), requiredString(field)], {
    error: requiredMessage(field),
  });

const requiredNumber = (field: string) =>
  z.number({ error: `Field "${field}" is required and must be a number` });

export const dealCreatedSchema = z.object(
  {
    eventId: requiredString("eventId"),
    eventType: z.literal("deal.created", {
      error: (issue) =>
        typeof issue.input === "string" && issue.input.trim() !== ""
          ? `Unexpected eventType "${issue.input}"`
          : requiredMessage("eventType"),
    }),
    occurredAt: requiredString("occurredAt"),
    dealId: requiredId("dealId"),
    creatorId: requiredId("creatorId"),
    category: z.enum(CATEGORIES, {
      error: (issue) =>
        typeof issue.input === "string" && issue.input.trim() !== ""
          ? `Invalid category "${issue.input}". Allowed: ${CATEGORIES.join(", ")}`
          : requiredMessage("category"),
    }),
    shopName: requiredString("shopName"),
    lat: requiredNumber("lat"),
    lng: requiredNumber("lng"),
  },
  { error: "Message body must be a JSON object" },
);

export type DealCreatedEvent = z.output<typeof dealCreatedSchema>;

export function parseDealCreated(content: Buffer): DealCreatedEvent {
  return parseMessage(dealCreatedSchema, content);
}
