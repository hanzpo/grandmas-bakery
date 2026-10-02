import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { timeAgo } from "../../lib/format";
import { supabase, type Enums, type Tables } from "../../lib/supabase";

type Video = Tables<"ugc_videos">;

const IDEAS = [
  "A college student trying the strawberry parfait for the first time",
  "A mom grabbing parfaits for her kids after school",
  "Cozy fall morning with a pumpkin parfait and coffee",
];

const STATUS: Record<Enums<"ugc_video_status">, { label: string; tone: string }> = {
  queued: { label: "Waiting", tone: "bg-dough text-cinnamon" },
  generating: { label: "Making it…", tone: "bg-butter-soft text-butter-depth" },
  ready: { label: "Ready", tone: "bg-pistachio-soft text-pistachio-depth" },
  failed: { label: "Didn't work", tone: "bg-jam-soft text-jam-depth" },
};

export default function Marketing() {
  const queryClient = useQueryClient();
  const [brief, setBrief] = useState("");

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["ugc_videos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ugc_videos").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // The pipeline reports back through the Worker; pick up its updates live.
  useEffect(() => {
    const channel = supabase
      .channel("ugc-videos")
      .on("postgres_changes", { event: "*", schema: "public", table: "ugc_videos" }, () => {
        queryClient.invalidateQueries({ queryKey: ["ugc_videos"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const create = useMutation({
    mutationFn: async (text: string) => {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/ugc-videos", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token ?? ""}` },
        body: JSON.stringify({ brief: text }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok && body.error) throw new Error(body.error);
    },
    onSuccess: () => setBrief(""),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ugc_videos"] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ugc_videos").delete().eq("id", id);
      if (error) throw error;
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["ugc_videos"] }),
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (brief.trim()) create.mutate(brief.trim());
  }

  return (
    <div className="space-y-6">
      <header>
        <p className="eyebrow">Social videos</p>
        <h1 className="text-4xl font-black">Marketing</h1>
        <p className="mt-1 text-cinnamon">Describe a video in one sentence and we'll make it for you.</p>
      </header>

      <form onSubmit={submit} className="card space-y-4">
        <h2 className="text-xl font-extrabold">What should the video show?</h2>
        <label htmlFor="ugc-brief" className="label sr-only">Video idea</label>
        <textarea
          id="ugc-brief"
          className="input min-h-28 text-lg"
          placeholder="e.g. A teenager filming their first bite of the strawberry parfait"
          maxLength={500}
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <span className="self-center text-sm font-bold text-cinnamon">Need an idea?</span>
          {IDEAS.map((idea) => (
            <button key={idea} type="button" className="chip" onClick={() => setBrief(idea)}>
              {idea}
            </button>
          ))}
        </div>
        {create.isError && <p className="font-bold text-jam">{create.error.message}</p>}
        <button className="btn-primary w-full sm:w-auto" disabled={create.isPending || brief.trim().length < 3}>
          {create.isPending ? "Sending…" : "Make my video"}
        </button>
      </form>

      <section className="space-y-4">
        <h2 className="text-xl font-extrabold">Your videos</h2>
        {isLoading ? (
          <p className="text-cinnamon">Loading…</p>
        ) : videos.length === 0 ? (
          <p className="rounded-2xl bg-pistachio-soft p-5 font-bold text-pistachio-depth">
            No videos yet. Type an idea above to make your first one!
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {videos.map((v) => (
              <VideoCard key={v.id} video={v} onRemove={() => remove.mutate(v.id)} onRetry={() => create.mutate(v.brief)} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function VideoCard({ video, onRemove, onRetry }: { video: Video; onRemove: () => void; onRetry: () => void }) {
  const status = STATUS[video.status];
  return (
    <article className="card flex flex-col gap-3">
      <div className="grid aspect-[9/16] max-h-96 place-items-center overflow-hidden rounded-2xl bg-dough">
        {video.status === "ready" && video.video_url ? (
          <video
            src={video.video_url}
            poster={video.thumbnail_url ?? undefined}
            controls
            playsInline
            className="h-full w-full object-cover"
          />
        ) : (
          <p className="px-6 text-center font-extrabold text-cinnamon">
            {video.status === "failed" ? "😕" : "🎬"}
            <br />
            {video.status === "failed" ? video.error || "Something went wrong." : "This takes a few minutes. It'll show up here."}
          </p>
        )}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={`tag ${status.tone}`}>{status.label}</span>
        <span className="text-sm font-bold text-cinnamon">{timeAgo(video.created_at)}</span>
      </div>
      <p className="font-bold">{video.brief}</p>
      <div className="mt-auto flex flex-wrap gap-2">
        {video.status === "ready" && video.video_url && (
          <a className="btn-blue" href={video.video_url} download target="_blank" rel="noreferrer">
            Download
          </a>
        )}
        {video.status === "failed" && (
          <button className="btn-butter" onClick={onRetry}>
            Try again
          </button>
        )}
        <button
          className="btn-ghost"
          onClick={() => {
            if (confirm("Remove this video?")) onRemove();
          }}
        >
          Remove
        </button>
      </div>
    </article>
  );
}
