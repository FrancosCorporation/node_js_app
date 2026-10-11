import bcrypt from "bcryptjs";
import isEmail from "validator/lib/isEmail";
import mongoose from "mongoose";
import { BCRYPT_SHA256_PREFIX, prehashPassword } from "../utils/passwordHash";

interface UserFields {
  name: string;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new mongoose.Schema<UserFields>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      validate: {
        validator: (value: string) => isEmail(value),
        message: "Informe um endereço de e-mail válido.",
      },
    },
    password: {
      type: String,
      required: true,
      select: false,
    },
  },
  { timestamps: true },
);

userSchema.pre("save", async function hashPassword() {
  if (!this.isModified("password")) return;
  const bcryptHash = await bcrypt.hash(prehashPassword(this.password), 12);
  this.password = `${BCRYPT_SHA256_PREFIX}${bcryptHash}`;
});

export const User = mongoose.model<UserFields>("User", userSchema);
