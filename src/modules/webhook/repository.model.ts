import mongoose, { Schema } from "mongoose";

const reviewRulesSchema = new Schema(
  {
    focusAreas: {
      type: [String],
      default: ["security", "performance", "style", "bugs", "best_practices"],
    },
    language: { type: String, default: "auto" },
    strictness: {
      type: String,
      enum: ["relaxed", "standard", "strict"],
      default: "standard",
    },
    maxFileSize: { type: Number, default: 500 }, // Skip files > 500 lines
    ignorePatterns: {
      type: [String],
      default: ["package-lock.json", "*.min.js", "*.min.css", "dist/*"],
    },
  },
  { _id: false }
);

const repositorySchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    githubRepoFullName: { type: String, required: true }, // "owner/repo"
    webhookActive: { type: Boolean, default: true },
    reviewRules: { type: reviewRulesSchema, default: () => ({}) },
  },
  { timestamps: true }
);

// Unique per user+repo combination
repositorySchema.index({ user: 1, githubRepoFullName: 1 }, { unique: true });

export default mongoose.model("Repository", repositorySchema);
