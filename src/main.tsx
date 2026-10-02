import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider, useRouteError } from "react-router";
import "./index.css";
import { AdminLayout } from "./components/AdminLayout";
import { PublicLayout } from "./components/PublicLayout";
import { RootLayout } from "./components/RootLayout";
import Login from "./pages/admin/Login";
import Home from "./pages/Home";
import Order from "./pages/Order";
import OrderSuccess from "./pages/OrderSuccess";

// Admin pages are code-split so the public menu stays light.
const admin = (load: () => Promise<{ default: React.ComponentType }>) => () =>
  load().then((m) => ({ Component: m.default }));

// A stale or re-bundled chunk fails to import: reload once instead of showing an error page.
function RouteError() {
  const error = useRouteError() as Error | undefined;
  const chunkError = /module script|dynamically imported module|Failed to fetch/i.test(error?.message ?? "");
  if (chunkError && !sessionStorage.getItem("reloaded")) {
    sessionStorage.setItem("reloaded", "1");
    location.reload();
    return null;
  }
  sessionStorage.removeItem("reloaded");
  return (
    <div className="mx-auto max-w-md p-10 text-center">
      <h1 className="text-2xl text-terracotta">Oops, something burned</h1>
      <p className="mt-2 text-muted">{error?.message}</p>
      <button className="btn-primary mt-6" onClick={() => location.reload()}>Try again</button>
    </div>
  );
}

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      {
        element: <PublicLayout />,
        errorElement: <RouteError />,
        children: [
          { path: "/", element: <Home /> },
          { path: "/order", element: <Order /> },
          { path: "/order/success", element: <OrderSuccess /> },
        ],
      },
      { path: "/admin/login", element: <Login /> },
      {
        path: "/admin",
        element: <AdminLayout />,
        errorElement: <RouteError />,
        children: [
          { index: true, lazy: admin(() => import("./pages/admin/Overview")) },
          { path: "queue", lazy: admin(() => import("./pages/admin/Queue")) },
          { path: "orders", lazy: admin(() => import("./pages/admin/Orders")) },
          { path: "inventory", lazy: admin(() => import("./pages/admin/Inventory")) },
          { path: "menu", lazy: admin(() => import("./pages/admin/Menu")) },
          { path: "customers", lazy: admin(() => import("./pages/admin/Customers")) },
          { path: "insights", lazy: admin(() => import("./pages/admin/Insights")) },
          { path: "marketing", lazy: admin(() => import("./pages/admin/Marketing")) },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);

// Allow another auto-reload later once this load has settled.
setTimeout(() => sessionStorage.removeItem("reloaded"), 10_000);
