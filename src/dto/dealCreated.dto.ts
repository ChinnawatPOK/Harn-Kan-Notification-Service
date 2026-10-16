import { z } from "zod";
import { CATEGORIES } from "../constants/categories";
import { ValidationError } from "../errors";
import { parseOrThrow } from "./parse";

const requiredMessage = (field: string) =>
  `Field "${field}" is required and must be a non-empty string`;

const requiredString = (field: string) =>
  z
    .string({ error: requiredMessage(field) })
    .refine((v) => v.trim() !== "", { error: requiredMessage(field) });

const requiredId = (field: string) =>
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
    /** Sent for the 500 m radius filter in a later round; not used now. */
    lat: requiredNumber("lat"),
    lng: requiredNumber("lng"),
  },
  { error: "Message body must be a JSON object" },
);

export type DealCreatedEvent = z.output<typeof dealCreatedSchema>;

export function parseDealCreated(content: Buffer): DealCreatedEvent {
  let body: unknown;
  try {
    body = JSON.parse(content.toString("utf8"));
  } catch {
    throw new ValidationError("Message body is not valid JSON");
  }
  if (Array.isArray(body)) {
    throw new ValidationError("Message body must be a JSON object");
  }
  return parseOrThrow(dealCreatedSchema, body);
}
