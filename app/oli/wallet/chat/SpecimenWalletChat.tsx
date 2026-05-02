"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

type ChatMessage = {
  id: string;
  sessionId: string | null;
  sender: "agent" | "user" | "system";
  kind: "status" | "question" | "approval_request" | "reply" | "report";
  content: string;
  intentId: string | null;
  ts: string;
};

const MAX_MESSAGES = 500;

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return "—";
  }
}

function shortSession(id: string | null): string {
  if (!id) return "system";
  return id.slice(0, 8);
}

export function SpecimenWalletChat({
  basePath,
  initialMessages,
}: {
  basePath: string;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [connected, setConnected] = useState(false);
  const seen = useRef<Set<string>>(new Set(initialMessages.map((m) => m.id)));
  const tailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const es = new EventSource("/api/wallet/chat/stream");
    es.onopen = () => setConnected(true);
    es.onmessage = (msg) => {
      try {
        const wire = JSON.parse(msg.data) as ChatMessage;
        if (seen.current.has(wire.id)) return;
        seen.current.add(wire.id);
        setMessages((prev) => {
          const next = [...prev, wire];
          return next.length > MAX_MESSAGES ? next.slice(-MAX_MESSAGES) : next;
        });
      } catch {
        // malformed payload — skip
      }
    };
    es.onerror = () => {
      setConnected(false);
      // EventSource auto-reconnects on transient errors.
    };
    return () => {
      es.close();
      setConnected(false);
    };
  }, []);

  // Auto-scroll to latest on new message.
  useEffect(() => {
    tailRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <>
      <section className="spec-page-header">
        <div className="spec-page-header-row">
          <h1 className="spec-page-title">
            <span>02</span>
            <span>Wallet · Chat</span>
          </h1>
          <div className="spec-switch" role="group" aria-label="Wallet sections">
            <Link className="spec-switch-seg" href={`${basePath}/dashboard`}>
              DASHBOARD
            </Link>
            <Link
              className="spec-switch-seg"
              href={`${basePath}/dashboard/pair`}
              title="Pair an agent so it can post here"
            >
              PAIR AGENT
            </Link>
            <span className="spec-switch-seg spec-switch-seg-active">CHAT</span>
          </div>
        </div>
        <div className="spec-page-subhead">
          <span className="spec-page-subhead-label">STATUS</span>
          <span>{connected ? "live · streaming" : "connecting…"}</span>
          <span className="spec-page-subhead-dot">·</span>
          <span className="spec-page-subhead-label">MESSAGES</span>
          <span>{messages.length}</span>
        </div>
      </section>

      <section className="spec-chat-pane" aria-label="Agent chat thread">
        {messages.length === 0 ? (
          <div className="spec-chat-empty">
            <span className="spec-chat-empty-label">no messages yet</span>
            <span className="spec-chat-empty-hint">
              pair an agent to start a thread. agents post status updates,
              approval requests, and reports here in real time.
            </span>
          </div>
        ) : (
          <ol className="spec-chat-list" role="log" aria-live="polite">
            {messages.map((m) => (
              <li
                key={m.id}
                className={`spec-chat-row spec-chat-row-${m.sender}`}
                data-kind={m.kind}
              >
                <span className="spec-chat-meta">
                  <span className="spec-chat-time">{formatTime(m.ts)}</span>
                  <span className="spec-chat-sep">·</span>
                  <span className="spec-chat-sender">
                    {m.sender === "agent"
                      ? `agent:${shortSession(m.sessionId)}`
                      : m.sender}
                  </span>
                  <span className="spec-chat-sep">·</span>
                  <span className={`spec-chat-kind spec-chat-kind-${m.kind}`}>
                    [{m.kind.replace("_", " ")}]
                  </span>
                </span>
                <span className="spec-chat-content">{m.content}</span>
              </li>
            ))}
          </ol>
        )}
        <div ref={tailRef} />
      </section>
    </>
  );
}
