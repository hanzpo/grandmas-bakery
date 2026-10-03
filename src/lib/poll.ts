import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "./supabase";

/** Flavors Grandma is testing, with their vote counts. */
export function useFlavorPoll() {
  return useQuery({
    queryKey: ["flavor_poll"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_flavor_poll");
      if (error) throw error;
      return data;
    },
  });
}

export type PollCandidate = NonNullable<ReturnType<typeof useFlavorPoll>["data"]>[number];

const VOTED_KEY = "flavor-poll-voted";

function readVoted(): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(VOTED_KEY) ?? "[]");
    return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

/** Cast a vote; remembers voted flavors on this device so the button stays "You voted" after a reload. */
export function useVoteForFlavor() {
  const qc = useQueryClient();
  const [voted, setVoted] = useState<string[]>(readVoted);
  const vote = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.rpc("vote_for_flavor", { p_product_id: productId });
      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      setVoted((prev) => {
        const next = prev.includes(productId) ? prev : [...prev, productId];
        try {
          localStorage.setItem(VOTED_KEY, JSON.stringify(next));
        } catch {}
        return next;
      });
      return qc.invalidateQueries({ queryKey: ["flavor_poll"] });
    },
  });
  return { voted, vote };
}
