"use client";
import { useEffect, useRef, useState } from "react";
import { EventCard, type FeedEvent } from "./event-card";
import { glyphs } from "@/lib/design/glyphs";

const MAX_EVENTS = 500;
type ConnectionState = "connecting" | "live" | "error";

export function Feed() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [conn, setConn] = useState<ConnectionState>("connecting");
  const seen = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource("/api/feed");
    es.onopen = () => setConn("live");
    es.onerror = () => setConn("error");
    es.onmessage = (msg) => {
      try {
        const event = JSON.parse(msg.data) as FeedEvent;
        if (seen.current.has(event.id)) return;
        seen.current.add(event.id);
        setEvents((prev) => {
          const next = [event, ...prev];
          return next.length > MAX_EVENTS ? next.slice(0, MAX_EVENTS) : next;
        });
      } catch {
        // ignore malformed payloads
      }
    };
    return () => es.close();
  }, []);

  if (conn === "connecting" && events.length === 0) {
    return (
      <div className="text-muted py-12 text-center text-sm">
        <span className="animate-pulse">{glyphs.loadingFilled.repeat(5)}</span>
        <p className="mt-2">syncing feed</p>
      </div>
    );
  }

  if (events.length === 0) {
    return <p className="text-muted text-sm">no events yet · waiting for agents</p>;
  }

  return (
    <div className="space-y-2">
      {conn === "error" && (
        <p className="text-accent text-xs">feed disconnected · retrying...</p>
      )}
      {events.map((e) => (
        <div key={e.id} className="animate-[slide-in_200ms_ease-out]">
          <EventCard event={e} />
        </div>
      ))}
    </div>
  );
}
