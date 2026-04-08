import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { PRIORITY_COLORS, cn, formatDate } from "../lib/utils";

export function TasksSection() {
  const tasks = useQuery(api.tasks.list) ?? [];
  const createTask = useMutation(api.tasks.create);
  const updateStatus = useMutation(api.tasks.updateStatus);
  const removeTask = useMutation(api.tasks.remove);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("medium");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    await createTask({
      title: title.trim(),
      description: description.trim() || undefined,
      dueDate: dueDate ? new Date(dueDate).getTime() : undefined,
      priority,
      source: "manual",
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("medium");
    setShowForm(false);
  }

  const pending = tasks.filter((task) => task.status === "pending");
  const completed = tasks.filter((task) => task.status === "completed");

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">Enfoque del dia</h2>
          <p className="text-sm leading-6 text-stone-500">
            {pending.length} pendientes / {completed.length} completadas
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary-button self-start">
          {showForm ? "Cerrar" : "Nueva tarea"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel-soft flex flex-col gap-3 p-5">
          <input
            className="surface-input"
            placeholder="Titulo de la tarea"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <textarea
            className="surface-input min-h-24 resize-none"
            placeholder="Que implica esta tarea?"
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <div className="grid gap-3 sm:grid-cols-2">
            <input
              type="date"
              className="surface-input"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
            <select
              className="surface-input"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="high">Alta prioridad</option>
              <option value="medium">Prioridad media</option>
              <option value="low">Baja prioridad</option>
            </select>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="secondary-button">
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar tarea
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {tasks.length === 0 && (
          <div className="panel-soft px-6 py-10 text-center">
            <p className="text-lg font-semibold text-stone-800">Todavia no hay tareas.</p>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Puedes empezar con una sola accion pequena y dejar que Vimi te ayude con el resto.
            </p>
          </div>
        )}

        {tasks.map((task) => (
          <TaskCard
            key={task._id}
            task={task}
            onToggle={() =>
              updateStatus({
                id: task._id,
                status: task.status === "completed" ? "pending" : "completed",
              })
            }
            onDelete={() => removeTask({ id: task._id })}
          />
        ))}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  onToggle,
  onDelete,
}: {
  task: {
    _id: Id<"tasks">;
    title: string;
    description?: string;
    dueDate?: number;
    priority?: string;
    status: string;
    source: string;
  };
  onToggle: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "panel-soft flex items-start gap-3 p-4 transition-opacity",
        task.status === "completed" && "opacity-65",
      )}
    >
      <button
        onClick={onToggle}
        className={cn(
          "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors",
          task.status === "completed"
            ? "border-stone-900 bg-stone-900 text-white"
            : "border-stone-300 bg-white/70 text-transparent hover:border-stone-500",
        )}
      >
        <span className="text-[10px] font-semibold uppercase">
          {task.status === "completed" ? "ok" : ""}
        </span>
      </button>

      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "text-sm font-semibold text-stone-900",
            task.status === "completed" && "text-stone-400 line-through",
          )}
        >
          {task.title}
        </p>
        {task.description && (
          <p className="mt-1 text-sm leading-6 text-stone-500">{task.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {task.priority && (
            <span
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-[0.16em]",
                PRIORITY_COLORS[task.priority] ?? "bg-gray-100 text-gray-600",
              )}
            >
              {task.priority}
            </span>
          )}
          {task.dueDate && <span className="status-chip">vence / {formatDate(task.dueDate)}</span>}
          {task.source === "chat" && <span className="status-chip">via vimi</span>}
        </div>
      </div>

      <button onClick={onDelete} className="text-sm text-stone-300 transition-colors hover:text-red-400">
        x
      </button>
    </div>
  );
}
