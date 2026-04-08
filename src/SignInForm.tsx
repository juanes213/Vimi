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
              toastTitle = "Contrasena invalida. Intentalo de nuevo.";
            } else {
              toastTitle =
                flow === "signIn"
                  ? "No se pudo iniciar sesion. Quizas querias crear una cuenta."
                  : "No se pudo crear la cuenta. Quizas querias iniciar sesion.";
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
          placeholder="Correo"
          required
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Contrasena"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {submitting ? "Entrando..." : flow === "signIn" ? "Entrar" : "Crear cuenta"}
        </button>
        <div className="text-center text-sm text-stone-500">
          <span>
            {flow === "signIn" ? "Aun no tienes cuenta? " : "Ya tienes una cuenta? "}
          </span>
          <button
            type="button"
            className="font-medium text-stone-900 transition-colors hover:text-[#bf6b4f]"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Crear cuenta" : "Iniciar sesion"}
          </button>
        </div>
      </form>

      <div className="my-5 flex items-center justify-center">
        <hr className="grow border-stone-200/70" />
        <span className="mx-4 text-xs uppercase tracking-[0.24em] text-stone-400">o</span>
        <hr className="grow border-stone-200/70" />
      </div>

      <button className="secondary-button w-full" onClick={() => void signIn("anonymous")}>
        Entrar de forma anonima
      </button>
    </div>
  );
}
