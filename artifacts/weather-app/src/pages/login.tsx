import { useState } from "react";
import { ShieldCheck, Loader2, LockKeyhole, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminSession } from "@/contexts/admin-session";

export function Login() {
  const { login } = useAdminSession();
  const [email, setEmail] = useState("admin@farmpal.local");
  const [password, setPassword] = useState("farmpal-admin");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      await login(email, password);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unable to sign in.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(47,111,60,0.18),_transparent_42%),linear-gradient(180deg,_#f8f5ee_0%,_#eef3ea_100%)] px-6 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center gap-10 lg:grid lg:grid-cols-[1.15fr_0.85fr]">
        <section className="hidden lg:block">
          <div className="max-w-xl space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-900/10 bg-white/80 px-4 py-2 text-sm font-medium text-emerald-900 shadow-sm">
              <ShieldCheck className="h-4 w-4" />
              FarmPal secure admin workspace
            </div>
            <div className="space-y-4">
              <h1 className="text-5xl font-bold tracking-tight text-slate-900">
                Keep the farm intelligence stack healthy, fast, and trustworthy.
              </h1>
              <p className="text-lg leading-8 text-slate-600">
                This console is for model health, prediction history, and operational checks. Farmers still use
                the public app flow, but the control surface now stays behind admin sign-in.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Card className="border-white/70 bg-white/80 shadow-lg shadow-emerald-950/5">
                <CardContent className="flex items-start gap-3 p-5">
                  <Sprout className="mt-1 h-5 w-5 text-emerald-700" />
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Operational visibility</p>
                    <p className="text-sm text-slate-600">Review recent readings, trends, and model-backed guidance without noisy debug clutter.</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="border-white/70 bg-white/80 shadow-lg shadow-emerald-950/5">
                <CardContent className="flex items-start gap-3 p-5">
                  <LockKeyhole className="mt-1 h-5 w-5 text-amber-700" />
                  <div className="space-y-1">
                    <p className="font-semibold text-slate-900">Protected access</p>
                    <p className="text-sm text-slate-600">Admin analytics and controls require a signed token now, instead of loading openly in the browser.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        <Card className="w-full border-white/80 bg-white/90 shadow-2xl shadow-emerald-950/10 backdrop-blur">
          <CardHeader className="space-y-3 pb-2">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-900 text-white shadow-lg shadow-emerald-950/20">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="space-y-1">
              <CardTitle className="text-2xl text-slate-900">Admin sign in</CardTitle>
              <CardDescription>
                Use your FarmPal admin credentials to open the protected dashboard.
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@farmpal.local"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                />
              </div>

              {error ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {error}
                </div>
              ) : null}

              <Button className="h-11 w-full rounded-xl" disabled={isSubmitting} type="submit">
                {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Sign in to FarmPal
              </Button>

              <p className="text-xs leading-6 text-slate-500">
                In local development, the default credentials are prefilled. On Render, set `ADMIN_EMAIL`,
                `ADMIN_PASSWORD`, and `ADMIN_SESSION_SECRET`.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
