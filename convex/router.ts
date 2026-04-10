import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { streamChat } from "./chat";
import { googleOAuthCallback } from "./integrations";

const http = httpRouter();

http.route({
  path: "/chat/stream",
  method: "POST",
  handler: streamChat,
});

http.route({
  path: "/chat/stream",
  method: "OPTIONS",
  handler: httpAction(async () => {
    return new Response(null, {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      },
    });
  }),
});

http.route({
  path: "/integrations/google/callback",
  method: "GET",
  handler: googleOAuthCallback,
});

export default http;
