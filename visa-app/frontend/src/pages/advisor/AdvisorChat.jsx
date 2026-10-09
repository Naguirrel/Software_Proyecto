import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorSearch, AdvisorState } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";

const CHAT_POLL_INTERVAL_MS = 4_000;
const CONVERSATION_POLL_INTERVAL_MS = 10_000;
const CHAT_PAGE_SIZE = 50;

function initials(name) {
  return String(name || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
}

function mergeMessages(current, incoming) {
  const byId = new Map(current.map((message) => [message.id, message]));
  incoming.forEach((message) => byId.set(message.id, message));
  return [...byId.values()].sort((left, right) => Number(left.id) - Number(right.id));
}

export default function AdvisorChat() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreBefore, setHasMoreBefore] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);
  const latestMessageIdRef = useRef(null);
  const selectedUserId = selected?.userId || null;
  const latestMessageId = messages.at(-1)?.id || null;

  useEffect(() => {
    let active = true;
    let requestInFlight = false;
    const controllers = new Set();
    const loadConversations = async ({ initial = false } = {}) => {
      if (requestInFlight) return;
      requestInFlight = true;
      const controller = new AbortController();
      controllers.add(controller);
      try {
        const data = await advisorRequest("/conversations", { signal: controller.signal });
        if (!active) return;
        const items = data.conversations || [];
        setConversations(items);
        setSelected((current) => current
          ? items.find((item) => item.userId === current.userId) || null
          : items[0] || null);
        setError("");
      } catch (requestError) {
        if (active && requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        requestInFlight = false;
        controllers.delete(controller);
        if (active && initial) setLoading(false);
      }
    };
    loadConversations({ initial: true });
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "hidden") loadConversations();
    }, CONVERSATION_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      controllers.forEach((controller) => controller.abort());
    };
  }, []);

  useEffect(() => {
    latestMessageIdRef.current = latestMessageId;
    if (latestMessageId) endRef.current?.scrollIntoView?.({ behavior: "smooth" });
  }, [latestMessageId]);

  useEffect(() => {
    if (!selectedUserId) {
      setMessages([]);
      setHasMoreBefore(false);
      return undefined;
    }
    let active = true;
    let requestInFlight = false;
    const controllers = new Set();
    latestMessageIdRef.current = null;
    setMessages([]);
    setMessagesLoading(true);
    setError("");
    const loadMessages = async ({ afterId } = {}) => {
      if (requestInFlight) return;
      requestInFlight = true;
      const controller = new AbortController();
      controllers.add(controller);
      const search = new URLSearchParams({ limit: String(CHAT_PAGE_SIZE) });
      if (afterId) search.set("afterId", String(afterId));
      try {
        const data = await advisorRequest(`/conversations/${selectedUserId}/messages?${search}`, { signal: controller.signal });
        if (!active) return;
        setMessages((current) => afterId ? mergeMessages(current, data.messages || []) : data.messages || []);
        if (!afterId) setHasMoreBefore(Boolean(data.hasMoreBefore));
        setConversations((current) => current.map((item) => item.userId === selectedUserId ? { ...item, unreadCount: 0 } : item));
        setError("");
      } catch (requestError) {
        if (active && requestError.name !== "AbortError") setError(requestError.message);
      } finally {
        requestInFlight = false;
        controllers.delete(controller);
        if (active) setMessagesLoading(false);
      }
    };
    loadMessages();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState !== "hidden") loadMessages({ afterId: latestMessageIdRef.current });
    }, CHAT_POLL_INTERVAL_MS);
    return () => {
      active = false;
      window.clearInterval(intervalId);
      controllers.forEach((controller) => controller.abort());
    };
  }, [selectedUserId]);

  const visible = useMemo(
    () => conversations.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase())),
    [conversations, query],
  );

  const loadOlder = async () => {
    const firstId = messages[0]?.id;
    if (!firstId || !selectedUserId || loadingOlder) return;
    try {
      setLoadingOlder(true);
      setError("");
      const data = await advisorRequest(`/conversations/${selectedUserId}/messages?beforeId=${encodeURIComponent(firstId)}&limit=${CHAT_PAGE_SIZE}`);
      setMessages((current) => mergeMessages(data.messages || [], current));
      setHasMoreBefore(Boolean(data.hasMoreBefore));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoadingOlder(false);
    }
  };

  const send = async () => {
    const message = input.trim();
    if (!message || !selectedUserId || sending) return;
    try {
      setSending(true);
      setError("");
      const data = await advisorRequest(`/conversations/${selectedUserId}/messages`, {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      setMessages((current) => mergeMessages(current, [data.message]));
      setInput("");
      setConversations((current) => current.map((item) => item.userId === selectedUserId
        ? { ...item, lastMessage: data.message.message, lastMessageAt: data.message.createdAt }
        : item));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSending(false);
    }
  };

  return <AdvisorLayout><section className="advisor-chat">
    <aside className="advisor-chat__conversations">
      <h1>Mensajes</h1>
      <AdvisorSearch value={query} onChange={setQuery} placeholder="Buscar…" />
      <AdvisorState loading={loading} error={loading ? error : ""} empty={!loading && !visible.length} />
      {visible.map((item) => <button type="button" key={item.userId} className={selectedUserId === item.userId ? "is-active" : ""} onClick={() => setSelected(item)}>
        <span className="advisor-avatar">{initials(item.name)}</span>
        <span><strong>{item.name}</strong><small>{item.lastMessage}</small><em>{item.stage}</em></span>
        {item.unreadCount > 0 && <b>{item.unreadCount}</b>}
      </button>)}
    </aside>
    <section className="advisor-chat__thread">{selected ? <>
      <header><span className="advisor-avatar">{initials(selected.name)}</span><div><h2>{selected.name}</h2><p>{selected.profile} · {selected.stage} · actualización automática</p></div></header>
      <div className="advisor-chat__messages" role="log" aria-live="polite">
        <AdvisorState loading={messagesLoading} error={!messagesLoading ? error : ""} />
        {hasMoreBefore && <button type="button" className="advisor-chat__load-older" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? "Cargando…" : "Cargar mensajes anteriores"}</button>}
        {messages.map((message) => <article key={message.id} className={`advisor-chat-message advisor-chat-message--${message.sender}`}><p>{message.message}</p><time>{formatDate(message.createdAt, true)}</time></article>)}
        <div ref={endRef} />
      </div>
      <form className="advisor-chat__composer" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <textarea rows="2" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder={`Escribe a ${selected.name}…`} maxLength={4000} />
        <button type="submit" disabled={sending || !input.trim()} aria-label="Enviar mensaje"><Send aria-hidden="true" /></button>
      </form>
    </> : <p className="advisor-chat__placeholder">Selecciona una conversación.</p>}</section>
  </section></AdvisorLayout>;
}
