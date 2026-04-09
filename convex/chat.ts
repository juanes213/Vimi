import { v } from "convex/values";
import { mutation, query, internalMutation, internalAction, httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.CONVEX_OPENAI_BASE_URL,
  apiKey: process.env.CONVEX_OPENAI_API_KEY,
});

export const listMessages = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("chatMessages")
      .withIndex("by_createdAt")
      .order("asc")
      .collect();
  },
});

export const sendMessage = mutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      text: args.text,
      role: "user",
      createdAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.chat.generateResponse, {
      userMessage: args.text,
    });
  },
});

export const generateResponse = internalAction({
  args: { userMessage: v.string() },
  handler: async (ctx, args) => {
    const systemPrompt = `You are a smart productivity assistant. When the user mentions creating a task, reminder, event, budget, or recurring payment, extract the relevant info and respond helpfully.

    If the user wants to create something, respond with a JSON block like:
    {"action": "create_task", "title": "...", "dueDate": "...", "priority": "high|medium|low"}
    or {"action": "create_reminder", "text": "...", "date": "...", "time": "..."}
    or {"action": "create_event", "title": "...", "date": "...", "time": "..."}

    Otherwise just respond naturally and helpfully about productivity, tasks, and planning.`;

    const response = await openai.chat.completions.create({
      model: "gpt-4.1-nano",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: args.userMessage },
      ],
    });

    const content = response.choices[0].message.content ?? "I couldn't process that.";

    let parsedType: string | undefined;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        parsedType = parsed.action;

        if (parsed.action === "create_task" && parsed.title) {
          await ctx.runMutation(internal.chat.createTaskFromChat, {
            title: parsed.title,
            priority: parsed.priority,
          });
        } else if (parsed.action === "create_reminder" && parsed.text) {
          await ctx.runMutation(internal.chat.createReminderFromChat, {
            text: parsed.text,
            date: parsed.date ? new Date(parsed.date).getTime() : Date.now() + 86400000,
          });
        } else if (parsed.action === "create_event" && parsed.title) {
          await ctx.runMutation(internal.chat.createEventFromChat, {
            title: parsed.title,
            date: parsed.date ? new Date(parsed.date).getTime() : Date.now() + 86400000,
            time: parsed.time,
          });
        }
      }
    } catch {
      // not a JSON response, that's fine
    }

    await ctx.runMutation(internal.chat.saveAssistantMessage, {
      text: content,
      parsedType,
    });
  },
});

export const saveAssistantMessage = internalMutation({
  args: {
    text: v.string(),
    parsedType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      text: args.text,
      role: "assistant",
      createdAt: Date.now(),
      parsedType: args.parsedType,
    });
  },
});

export const createTaskFromChat = internalMutation({
  args: {
    title: v.string(),
    priority: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("tasks", {
      title: args.title,
      priority: args.priority,
      status: "pending",
      source: "chat",
      createdAt: Date.now(),
    });
  },
});

export const createReminderFromChat = internalMutation({
  args: {
    text: v.string(),
    date: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("reminders", {
      text: args.text,
      date: args.date,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const createEventFromChat = internalMutation({
  args: {
    title: v.string(),
    date: v.number(),
    time: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("events", {
      title: args.title,
      date: args.date,
      time: args.time,
      createdAt: Date.now(),
    });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Deterministic NLP helpers
// ─────────────────────────────────────────────────────────────────────────────

type ParsedIntent =
  | { type: "reminder"; text: string; date: number; time?: string }
  | { type: "recurringPayment"; name: string; amount?: number; frequency: string }
  | { type: "budget"; category: string; amount?: number; month: string }
  | { type: "task"; title: string; dueDate?: number; priority?: string }
  | { type: "event"; title: string; date: number; time?: string }
  | { type: "unknown" };

/**
 * Resolve relative/named Spanish dates to a UTC timestamp (midnight local).
 * Supports: hoy, mañana, pasado mañana, weekday names, "el 15", ISO, DD/MM/YYYY.
 */
function resolveDate(text: string, now: Date): number | undefined {
  const lower = text.toLowerCase();

  if (/pasado\s+ma[ñn]ana/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 2);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (/ma[ñn]ana/.test(lower)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  if (/\bhoy\b/.test(lower)) {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  const weekdays: Record<string, number> = {
    domingo: 0, lunes: 1, martes: 2,
    "mi\u00e9rcoles": 3, miercoles: 3,
    jueves: 4, viernes: 5,
    "s\u00e1bado": 6, sabado: 6,
  };
  for (const [name, dow] of Object.entries(weekdays)) {
    if (lower.includes(name)) {
      const d = new Date(now);
      const diff = (dow - d.getDay() + 7) % 7 || 7;
      d.setDate(d.getDate() + diff);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    }
  }

  // "el 15", "el día 25", "día 3"
  const dayMatch = lower.match(/(?:el\s+d[ií]a\s+|el\s+|d[ií]a\s+)(\d{1,2})/);
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10);
    const d = new Date(now);
    d.setDate(day);
    if (d.getTime() < now.getTime()) d.setMonth(d.getMonth() + 1);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  // ISO: 2025-06-20
  const isoMatch = lower.match(/(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return new Date(isoMatch[1]).getTime();

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = lower.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
  if (dmyMatch) {
    return new Date(
      `${dmyMatch[3]}-${dmyMatch[2].padStart(2, "0")}-${dmyMatch[1].padStart(2, "0")}`
    ).getTime();
  }

  return undefined;
}

/** Extract HH:MM time string from text. */
function resolveTime(text: string): string | undefined {
  const colonMatch = text.match(/(\d{1,2})[:\.](\d{2})\s*(?:hs?|hrs?|horas?)?/i);
  if (colonMatch) return `${colonMatch[1].padStart(2, "0")}:${colonMatch[2]}`;
  const wordMatch = text.match(/a\s+las?\s+(\d{1,2})\s*(?:hs?|hrs?|horas?)?/i);
  if (wordMatch) return `${wordMatch[1].padStart(2, "0")}:00`;
  return undefined;
}

/** Extract the first monetary amount from text (supports $, comma decimals). */
function resolveAmount(text: string): number | undefined {
  const match = text.match(/\$?\s*(\d+(?:[.,]\d{1,2})?)/);
  if (!match) return undefined;
  return parseFloat(match[1].replace(",", "."));
}

/** Map text keywords to a budget category. */
function resolveBudgetCategory(text: string): string {
  const lower = text.toLowerCase();
  const map: Array<[RegExp, string]> = [
    [/comida|alimentaci[oó]n|supermercado|restaurante/, "Food"],
    [/transporte|gasolina|nafta|bus|metro|uber/, "Transport"],
    [/alquiler|renta|hipoteca|vivienda|casa/, "Housing"],
    [/entretenimiento|ocio|cine|netflix|spotify/, "Entertainment"],
    [/salud|m[eé]dico|farmacia|gym|gimnasio/, "Health"],
    [/educaci[oó]n|curso|libro|universidad/, "Education"],
    [/compras|ropa|tienda|shopping/, "Shopping"],
    [/servicios|luz|agua|gas|internet|tel[eé]fono/, "Utilities"],
  ];
  for (const [re, cat] of map) {
    if (re.test(lower)) return cat;
  }
  return "Other";
}

/** Detect task priority from text. */
function resolvePriority(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (/urgente|importante|alta|high|cr[ií]tico/.test(lower)) return "high";
  if (/baja|low|cuando\s+pueda/.test(lower)) return "low";
  if (/media|medium|normal/.test(lower)) return "medium";
  return undefined;
}

/**
 * Core deterministic intent parser.
 *
 * Architecture note: this function is intentionally isolated and returns a
 * plain `ParsedIntent` value. To integrate AI later, replace or wrap this
 * function — the rest of `parseMessageAndCreateEntities` stays unchanged.
 */
function parseIntent(text: string, now: Date): ParsedIntent {
  const lower = text.toLowerCase();

  // ── REMINDER ──────────────────────────────────────────────────────────────
  if (/recu[eé]rdame|recordatorio/.test(lower)) {
    const date = resolveDate(text, now) ?? now.getTime() + 86400000;
    const time = resolveTime(text);
    const body = text
      .replace(/recu[eé]rdame\s*(que\s*)?/i, "")
      .replace(/pasado\s+ma[ñn]ana|ma[ñn]ana|\bhoy\b/gi, "")
      .replace(/a\s+las?\s+\d{1,2}(?:[:\.]?\d{2})?\s*(?:hs?|hrs?|horas?)?/gi, "")
      .replace(/\d{1,2}[:\.]?\d{2}\s*(?:hs?|hrs?|horas?)?/gi, "")
      .trim()
      .replace(/\s{2,}/g, " ");
    return { type: "reminder", text: body || text, date, time };
  }

  // ── RECURRING PAYMENT ─────────────────────────────────────────────────────
  if (/todos\s+los\s+meses|mensual|cada\s+mes|pago\s+fijo|suscripci[oó]n|cuota/.test(lower)) {
    const amount = resolveAmount(text);
    let frequency = "monthly";
    if (/semanal|cada\s+semana|todas\s+las\s+semanas/.test(lower)) frequency = "weekly";
    if (/anual|cada\s+a[ñn]o|todos\s+los\s+a[ñn]os/.test(lower)) frequency = "yearly";
    if (/quincenal|cada\s+quince/.test(lower)) frequency = "biweekly";
    const name = text
      .replace(/\$?\s*\d+(?:[.,]\d{1,2})?/g, "")
      .replace(/todos\s+los\s+meses|mensual|cada\s+mes|pago\s+fijo|suscripci[oó]n|cuota/gi, "")
      .replace(/semanal|cada\s+semana|anual|cada\s+a[ñn]o|quincenal/gi, "")
      .trim()
      .replace(/\s{2,}/g, " ") || text;
    return { type: "recurringPayment", name, amount, frequency };
  }

  // ── BUDGET ────────────────────────────────────────────────────────────────
  if (/presupuesto|budget/.test(lower)) {
    const amount = resolveAmount(text);
    const category = resolveBudgetCategory(text);
    const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return { type: "budget", category, amount, month };
  }

  // ── EVENT ─────────────────────────────────────────────────────────────────
  if (/evento|reuni[oó]n|cita|cumplea[ñn]os|fiesta|conferencia/.test(lower)) {
    const date = resolveDate(text, now) ?? now.getTime() + 86400000;
    const time = resolveTime(text);
    const title = text
      .replace(/evento|reuni[oó]n|cita|cumplea[ñn]os|fiesta|conferencia/gi, "")
      .replace(/pasado\s+ma[ñn]ana|ma[ñn]ana|\bhoy\b/gi, "")
      .replace(/a\s+las?\s+\d{1,2}(?:[:\.]?\d{2})?\s*(?:hs?|hrs?|horas?)?/gi, "")
      .trim()
      .replace(/\s{2,}/g, " ") || text;
    return { type: "event", title, date, time };
  }

  // ── TASK ──────────────────────────────────────────────────────────────────
  if (/tarea|hacer|completar|terminar|entregar|revisar|llamar|enviar|escribir/.test(lower)) {
    const dueDate = resolveDate(text, now);
    const priority = resolvePriority(text);
    const title = text
      .replace(/tarea[:\s]*/gi, "")
      .replace(/pasado\s+ma[ñn]ana|ma[ñn]ana|\bhoy\b/gi, "")
      .trim()
      .replace(/\s{2,}/g, " ") || text;
    return { type: "task", title, dueDate, priority };
  }

  return { type: "unknown" };
}

// ─────────────────────────────────────────────────────────────────────────────
// Public mutation
// ─────────────────────────────────────────────────────────────────────────────

export const parseMessageAndCreateEntities = mutation({
  args: { text: v.string() },
  handler: async (
    ctx,
    args
  ): Promise<{ detectedType: string; entityId?: string }> => {
    const now = new Date();

    // 1. Persist the user message
    await ctx.db.insert("chatMessages", {
      text: args.text,
      role: "user",
      createdAt: Date.now(),
    });

    // 2. Detect intent
    // ┌─ AI integration point ──────────────────────────────────────────────┐
    // │ Replace `parseIntent(args.text, now)` with an `ctx.runAction` call  │
    // │ that calls an AI model and returns the same `ParsedIntent` shape.   │
    // └─────────────────────────────────────────────────────────────────────┘
    const intent = parseIntent(args.text, now);

    let entityId: string | undefined;
    let replyText = "";

    // 3. Create entity
    if (intent.type === "reminder") {
      entityId = await ctx.db.insert("reminders", {
        text: intent.text,
        date: intent.date,
        time: intent.time,
        status: "pending",
        createdAt: Date.now(),
      });
      replyText = `✅ Recordatorio creado: "${intent.text}"`;
    } else if (intent.type === "recurringPayment") {
      entityId = await ctx.db.insert("recurringPayments", {
        name: intent.name,
        amount: intent.amount ?? 0,
        frequency: intent.frequency,
        nextDueDate: now.getTime(),
        status: "active",
        createdAt: Date.now(),
      });
      replyText =
        `✅ Pago recurrente creado: "${intent.name}"` +
        ` (${intent.frequency}${intent.amount ? ` · $${intent.amount}` : ""})`;
    } else if (intent.type === "budget") {
      entityId = await ctx.db.insert("budgets", {
        category: intent.category,
        amount: intent.amount ?? 0,
        month: intent.month,
        createdAt: Date.now(),
      });
      replyText =
        `✅ Presupuesto creado: ${intent.category}` +
        `${intent.amount ? ` · $${intent.amount}` : ""} (${intent.month})`;
    } else if (intent.type === "task") {
      entityId = await ctx.db.insert("tasks", {
        title: intent.title,
        dueDate: intent.dueDate,
        priority: intent.priority,
        status: "pending",
        source: "chat",
        createdAt: Date.now(),
      });
      replyText = `✅ Tarea creada: "${intent.title}"`;
    } else if (intent.type === "event") {
      entityId = await ctx.db.insert("events", {
        title: intent.title,
        date: intent.date,
        time: intent.time,
        createdAt: Date.now(),
      });
      replyText = `✅ Evento creado: "${intent.title}"`;
    } else {
      replyText =
        "No detecté ninguna acción específica. " +
        "Puedes decirme: recuérdame, tarea, evento, presupuesto o pago mensual.";
    }

    // 4. Persist assistant reply
    await ctx.db.insert("chatMessages", {
      text: replyText,
      role: "assistant",
      createdAt: Date.now() + 1,
      parsedType:
        intent.type !== "unknown" ? `create_${intent.type}` : undefined,
    });

    return { detectedType: intent.type, entityId };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Streaming voz: HTTP action con Server-Sent Events
// ─────────────────────────────────────────────────────────────────────────────

export const insertUserMessage = internalMutation({
  args: { text: v.string() },
  handler: async (ctx, args) => {
    await ctx.db.insert("chatMessages", {
      text: args.text,
      role: "user",
      createdAt: Date.now(),
    });
  },
});

const VIMI_SYSTEM_PROMPT = `You are Vimi, a warm and close life assistant that speaks English.
Your tone is human, brief, and conversational — you are responding by voice, not by text,
so avoid bullet lists, markdown, asterisks, or any formatting. Speak like a caring friend
and consultant who helps the person organize their ideas and execute what they decide.

When the user mentions creating a task, reminder, event, budget, or recurring payment,
at the END of your response add a JSON block on a separate line with this shape (only one):
{"action": "create_task", "title": "...", "priority": "high|medium|low"}
{"action": "create_reminder", "text": "...", "date": "YYYY-MM-DD", "time": "HH:MM"}
{"action": "create_event", "title": "...", "date": "YYYY-MM-DD", "time": "HH:MM"}

The JSON block will not be spoken aloud — it is stripped before being sent to TTS.
Always respond first with natural language, then the JSON if applicable. Be brief: 1-3 sentences.`;

/**
 * HTTP streaming endpoint para voz. Recibe { text } por POST, guarda el mensaje
 * del usuario, llama a OpenAI con stream: true, y devuelve un stream SSE con
 * los deltas de texto. Al finalizar guarda el mensaje del assistant y procesa
 * acciones (crear tarea/recordatorio/evento).
 */
export const streamChat = httpAction(async (ctx, request) => {
  const { text } = (await request.json()) as { text?: string };
  if (!text || !text.trim()) {
    return new Response("missing text", { status: 400 });
  }

  await ctx.runMutation(internal.chat.insertUserMessage, { text });

  const openai = new OpenAI({
    baseURL: process.env.CONVEX_OPENAI_BASE_URL,
    apiKey: process.env.CONVEX_OPENAI_API_KEY,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      let full = "";
      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4.1-nano",
          stream: true,
          messages: [
            { role: "system", content: VIMI_SYSTEM_PROMPT },
            { role: "user", content: text },
          ],
        });

        for await (const chunk of completion) {
          const delta = chunk.choices[0]?.delta?.content ?? "";
          if (delta) {
            full += delta;
            send("delta", { text: delta });
          }
        }
      } catch (err) {
        console.error("[streamChat] openai error", err);
        send("error", { message: String(err) });
      }

      // Extraer y limpiar JSON de acción
      let parsedType: string | undefined;
      let spokenText = full;
      const jsonMatch = full.match(/\{[\s\S]*"action"[\s\S]*\}/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          parsedType = parsed.action;
          spokenText = full.replace(jsonMatch[0], "").trim();

          if (parsed.action === "create_task" && parsed.title) {
            await ctx.runMutation(internal.chat.createTaskFromChat, {
              title: parsed.title,
              priority: parsed.priority,
            });
          } else if (parsed.action === "create_reminder" && parsed.text) {
            await ctx.runMutation(internal.chat.createReminderFromChat, {
              text: parsed.text,
              date: parsed.date ? new Date(parsed.date).getTime() : Date.now() + 86400000,
            });
          } else if (parsed.action === "create_event" && parsed.title) {
            await ctx.runMutation(internal.chat.createEventFromChat, {
              title: parsed.title,
              date: parsed.date ? new Date(parsed.date).getTime() : Date.now() + 86400000,
              time: parsed.time,
            });
          }
        } catch {
          /* no era JSON válido */
        }
      }

      await ctx.runMutation(internal.chat.saveAssistantMessage, {
        text: spokenText || full || "(sin respuesta)",
        parsedType,
      });

      send("done", { parsedType });
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
});
