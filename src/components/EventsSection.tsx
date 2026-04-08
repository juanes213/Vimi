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
          <h2 className="text-2xl font-semibold text-stone-900">Momentos del calendario</h2>
          <p className="text-sm leading-6 text-stone-500">
            {upcoming.length} proximos / {past.length} pasados
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary-button self-start">
          {showForm ? "Cerrar" : "Nuevo evento"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel-soft flex flex-col gap-3 p-5">
          <input
            className="surface-input"
            placeholder="Nombre del evento"
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
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar evento
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {events.length === 0 && (
          <div className="panel-soft px-6 py-10 text-center">
            <p className="text-lg font-semibold text-stone-800">Todavia no hay eventos guardados.</p>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Cuando agregues momentos aqui, la agenda se va a sentir menos tecnica y mas tuya.
            </p>
          </div>
        )}

        {upcoming.length > 0 && (
          <>
            <p className="text-xs uppercase tracking-[0.24em] text-stone-400">Proximos</p>
            {upcoming.map((event) => (
              <EventCard key={event._id} event={event} onDelete={() => removeEvent({ id: event._id })} />
            ))}
          </>
        )}

        {past.length > 0 && (
          <>
            <p className="mt-2 text-xs uppercase tracking-[0.24em] text-stone-400">Recientes</p>
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
  const month = new Date(event.date).toLocaleDateString("es-ES", { month: "short" });

  return (
    <div className={`panel-soft flex items-center gap-3 p-4 ${isPast ? "opacity-60" : ""}`}>
      <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-[20px] border border-white/70 bg-white/70 text-stone-700">
        <span className="text-lg font-semibold leading-none">{day}</span>
        <span className="text-[11px] uppercase tracking-[0.18em] text-stone-400">{month}</span>
      </div>

      <div className="flex-1">
        <p className="text-sm font-semibold text-stone-900">{event.title}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <span className="status-chip">fecha / {formatDate(event.date)}</span>
          {event.time && <span className="status-chip">hora / {event.time}</span>}
        </div>
      </div>

      <button onClick={onDelete} className="text-sm text-stone-300 transition-colors hover:text-red-400">
        x
      </button>
    </div>
  );
}
