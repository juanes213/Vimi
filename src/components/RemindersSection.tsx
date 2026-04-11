import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { cn, formatDate } from "../lib/utils";

export function RemindersSection() {
  const reminders = useQuery(api.reminders.list) ?? [];
  const createReminder = useMutation(api.reminders.create);
  const updateStatus = useMutation(api.reminders.updateStatus);
  const removeReminder = useMutation(api.reminders.remove);

  const [showForm, setShowForm] = useState(false);
  const [text, setText] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !date) return;
    await createReminder({
      text: text.trim(),
      date: new Date(date).getTime(),
      time: time || undefined,
    });
    setText("");
    setDate("");
    setTime("");
    setShowForm(false);
  }

  const pending = reminders.filter((reminder) => reminder.status === "pending");
  const completed = reminders.filter((reminder) => reminder.status === "completed");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Pending reminders</h2>
          <p className="text-sm leading-6 text-slate-400">
            {pending.length} to attend / {completed.length} resolved
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary-button self-start">
          {showForm ? "Close" : "New reminder"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel-soft flex flex-col gap-3 p-5">
          <input
            className="surface-input"
            placeholder="What do you want to remember?"
            value={text}
            onChange={(e) => setText(e.target.value)}
            required
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              className="surface-input"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
            <input
              type="time"
              className="surface-input"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="secondary-button">
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Save reminder
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {reminders.length === 0 && (
          <div className="panel-soft px-6 py-10 text-center">
            <p className="text-lg font-semibold text-white">No reminders saved yet.</p>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              This space works best when it nudges you calmly instead of sounding like an alarm.
            </p>
          </div>
        )}

        {reminders.map((reminder) => (
          <div
            key={reminder._id}
            className={cn(
              "panel-soft flex items-center gap-3 p-4",
              reminder.status === "completed" && "opacity-65",
            )}
          >
            <button
              onClick={() =>
                updateStatus({
                  id: reminder._id,
                  status: reminder.status === "completed" ? "pending" : "completed",
                })
              }
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
                reminder.status === "completed"
                  ? "border-stone-900 bg-stone-900 text-white"
                  : "border-stone-300 bg-white/70 text-transparent hover:border-stone-500",
              )}
            >
              <span className="text-[10px] font-semibold uppercase">
                {reminder.status === "completed" ? "ok" : ""}
              </span>
            </button>

            <div className="flex-1">
              <p
                className={cn(
                  "text-sm font-semibold text-white",
                  reminder.status === "completed" && "text-slate-500 line-through",
                )}
              >
              {reminder.text}
            </p>
              <p className="mt-2 flex flex-wrap gap-2 text-xs text-slate-400">
                <span className="status-chip">date / {formatDate(reminder.date)}</span>
                {reminder.time && <span className="status-chip">time / {reminder.time}</span>}
              </p>
            </div>

            <button
              onClick={() => removeReminder({ id: reminder._id })}
              className="text-sm text-slate-500 transition-colors hover:text-red-300"
            >
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
