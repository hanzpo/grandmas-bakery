import { createContext, useContext, useState } from "react";
import { Outlet } from "react-router";
import { I18nProvider } from "../i18n";
import { ChatWidget } from "./ChatWidget";

/** Cart count shared with the header badge. Home owns the cart and reports its size here. */
const CartCountContext = createContext<{ count: number; setCount: (n: number) => void }>({
  count: 0,
  setCount: () => {},
});
export const useCartCount = () => useContext(CartCountContext);

/** Wraps every route (public and admin) so the Grandma chat shows everywhere. */
export function RootLayout() {
  const [count, setCount] = useState(0);
  return (
    <I18nProvider>
      <CartCountContext.Provider value={{ count, setCount }}>
        <Outlet />
        <ChatWidget />
      </CartCountContext.Provider>
    </I18nProvider>
  );
}
