import { v } from "convex/values";
import { action, httpAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuthUserId } from "./lib/auth";
import {
  GOOGLE_SCOPES,
  buildGoogleConnectUrl,
  exchangeCodeForTokens,
  fetchGoogleProfile,
  parseGoogleState,
  revokeGoogleToken,
  serializeTokenRecord,
} from "./lib/google";

const GOOGLE_PROVIDER = "google";

export const listStatuses = query({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const integrations = await ctx.db
      .query("integrations")
      .withIndex("by_userId_status", (q) => q.eq("userId", userId))
      .collect();

    return integrations.map((integration) => ({
      _id: integration._id,
      provider: integration.provider,
      accountLabel: integration.accountLabel,
      status: integration.status,
      connectedAt: integration.connectedAt,
      lastSyncAt: integration.lastSyncAt,
      lastError: integration.lastError,
      scopes: integration.scopes,
    }));
  },
});

export const getGoogleConnectUrl = action({
  args: { returnTo: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireAuthUserId(ctx);
    return await buildGoogleConnectUrl({ userId, returnTo: args.returnTo });
  },
});

export const disconnectGoogle = action({
  args: {},
  handler: async (ctx) => {
    const userId = await requireAuthUserId(ctx);
    const oauthAccount = await ctx.runQuery(internal.integrations.getOAuthAccountForProvider, {
      userId,
      provider: GOOGLE_PROVIDER,
    });

    if (oauthAccount) {
      try {
        const { deserializeTokenRecord } = await import("./lib/google");
        const tokens = await deserializeTokenRecord(oauthAccount);
        await revokeGoogleToken(tokens.refreshToken ?? tokens.accessToken);
      } catch {
        // Best effort revoke.
      }
    }

    await ctx.runMutation(internal.integrations.markProviderDisconnected, {
      userId,
      provider: GOOGLE_PROVIDER,
    });
  },
});

export const googleOAuthCallback = httpAction(async (ctx, request) => {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  if (!state) {
    return new Response("Missing OAuth state", { status: 400 });
  }

  let parsedState: { userId: string; returnTo: string; issuedAt: number };
  try {
    parsedState = await parseGoogleState(state);
  } catch (error) {
    return new Response(`Invalid OAuth state: ${String(error)}`, { status: 400 });
  }

  const redirectUrl = new URL(parsedState.returnTo);

  if (oauthError) {
    redirectUrl.searchParams.set("google", "error");
    redirectUrl.searchParams.set("reason", oauthError);
    return Response.redirect(redirectUrl.toString(), 302);
  }

  if (!code) {
    redirectUrl.searchParams.set("google", "error");
    redirectUrl.searchParams.set("reason", "missing_code");
    return Response.redirect(redirectUrl.toString(), 302);
  }

  try {
    const tokenResponse = await exchangeCodeForTokens(code);
    const profile = await fetchGoogleProfile(tokenResponse.access_token, tokenResponse.id_token);

    await ctx.runMutation(internal.integrations.completeGoogleOAuth, {
      userId: parsedState.userId as any,
      accountLabel: profile.email ?? profile.name ?? "Google account",
      providerAccountId: profile.id,
      scopes: (tokenResponse.scope ?? GOOGLE_SCOPES.join(" ")).split(" ").filter(Boolean),
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: tokenResponse.expires_in ? Date.now() + tokenResponse.expires_in * 1000 : undefined,
      metadata: {
        token_type: tokenResponse.token_type,
        id_token: tokenResponse.id_token,
      },
    });

    redirectUrl.searchParams.set("google", "connected");
    return Response.redirect(redirectUrl.toString(), 302);
  } catch (error) {
    redirectUrl.searchParams.set("google", "error");
    redirectUrl.searchParams.set("reason", "oauth_failed");
    redirectUrl.searchParams.set("detail", String(error));
    return Response.redirect(redirectUrl.toString(), 302);
  }
});

export const getOAuthAccountForProvider = internalQuery({
  args: {
    userId: v.id("users"),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("oauthAccounts")
      .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .unique();
  },
});

export const getIntegrationForProvider = internalQuery({
  args: {
    userId: v.id("users"),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("integrations")
      .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .unique();
  },
});

export const completeGoogleOAuth = internalMutation({
  args: {
    userId: v.id("users"),
    accountLabel: v.string(),
    providerAccountId: v.string(),
    scopes: v.array(v.string()),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", GOOGLE_PROVIDER))
      .unique();

    const now = Date.now();
    const tokenPayload = await serializeTokenRecord({
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      metadata: args.metadata ?? {},
    });

    const integrationId =
      integration?._id ??
      (await ctx.db.insert("integrations", {
        userId: args.userId,
        provider: GOOGLE_PROVIDER,
        accountLabel: args.accountLabel,
        providerAccountId: args.providerAccountId,
        scopes: args.scopes,
        status: "connected",
        connectedAt: now,
        lastSyncAt: now,
        createdAt: now,
        updatedAt: now,
      }));

    if (integration) {
      await ctx.db.patch(integration._id, {
        accountLabel: args.accountLabel,
        providerAccountId: args.providerAccountId,
        scopes: args.scopes,
        status: "connected",
        connectedAt: integration.connectedAt ?? now,
        lastSyncAt: now,
        lastError: undefined,
        updatedAt: now,
      });
    }

    const oauthAccount = await ctx.db
      .query("oauthAccounts")
      .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", GOOGLE_PROVIDER))
      .unique();

    if (oauthAccount) {
      await ctx.db.patch(oauthAccount._id, {
        integrationId,
        ...tokenPayload,
        updatedAt: now,
      });
      return oauthAccount._id;
    }

    return await ctx.db.insert("oauthAccounts", {
      userId: args.userId,
      integrationId,
      provider: GOOGLE_PROVIDER,
      ...tokenPayload,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const storeOAuthAccountTokens = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    accessToken: v.string(),
    refreshToken: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    metadata: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const oauthAccount = await ctx.db
      .query("oauthAccounts")
      .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .unique();

    if (!oauthAccount) {
      throw new Error(`OAuth account for ${args.provider} not found`);
    }

    const tokenPayload = await serializeTokenRecord({
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      metadata: args.metadata ?? {},
    });

    await ctx.db.patch(oauthAccount._id, {
      ...tokenPayload,
      updatedAt: Date.now(),
    });
  },
});

export const markProviderDisconnected = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .unique();

    if (integration) {
      await ctx.db.patch(integration._id, {
        status: "disconnected",
        updatedAt: Date.now(),
      });
    }

    const oauthAccount = await ctx.db
      .query("oauthAccounts")
      .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .unique();

    if (oauthAccount) {
      await ctx.db.delete(oauthAccount._id);
    }
  },
});

export const saveIntegrationSync = internalMutation({
  args: {
    userId: v.id("users"),
    provider: v.string(),
    lastSyncAt: v.number(),
    lastError: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("connected"), v.literal("disconnected"), v.literal("needs_reauth"), v.literal("error")),
    ),
  },
  handler: async (ctx, args) => {
    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_userId_provider", (q) => q.eq("userId", args.userId).eq("provider", args.provider))
      .unique();

    if (!integration) return;

    await ctx.db.patch(integration._id, {
      lastSyncAt: args.lastSyncAt,
      lastError: args.lastError,
      status: args.status ?? integration.status,
      updatedAt: Date.now(),
    });
  },
});
