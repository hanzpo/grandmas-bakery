import { useState } from "react";
import { Navigate } from "react-router";
import { useSession } from "../../lib/auth";
import { supabase } from "../../lib/supabase";

/** Passwordless magic-link login: grandma just types her email. */
export default function Login() {
  const session = useSession();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");

  if (session) return <Navigate to="/admin" replace />;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/admin` },
    });
    setState(error ? "error" : "sent");
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <form onSubmit={submit} className="card w-full max-w-sm">
        <h1 className="text-3xl text-terracotta">Bakery admin</h1>
        {state === "sent" ? (
          <p className="mt-4 text-lg">Check your email for a sign-in link.</p>
        ) : (
          <>
            <label className="label mt-6" htmlFor="email">Email</label>
            <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className="btn-primary mt-4 w-full" disabled={state === "sending"}>
              {state === "sending" ? "Sending…" : "Send me a sign-in link"}
            </button>
            {state === "error" && <p className="mt-3 text-berry">Something went wrong. Try again.</p>}
          </>
        )}
      </form>
    </div>
  );
}
