import { ConvexError } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export async function requireAuthUserId(ctx: { auth: any }) {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError("Unauthenticated");
  }
  return userId;
}
