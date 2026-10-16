import { Schema, model, type InferSchemaType } from 'mongoose';
import { CATEGORIES } from '../constants/categories';

const preferenceSchema = new Schema(
  {
    userId: { type: String, required: true },
    categories: { type: [String], enum: CATEGORIES, default: [] },
  },
  { collection: 'preferences', timestamps: true, versionKey: false },
);

// Spec: one preference document per user.
preferenceSchema.index({ userId: 1 }, { unique: true });
// Added: multikey index so the fan-out query "who subscribed to DRINK?" is fast.
preferenceSchema.index({ categories: 1 });

export type PreferenceDoc = InferSchemaType<typeof preferenceSchema>;

export const Preference = model('Preference', preferenceSchema);
