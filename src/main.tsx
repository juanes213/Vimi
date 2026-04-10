import { createRoot } from "react-dom/client";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import "./index.css";
import App from "./App";

const convexUrl = import.meta.env.VITE_CONVEX_URL as string | undefined;
const root = createRoot(document.getElementById("root")!);

if (!convexUrl) {
  root.render(
    <div className="soft-galaxy flex min-h-screen items-center justify-center px-6 text-slate-100">
      <div className="panel-surface max-w-xl p-8 text-center">
        <p className="text-sm uppercase tracking-[0.24em] text-slate-400">Vimi setup</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Missing Convex URL</h1>
        <p className="mt-4 text-sm leading-7 text-slate-300">
          Add VITE_CONVEX_URL in Vercel Environment Variables and redeploy the project.
        </p>
      </div>
    </div>,
  );
} else {
  const convex = new ConvexReactClient(convexUrl);

  root.render(
    <ConvexAuthProvider client={convex}>
      <App />
    </ConvexAuthProvider>,
  );
}
