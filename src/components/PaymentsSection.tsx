import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { BUDGET_CATEGORIES, FREQUENCY_OPTIONS, cn, formatDate } from "../lib/utils";

export function PaymentsSection() {
  const payments = useQuery(api.recurringPayments.list) ?? [];
  const createPayment = useMutation(api.recurringPayments.create);
  const toggleStatus = useMutation(api.recurringPayments.toggleStatus);
  const removePayment = useMutation(api.recurringPayments.remove);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [nextDueDate, setNextDueDate] = useState("");
  const [category, setCategory] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !amount || !nextDueDate) return;
    await createPayment({
      name: name.trim(),
      amount: parseFloat(amount),
      frequency,
      nextDueDate: new Date(nextDueDate).getTime(),
      category: category || undefined,
    });
    setName("");
    setAmount("");
    setFrequency("monthly");
    setNextDueDate("");
    setCategory("");
    setShowForm(false);
  }

  const totalMonthly = payments
    .filter((payment) => payment.status === "active")
    .reduce((sum, payment) => {
      const multiplier: Record<string, number> = {
        daily: 30,
        weekly: 4.33,
        biweekly: 2.17,
        monthly: 1,
        quarterly: 0.33,
        yearly: 0.083,
      };
      return sum + payment.amount * (multiplier[payment.frequency] ?? 1);
    }, 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-stone-900">Recurring commitments</h2>
          <p className="text-sm leading-6 text-stone-500">
            Estimated flow / ${totalMonthly.toFixed(2)} per month
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className="primary-button self-start">
          {showForm ? "Close" : "Add payment"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleSubmit} className="panel-soft flex flex-col gap-3 p-5">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              className="surface-input"
              placeholder="Payment name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              type="number"
              step="0.01"
              className="surface-input sm:w-40"
              placeholder="Amount"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <select
              className="surface-input"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value)}
            >
              {FREQUENCY_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
            <select
              className="surface-input"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">Category (optional)</option>
              {BUDGET_CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
          <input
            type="date"
            className="surface-input"
            value={nextDueDate}
            onChange={(e) => setNextDueDate(e.target.value)}
            required
          />
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={() => setShowForm(false)} className="secondary-button">
              Cancel
            </button>
            <button type="submit" className="primary-button">
              Save payment
            </button>
          </div>
        </form>
      )}

      <div className="flex flex-col gap-3">
        {payments.length === 0 && (
          <div className="panel-soft px-6 py-10 text-center">
            <p className="text-lg font-semibold text-stone-800">No recurring payments yet.</p>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Here you should feel financial clarity without entering a banking atmosphere.
            </p>
          </div>
        )}

        {payments.map((payment) => (
          <div key={payment._id} className="panel-soft flex items-center gap-3 p-4">
            <div
              className={cn(
                "h-12 w-2 shrink-0 rounded-full",
                payment.status === "active" ? "bg-emerald-400" : "bg-stone-300",
              )}
            />

            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-stone-900">{payment.name}</p>
                {payment.category && <span className="status-chip">{payment.category}</span>}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="status-chip">${payment.amount.toFixed(2)}</span>
                <span className="status-chip">{payment.frequency}</span>
                <span className="status-chip">next / {formatDate(payment.nextDueDate)}</span>
              </div>
            </div>

            <button
              onClick={() => toggleStatus({ id: payment._id })}
              className={cn(
                "secondary-button px-4 py-2 text-xs uppercase tracking-[0.18em]",
                payment.status === "active" ? "text-amber-700" : "text-emerald-700",
              )}
            >
              {payment.status === "active" ? "Pause" : "Resume"}
            </button>
            <button onClick={() => removePayment({ id: payment._id })} className="text-sm text-stone-300 transition-colors hover:text-red-400">
              x
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
