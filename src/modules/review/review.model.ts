import mongoose, { Schema } from "mongoose";

const reviewCommentSchema = new Schema(
  {
    file: { type: String, required: true },
    line: { type: Number, required: true },
    severity: {
      type: String,
      enum: ["critical", "warning", "suggestion", "praise"],
      required: true,
    },
    category: { type: String, required: true },
    message: { type: String, required: true },
    suggestion: { type: String, default: "" },
  },
  { _id: false }
);

const reviewSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true },
    repository: { type: Schema.Types.ObjectId, ref: "Repository", required: true },
    pullNumber: { type: Number, required: true },
    prTitle: { type: String, required: true },
    prAuthor: { type: String, required: true },
    baseBranch: { type: String, required: true },
    headBranch: { type: String, required: true },
    filesChanged: { type: Number, default: 0 },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    comments: { type: [reviewCommentSchema], default: [] },
    summary: { type: String, default: "" },
    overallScore: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "reviewing", "completed", "failed"],
      default: "pending",
    },
    githubCommentId: { type: Number },
  },
  { timestamps: true }
);

// Index for fast lookups: "did we already review this PR?"
reviewSchema.index({ repository: 1, pullNumber: 1 });

export default mongoose.model("Review", reviewSchema);
