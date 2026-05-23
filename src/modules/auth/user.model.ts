import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";
import { IUser } from "../../types";

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6, select: false },
  },
  { timestamps: true }
);

// ── FIXED PATTERN ────────────────────────────────────────
// Rule: async/await → no `next`. They are two different
// control flow styles. Mixing them causes subtle bugs.
//
//   ❌ BAD:  userSchema.pre("save", async function (next) { ... next(); })
//   ✅ GOOD: userSchema.pre("save", async function () { ... })
//
// Mongoose detects the function is async and handles
// the promise resolution automatically.
// ─────────────────────────────────────────────────────────
userSchema.pre("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export default mongoose.model<IUser>("User", userSchema);
