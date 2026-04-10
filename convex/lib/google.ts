import type { Id } from "./../_generated/dataModel";
import { decryptSecret, encryptSecret, signOAuthState, verifyOAuthState } from "./crypto";

const GOOGLE_PROVIDER = "google";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
const GMAIL_BASE_URL = "https://gmail.googleapis.com/gmail/v1/users/me";
const CALENDAR_BASE_URL = "https://www.googleapis.com/calendar/v3/calendars/primary";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/calendar",
];

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getGoogleClientId() {
  return getRequiredEnv("GOOGLE_CLIENT_ID");
}

function getGoogleClientSecret() {
  return getRequiredEnv("GOOGLE_CLIENT_SECRET");
}

export function getGoogleRedirectUri() {
  return (
    process.env.GOOGLE_REDIRECT_URI ??
    `${getRequiredEnv("CONVEX_SITE_URL")}/integrations/google/callback`
  );
}

export async function buildGoogleConnectUrl(args: { userId: Id<"users">; returnTo: string }) {
  const state = await signOAuthState({
    userId: args.userId,
    returnTo: args.returnTo,
    issuedAt: Date.now(),
  });

  const url = new URL(GOOGLE_AUTH_URL);
  url.searchParams.set("client_id", getGoogleClientId());
  url.searchParams.set("redirect_uri", getGoogleRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("scope", GOOGLE_SCOPES.join(" "));
  url.searchParams.set("state", state);
  return url.toString();
}

export async function parseGoogleState(state: string) {
  return await verifyOAuthState<{ userId: Id<"users">; returnTo: string; issuedAt: number }>(state);
}

export async function exchangeCodeForTokens(code: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      redirect_uri: getGoogleRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token exchange failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
    id_token?: string;
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: getGoogleClientId(),
      client_secret: getGoogleClientSecret(),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    throw new Error(`Google token refresh failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as {
    access_token: string;
    expires_in?: number;
    scope?: string;
    token_type?: string;
  };
}

export async function revokeGoogleToken(token: string) {
  await fetch(GOOGLE_REVOKE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ token }),
  });
}

function decodeJwtPayload(token: string) {
  const payload = token.split(".")[1];
  if (!payload) {
    throw new Error("Missing JWT payload");
  }
  const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return JSON.parse(Buffer.from(padded, "base64").toString("utf8")) as Record<string, unknown>;
}

export async function fetchGoogleProfile(accessToken: string, idToken?: string) {
  const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (response.ok) {
    const payload = (await response.json()) as {
      sub?: string;
      email?: string;
      name?: string;
    };
    return {
      id: String(payload.sub ?? ""),
      email: payload.email,
      name: payload.name,
    };
  }

  if (idToken) {
    const payload = decodeJwtPayload(idToken);
    return {
      id: String(payload.sub ?? ""),
      email: payload.email ? String(payload.email) : undefined,
      name: payload.name ? String(payload.name) : undefined,
    };
  }

  throw new Error(`Google profile fetch failed: ${response.status}`);
}

export async function serializeTokenRecord(record: {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  metadata?: Record<string, unknown>;
}) {
  return {
    encryptedAccessToken: await encryptSecret(record.accessToken),
    encryptedRefreshToken: record.refreshToken ? await encryptSecret(record.refreshToken) : undefined,
    expiresAt: record.expiresAt,
    tokenMetadataJson: record.metadata ? JSON.stringify(record.metadata) : undefined,
  };
}

export async function deserializeTokenRecord(record: {
  encryptedAccessToken: string;
  encryptedRefreshToken?: string;
  expiresAt?: number;
}) {
  return {
    accessToken: await decryptSecret(record.encryptedAccessToken),
    refreshToken: record.encryptedRefreshToken ? await decryptSecret(record.encryptedRefreshToken) : undefined,
    expiresAt: record.expiresAt,
  };
}

export type GoogleApiContext = {
  runQuery: (ref: unknown, args: unknown) => Promise<any>;
  runMutation: (ref: unknown, args: unknown) => Promise<any>;
};

export async function withGoogleAccessToken(
  ctx: GoogleApiContext,
  internal: any,
  userId: Id<"users">,
  callback: (accessToken: string) => Promise<any>,
) {
  const account = await ctx.runQuery(internal.integrations.getOAuthAccountForProvider, {
    userId,
    provider: GOOGLE_PROVIDER,
  });
  if (!account) {
    throw new Error("Google account not connected");
  }

  let { accessToken, refreshToken, expiresAt } = await deserializeTokenRecord(account);
  const needsRefresh = !!refreshToken && (!expiresAt || expiresAt <= Date.now() + 60_000);

  if (needsRefresh && refreshToken) {
    const refreshed = await refreshGoogleAccessToken(refreshToken);
    accessToken = refreshed.access_token;
    expiresAt = refreshed.expires_in ? Date.now() + refreshed.expires_in * 1000 : expiresAt;

    await ctx.runMutation(internal.integrations.storeOAuthAccountTokens, {
      userId,
      provider: GOOGLE_PROVIDER,
      accessToken,
      refreshToken,
      expiresAt,
      metadata: {
        scope: refreshed.scope,
        token_type: refreshed.token_type,
      },
    });
  }

  return await callback(accessToken);
}

export async function googleApiFetch(
  accessToken: string,
  path: string,
  init?: RequestInit,
) {
  return await fetch(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

export function buildDraftEmailRaw(args: {
  to: string;
  subject: string;
  body: string;
  cc?: string[];
  bcc?: string[];
}) {
  const headers = [
    `To: ${args.to}`,
    ...(args.cc?.length ? [`Cc: ${args.cc.join(", ")}`] : []),
    ...(args.bcc?.length ? [`Bcc: ${args.bcc.join(", ")}`] : []),
    `Subject: ${args.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=utf-8",
    "",
    args.body,
  ];

  return Buffer.from(headers.join("\r\n"), "utf8").toString("base64url");
}

export function gmailUrl(path: string) {
  return `${GMAIL_BASE_URL}${path}`;
}

export function calendarUrl(path: string) {
  return `${CALENDAR_BASE_URL}${path}`;
}
