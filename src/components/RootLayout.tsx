import { createContext, useContext, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { I18nProvider } from "../i18n";
import { ChatWidget } from "./ChatWidget";

/** Cart count shared with the header badge. Home owns the cart and reports its size here. */
const CartCountContext = createContext<{ count: number; setCount: (n: number) => void }>({
  count: 0,
  setCount: () => {},
});
export const useCartCount = () => useContext(CartCountContext);

/** Wraps every route (public and admin). The Grandma chat is for customers, so admin pages skip it. */
export function RootLayout() {
  const [count, setCount] = useState(0);
  const isAdmin = useLocation().pathname.startsWith("/admin");
  return (
    <I18nProvider>
      <CartCountContext.Provider value={{ count, setCount }}>
        <Outlet />
        {!isAdmin && <ChatWidget />}
      </CartCountContext.Provider>
    </I18nProvider>
  );
}
