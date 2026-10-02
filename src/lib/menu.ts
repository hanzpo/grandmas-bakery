import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";

export function useMenu() {
  return useQuery({
    queryKey: ["menu"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_menu");
      if (error) throw error;
      return data;
    },
  });
}

export type MenuItem = NonNullable<ReturnType<typeof useMenu>["data"]>[number];
