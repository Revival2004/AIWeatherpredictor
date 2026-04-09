import { lazy, Suspense } from "react";
import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout";
import { Home } from "@/pages/home";
import { Login } from "@/pages/login";
import NotFound from "@/pages/not-found";
import { AdminSessionProvider, useAdminSession } from "@/contexts/admin-session";

const History = lazy(async () => {
  const module = await import("@/pages/history");
  return { default: module.History };
});

const Stats = lazy(async () => {
  const module = await import("@/pages/stats");
  return { default: module.Stats };
});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,_#f8f5ee_0%,_#eef3ea_100%)]">
      <div className="rounded-2xl border border-white/80 bg-white/90 px-6 py-5 text-sm font-medium text-slate-600 shadow-xl">
        Preparing the secure dashboard...
      </div>
    </div>
  );
}

function Router() {
  const { status } = useAdminSession();

  if (status === "checking") {
    return <LoadingScreen />;
  }

  if (status !== "authenticated") {
    return <Login />;
  }

  return (
    <Layout>
      <Suspense fallback={<LoadingScreen />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/history" component={History} />
          <Route path="/stats" component={Stats} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AdminSessionProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AdminSessionProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
