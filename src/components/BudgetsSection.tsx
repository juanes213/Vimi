import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BUDGET_CATEGORIES, getCurrentMonth } from "../lib/utils";

export function BudgetsSection() {
  const currentMonth = getCurrentMonth();
  const allBudgets = useQuery(api.budgets.list) ?? [];
  const budgets = allBudgets.filter((budget) => budget.month === currentMonth);
  const createBudget = useMutation(api.budgets.create);
  const removeBudget = useMutation(api.budgets.remove);

  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState(BUDGET_CATEGORIES[0]);
  const [amount, setAmount] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!category || !amount) return;
    await createBudget({
      category,
      amount: parseFloat(amount),
      month: currentMonth,
    });
    setAmount("");
    setShowForm(false);
  }

  const total = budgets.reduce((sum, budget) => sum + budget.amount, 0);
  const monthLabel = new Date(`${currentMonth}-01`).toLocaleDateString("es-ES", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">Pulso financiero</h2>
          <p className="text-sm leading-6 text-stone-500">
            {monthLabel} / total ${total.toFixed(2)}
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary-button self-start">
          {showForm ? "Cerrar" : "Agregar presupuesto"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel-soft flex flex-col gap-3 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <select
              className="surface-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {BUDGET_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              type="number"
              step="0.01"
              className="surface-input sm:w-40"
              placeholder="Monto"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="secondary-button">
              Cancelar
            </button>
            <button type="submit" className="primary-button">
              Guardar presupuesto
            </button>
          </div>
        </form>
      )}

      {budgets.length === 0 ? (
        <div className="panel-soft px-6 py-10 text-center">
          <p className="text-lg font-semibold text-stone-800">No hay presupuesto para este mes.</p>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Esta parte deberia sentirse como claridad y margen, no como una hoja de calculo.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {budgets.map((budget) => {
            const pct = total > 0 ? Math.min((budget.amount / total) * 100, 100) : 0;

            return (
              <div key={budget._id} className="panel-soft p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-stone-900">{budget.category}</p>
                    <p className="mt-1 text-sm text-stone-500">${budget.amount.toFixed(2)}</p>
                  </div>
                  <button
                    onClick={() => removeBudget({ id: budget._id })}
                    className="text-sm text-stone-300 transition-colors hover:text-red-400"
                  >
                    x
                  </button>
                </div>

                <div className="mt-4 h-2.5 rounded-full bg-stone-200/70">
                  <div
                    className="h-2.5 rounded-full bg-gradient-to-r from-[#d6a17d] via-[#bc7a5d] to-[#8a7361] transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <p className="mt-2 text-xs uppercase tracking-[0.18em] text-stone-400">
                  {pct.toFixed(0)}% del total
                </p>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
