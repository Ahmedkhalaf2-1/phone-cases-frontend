"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { useAdminAuth } from "@/lib/admin/AdminAuthProvider";
import { SITE } from "@/config/site";

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, loginError, staff } = useAdminAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formId = useId();

  if (staff) {
    router.replace("/admin");
    return null;
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.push("/admin");
    } catch {
      // loginError from context already reflects the failure.
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-background p-8">
        <h1 className="font-display text-2xl tracking-wide text-ink uppercase">
          {SITE.brandName} Admin
        </h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Staff sign-in — real backend credentials required.
        </p>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-email`} className="text-sm font-semibold text-ink">
              Email
            </label>
            <input
              id={`${formId}-email`}
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-pill border border-border bg-background px-4 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`${formId}-password`} className="text-sm font-semibold text-ink">
              Password
            </label>
            <input
              id={`${formId}-password`}
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-pill border border-border bg-background px-4 py-2.5 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
          {loginError && <p className="text-sm text-accent">{loginError}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="mt-2 inline-flex items-center justify-center gap-2 rounded-pill bg-ink px-6 py-3 text-sm font-medium tracking-tight text-white transition-colors enabled:hover:bg-accent disabled:opacity-50"
          >
            {isSubmitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </main>
  );
}
