import { useState } from "react";
import { Navigate } from "react-router";
import { useSession } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { BunBun } from "../../components/illustrations";

// Hackathon shortcut: one shared staff account, so the admin only needs a password.
const ADMIN_EMAIL = "admin@grandmas-bakery.app";

export default function Login() {
  const session = useSession();
  const [password, setPassword] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  if (session) return <Navigate to="/admin" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("loading");
    const { error } = await supabase.auth.signInWithPassword({ email: ADMIN_EMAIL, password });
    setState(error ? "error" : "idle");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm text-center">
        <div className="mx-auto mb-2 w-40 rounded-3xl bg-butter-soft p-4">
          <BunBun className="w-full" />
        </div>
        <p className="eyebrow mt-4">Staff only</p>
        <h1 className="text-3xl">
          Grandma's <span className="text-jam">Bakery</span>
        </h1>
        <label className="label mt-6 text-left" htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          required
          autoFocus
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button className="btn-primary mt-4 w-full" disabled={state === "loading"}>
          {state === "loading" ? "Checking…" : "Enter"}
        </button>
        {state === "error" && <p className="mt-3 text-berry">Wrong password.</p>}
      </form>
    </div>
  );
}
