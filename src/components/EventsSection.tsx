import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { formatDate } from "../lib/utils";

export function EventsSection() {
  const events = useQuery(api.events.list) ?? [];
  const createEvent = useMutation(api.events.create);
  const removeEvent = useMutation(api.events.remove);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !date) return;
    await createEvent({
      title: title.trim(),
      date: new Date(date).getTime(),
      time: time || undefined,
    });
    setTitle("");
    setDate("");
    setTime("");
    setShowForm(false);
  }

  const now = Date.now();
  const upcoming = events.filter((event) => event.date >= now);
  const past = events.filter((event) => event.date < now);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-white">Calendar moments</h2>
          <p className="text-sm leading-6 text-[rgba(180,204,201,0.5)]">
            {upcoming.length} upcoming / {past.length} past
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary-button self-start">
          {showForm ? "Close" : "New event"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel-soft flex flex-col gap-3 p-5">
          <input
            className="surface-input"
            placeholder="Event name"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
              Save event
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {events.length === 0 && (
          <div className="panel-soft px-6 py-10 text-center">
            <p className="text-lg font-semibold text-white">No events saved yet.</p>
            <p className="mt-2 text-sm leading-6 text-[rgba(180,204,201,0.5)]">
              When you add moments here, your schedule will feel less technical and more yours.
            </p>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-[0.24em] text-[rgba(180,204,201,0.45)]">Upcoming</p>
            {upcoming.map((event) => (
              <EventCard key={event._id} event={event} onDelete={() => removeEvent({ id: event._id })} />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-[rgba(180,204,201,0.45)]">Recent</p>
            {past.map((event) => (
              <EventCard
                key={event._id}
                event={event}
                onDelete={() => removeEvent({ id: event._id })}
                isPast
              />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

function EventCard({
  event,
  onDelete,
  isPast = false,
}: {
  event: { _id: string; title: string; date: number; time?: string };
  onDelete: () => void;
  isPast?: boolean;
}) {
  const day = new Date(event.date).getDate();
  const month = new Date(event.date).toLocaleDateString("en-US", { month: "short" });

  return (
    <div className={`panel-soft flex items-center gap-3 p-4 ${isPast ? "opacity-60" : ""}`}>
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[20px] border border-[rgba(255,255,255,0.12)] bg-[rgba(255,255,255,0.06)] text-white">
        <span className="text-lg font-semibold leading-none">{day}</span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-[rgba(180,204,201,0.5)]">{month}</span>
      </div>

      <div className="flex-1">
        <p className="text-sm font-semibold text-white">{event.title}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="status-chip">date / {formatDate(event.date)}</span>
          {event.time && <span className="status-chip">time / {event.time}</span>}
        </div>
      </div>

      <button onClick={onDelete} className="text-sm text-[rgba(180,204,201,0.35)] transition-colors hover:text-[rgba(255,80,100,0.7)]">
        x
      </button>
    </div>
  );
}
