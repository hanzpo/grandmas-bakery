import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import "./index.css";
import { AdminLayout } from "./components/AdminLayout";
import { PublicLayout } from "./components/PublicLayout";
import Login from "./pages/admin/Login";
import Home from "./pages/Home";
import Order from "./pages/Order";
import OrderSuccess from "./pages/OrderSuccess";

// Admin pages are code-split so the public menu stays light.
const admin = (load: () => Promise<{ default: React.ComponentType }>) => () =>
  load().then((m) => ({ Component: m.default }));

const queryClient = new QueryClient({ defaultOptions: { queries: { staleTime: 30_000 } } });

const router = createBrowserRouter([
  {
    element: <PublicLayout />,
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
    children: [
      { index: true, lazy: admin(() => import("./pages/admin/Queue")) },
      { path: "orders", lazy: admin(() => import("./pages/admin/Orders")) },
      { path: "inventory", lazy: admin(() => import("./pages/admin/Inventory")) },
      { path: "menu", lazy: admin(() => import("./pages/admin/Menu")) },
      { path: "customers", lazy: admin(() => import("./pages/admin/Customers")) },
      { path: "marketing", lazy: admin(() => import("./pages/admin/Marketing")) },
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
