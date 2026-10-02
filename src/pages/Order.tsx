import { useEffect } from "react";
import Home from "./Home";

/** /order is the same page as Home, scrolled to the menu. */
export default function Order() {
  useEffect(() => {
    document.getElementById("menu")?.scrollIntoView();
  }, []);
  return <Home />;
}
