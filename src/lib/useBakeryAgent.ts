import { useConversation } from "@elevenlabs/react";
import { useCallback, useEffect, useRef, useState } from "react";

export type AgentMode = "text" | "voice";
export type AgentMessage = { id: number; source: "user" | "ai"; message: string };

/**
 * The ElevenLabs agent that plays Grandma, as a text chat or a voice call.
 * Must be rendered inside `<ConversationProvider agentId=…>`.
 *
 * Typing starts a text-only session on the first message; "Talk" starts a WebRTC voice
 * session (asks for the microphone), ending the text session first if one is open.
 * Orders the agent places go through its `place_order` server tool → POST /api/voice/order.
 */
export function useBakeryAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [mode, setMode] = useState<AgentMode | null>(null);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const nextId = useRef(0);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  // Typed before the text session finished connecting.
  const queued = useRef<string[]>([]);
  // Set when "Talk" is pressed during a text session: start voice once it has closed.
  const voiceNext = useRef(false);

  const push = useCallback((source: AgentMessage["source"], message: string) => {
    setMessages((m) => [...m, { id: nextId.current++, source, message }]);
  }, []);

  const flushQueued = () => {
    if (!queued.current.length) return;
    queued.current.forEach((text) => conversation.sendUserMessage(text));
    queued.current = [];
    setThinking(true);
  };

  const conversation = useConversation({
    onMessage: ({ source, message }) => {
      // Typed messages are added locally; only voice transcripts come back from the agent.
      if (source === "user" && modeRef.current !== "voice") return;
      // Drop expressive voice tags like "[warmly]" from the transcript.
      const text = message.replace(/\[[a-z ]+\]\s*/gi, "").trim();
      if (text) push(source, text);
      if (source === "ai") {
        setThinking(false);
        // The agent greets first; send what was typed while connecting once it has.
        flushQueued();
      }
    },
    onDisconnect: () => {
      setThinking(false);
      if (voiceNext.current) {
        voiceNext.current = false;
        setMode("voice");
        conversation.startSession({ connectionType: "webrtc" });
      } else {
        setMode(null);
      }
    },
    onError: (message) => {
      console.error("Grandma agent:", message);
      setError(message);
      setThinking(false);
    },
  });
  const { status, isSpeaking, sendUserMessage, startSession, endSession } = conversation;
  const live = status === "connecting" || status === "connected";

  // Fallback for an agent without a first message: don't wait for a greeting forever.
  useEffect(() => {
    if (status !== "connected" || !queued.current.length) return;
    const timer = setTimeout(flushQueued, 2500);
    return () => clearTimeout(timer);
    // Re-arm only when the connection status changes.
  }, [status]);

  const sendText = useCallback(
    (text: string) => {
      setError(null);
      push("user", text);
      setThinking(true);
      if (status === "connected") return sendUserMessage(text);
      queued.current.push(text);
      if (!live) {
        setMode("text");
        startSession({ textOnly: true });
      }
    },
    [status, live, push, sendUserMessage, startSession],
  );

  const startVoice = useCallback(() => {
    setError(null);
    if (live) {
      voiceNext.current = true;
      endSession();
      return;
    }
    setMode("voice");
    startSession({ connectionType: "webrtc" });
  }, [live, startSession, endSession]);

  const endVoice = useCallback(() => {
    voiceNext.current = false;
    endSession();
  }, [endSession]);

  return {
    status,
    mode: live ? mode : null,
    isSpeaking,
    thinking,
    error,
    messages,
    sendText,
    startVoice,
    endVoice,
  };
}
