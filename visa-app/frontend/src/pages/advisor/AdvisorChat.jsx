import { useEffect, useMemo, useRef, useState } from "react";
import { Send } from "lucide-react";
import AdvisorLayout from "../../components/advisor/AdvisorLayout";
import { AdvisorSearch, AdvisorState } from "../../components/advisor/AdvisorShared";
import { advisorRequest } from "../../utils/advisorApi";
import { formatAdvisorDate as formatDate } from "../../utils/advisorFormat";

function initials(name) { return String(name || "U").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase(); }

export default function AdvisorChat() {
  const [conversations, setConversations] = useState([]);
  const [selected, setSelected] = useState(null);
  const [messages, setMessages] = useState([]);
  const [query, setQuery] = useState("");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    const controller = new AbortController();
    advisorRequest("/conversations", { signal: controller.signal }).then((data) => {
      const items = data.conversations || []; setConversations(items); setSelected((current) => current || items[0] || null);
    }).catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selected) { setMessages([]); return undefined; }
    const controller = new AbortController(); setMessagesLoading(true); setError("");
    advisorRequest(`/conversations/${selected.userId}/messages`, { signal: controller.signal }).then((data) => {
      setMessages(data.messages || []); setConversations((current) => current.map((item) => item.userId === selected.userId ? { ...item, unreadCount: 0 } : item));
    }).catch((requestError) => { if (requestError.name !== "AbortError") setError(requestError.message); })
      .finally(() => { if (!controller.signal.aborted) setMessagesLoading(false); });
    return () => controller.abort();
  }, [selected]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const visible = useMemo(() => conversations.filter((item) => `${item.name} ${item.email}`.toLowerCase().includes(query.toLowerCase())), [conversations, query]);
  const send = async () => {
    const message = input.trim(); if (!message || !selected) return;
    try {
      setSending(true); setError("");
      const data = await advisorRequest(`/conversations/${selected.userId}/messages`, { method: "POST", body: JSON.stringify({ message }) });
      setMessages((current) => [...current, data.message]); setInput("");
      setConversations((current) => current.map((item) => item.userId === selected.userId ? { ...item, lastMessage: data.message.message, lastMessageAt: data.message.createdAt } : item));
    } catch (requestError) { setError(requestError.message); }
    finally { setSending(false); }
  };

  return <AdvisorLayout><section className="advisor-chat">
    <aside className="advisor-chat__conversations"><h1>Mensajes</h1><AdvisorSearch value={query} onChange={setQuery} placeholder="Buscar…" /><AdvisorState loading={loading} error={loading ? error : ""} empty={!loading && !visible.length} />{visible.map((item) => <button type="button" key={item.userId} className={selected?.userId === item.userId ? "is-active" : ""} onClick={() => setSelected(item)}><span className="advisor-avatar">{initials(item.name)}</span><span><strong>{item.name}</strong><small>{item.lastMessage}</small><em>{item.stage}</em></span>{item.unreadCount > 0 && <b>{item.unreadCount}</b>}</button>)}</aside>
    <section className="advisor-chat__thread">{selected ? <><header><span className="advisor-avatar">{initials(selected.name)}</span><div><h2>{selected.name}</h2><p>{selected.profile} · {selected.stage}</p></div></header><div className="advisor-chat__messages" role="log" aria-live="polite"><AdvisorState loading={messagesLoading} error={!messagesLoading ? error : ""} />{messages.map((message) => <article key={message.id} className={`advisor-chat-message advisor-chat-message--${message.sender}`}><p>{message.message}</p><time>{formatDate(message.createdAt, true)}</time></article>)}<div ref={endRef} /></div><form className="advisor-chat__composer" onSubmit={(event) => { event.preventDefault(); send(); }}><textarea rows="2" value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); send(); } }} placeholder="Escribe tu mensaje…" /><button type="submit" disabled={sending || !input.trim()} aria-label="Enviar mensaje"><Send aria-hidden="true" /></button></form></> : <p className="advisor-chat__placeholder">Selecciona una conversación.</p>}</section>
  </section></AdvisorLayout>;
}
