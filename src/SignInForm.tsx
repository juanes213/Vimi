"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitting(true);
          const formData = new FormData(e.target as HTMLFormElement);
          formData.set("flow", flow);
          void signIn("password", formData).catch((error) => {
            let toastTitle = "";
            if (error.message.includes("Invalid password")) {
              toastTitle = "Invalid password. Please try again.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "Could not sign in. Maybe you meant to create an account."
                  : "Could not create account. Maybe you meant to sign in.";
            }
            toast.error(toastTitle);
            setSubmitting(false);
          });
        }}
      >
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {submitting ? "Signing in…" : flow === "signIn" ? "Sign in" : "Create account"}
        </button>
        <div className="text-center text-sm text-stone-500">
          <span>
            {flow === "signIn" ? "Don't have an account? " : "Already have an account? "}
          </span>
          <button
            type="button"
            className="font-medium text-stone-900 transition-colors hover:text-[#bf6b4f]"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Create account" : "Sign in"}
          </button>
        </div>
      </form>

      <div className="my-5 flex items-center justify-center">
        <hr className="grow border-stone-200/70" />
        <span className="mx-4 text-xs uppercase tracking-[0.24em] text-stone-400">or</span>
        <hr className="grow border-stone-200/70" />
      </div>

      <button className="secondary-button w-full" onClick={() => void signIn("anonymous")}>
        Continue anonymously
      </button>
    </div>
  );
}
