import mongoose from 'mongoose';

const { Schema } = mongoose;

const leadSchema = new Schema(
  {
    externalId: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    url: {
      type: String,
      required: true,
      trim: true
    },
    source: {
      type: String,
      required: true,
      default: 'Upwork',
      trim: true
    },
    country: {
      type: String,
      required: true,
      trim: true
    },
    budget: {
      type: String,
      default: null,
      trim: true
    },
    jobType: {
      type: String,
      default: null,
      trim: true
    },
    duration: {
      type: String,
      default: null,
      trim: true
    },
    postedAt: {
      type: Date,
      default: null
    },
    searchedKeywords: {
      type: [String],
      default: []
    },
    skills: {
      type: [String],
      default: []
    },
    summary: {
      type: String,
      default: null,
      trim: true
    },
    lastSearchRunId: {
      type: String,
      required: true,
      trim: true
    }
  },
  {
    collection: 'leads',
    timestamps: true,
    versionKey: false
  }
);

leadSchema.index({ externalId: 1 }, { unique: true });
leadSchema.index({ url: 1 }, { unique: true });
leadSchema.index({ postedAt: -1 });
leadSchema.index({ country: 1, postedAt: -1 });

export const LeadModel =
  mongoose.models.Lead || mongoose.model('Lead', leadSchema);
