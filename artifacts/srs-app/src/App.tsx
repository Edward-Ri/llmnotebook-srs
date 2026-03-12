import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";

import { AuthProvider } from "@/contexts/AuthContext";
import { AppSidebar } from "@/components/app-sidebar";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Analyze from "@/pages/analyze";
import Validate from "@/pages/validate";
import Review from "@/pages/review";
import Analytics from "@/pages/analytics";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/analyze" component={Analyze} />
      <Route path="/validate" component={Validate} />
      <Route path="/review" component={Review} />
      <Route path="/analytics" component={Analytics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  const sidebarStyle = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "4rem",
  } as React.CSSProperties;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <SidebarProvider style={sidebarStyle}>
              <div className="flex h-screen w-full bg-background overflow-hidden">
                <AppSidebar />
                <div className="flex flex-col flex-1 relative">
                  <header className="md:hidden flex items-center p-4 border-b bg-background z-50">
                    <SidebarTrigger data-testid="button-sidebar-toggle" />
                    <span className="ml-4 font-bold">AI 记忆引擎</span>
                  </header>
                  <div className="hidden md:block absolute top-4 left-4 z-50">
                    <SidebarTrigger className="bg-background/80 backdrop-blur shadow-sm" data-testid="button-sidebar-toggle" />
                  </div>
                  <main className="flex-1 overflow-hidden relative">
                    <Router />
                  </main>
                </div>
              </div>
            </SidebarProvider>
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
