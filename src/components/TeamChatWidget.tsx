import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  Send, 
  X, 
  Minus, 
  Trash2, 
  Clock, 
  Users, 
  Check
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  limit, 
  onSnapshot, 
  serverTimestamp,
  getDocs,
  deleteDoc,
  doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { supabase } from '../lib/supabase';
import { playAppSound } from '../lib/audio';

export interface TeamChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole?: string;
  text: string;
  timestamp: number;
  createdAt?: string;
}

interface TeamChatWidgetProps {
  currentUser: {
    id?: string;
    name?: string;
    displayName?: string;
    email?: string;
    role?: string;
  } | null;
  isAdmin?: boolean;
}

const STORAGE_CACHE_KEY = 'oxente_team_chat_messages_cache';
const STORAGE_LAST_READ_KEY = 'oxente_team_chat_last_read';

const QUICK_ACTIONS = [
  '📝 Anota os pedidos!',
  '🚗 Uber a caminho!',
  '🎨 Arte pronta!',
  '📦 Cliente no balcão!',
  '⚡ Pedido urgente!',
  '✅ Concluído!',
  '❓ Dúvida em pedido'
];

export function TeamChatWidget({ currentUser, isAdmin }: TeamChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<TeamChatMessage[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_CACHE_KEY);
      return cached ? JSON.parse(cached) : [];
    } catch {
      return [];
    }
  });
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<any>(null);

  const currentUserId = currentUser?.id || 'colaborador';
  const currentUserName = currentUser?.name || currentUser?.displayName || 'Colaborador';
  const currentUserRole = currentUser?.role || (isAdmin ? 'admin' : 'colaborador');

  // Auto-scroll to latest message
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Helper to merge and deduplicate messages
  const mergeMessages = (incoming: TeamChatMessage[]) => {
    setMessages((prev) => {
      const existingIds = new Set(prev.map((m) => m.id));
      const newItems = incoming.filter((m) => !existingIds.has(m.id));
      if (newItems.length === 0) return prev;
      const combined = [...prev, ...newItems].sort((a, b) => a.timestamp - b.timestamp);
      const trimmed = combined.slice(-120);
      try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(trimmed));
      } catch {}
      return trimmed;
    });
  };

  // 1. Multi-tab local sync via BroadcastChannel
  useEffect(() => {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      const channel = new BroadcastChannel('oxente_team_chat_channel');
      broadcastRef.current = channel;
      channel.onmessage = (event) => {
        if (event.data?.type === 'NEW_MESSAGE') {
          const newMsg = event.data.payload as TeamChatMessage;
          mergeMessages([newMsg]);
        } else if (event.data?.type === 'CLEAR_HISTORY') {
          setMessages([]);
          localStorage.removeItem(STORAGE_CACHE_KEY);
        }
      };
      return () => {
        channel.close();
      };
    }
  }, []);

  // 2. Supabase Realtime synchronization (Works between all devices, networks, and browsers)
  useEffect(() => {
    let active = true;
    let reconnectTimer: any = null;

    // Load initial message history from Supabase
    const loadSupabaseHistory = async () => {
      try {
        // First check dedicated table oxente_team_messages
        const { data: tableData, error: tableErr } = await supabase
          .from('oxente_team_messages')
          .select('*')
          .order('timestamp', { ascending: true })
          .limit(100);

        if (!tableErr && tableData && tableData.length > 0) {
          const mapped: TeamChatMessage[] = tableData.map((row: any) => ({
            id: row.id,
            senderId: row.sender_id || row.senderId,
            senderName: row.sender_name || row.senderName,
            senderRole: row.sender_role || row.senderRole,
            text: row.text,
            timestamp: Number(row.timestamp),
            createdAt: row.created_at || row.createdAt
          }));
          mergeMessages(mapped);
          return;
        }

        // Fallback to oxente_store_info record 'team_chat_history' (works out-of-the-box in Supabase)
        const { data: storeData } = await supabase
          .from('oxente_store_info')
          .select('whatsapp_template')
          .eq('key', 'team_chat_history')
          .maybeSingle();

        if (storeData?.whatsapp_template) {
          try {
            const parsed = JSON.parse(storeData.whatsapp_template);
            if (Array.isArray(parsed) && parsed.length > 0) {
              mergeMessages(parsed);
            }
          } catch {}
        }
      } catch (err) {
        console.warn('Erro ao carregar histórico do chat no Supabase:', err);
      }
    };

    loadSupabaseHistory();

    const connectSupabaseChannel = () => {
      if (!active) return;
      if (supabaseChannelRef.current) {
        try { supabase.removeChannel(supabaseChannelRef.current); } catch {}
      }

      const channelId = `oxente_team_chat_room_${Math.random().toString(36).substring(2, 8)}`;
      const channel = supabase.channel(channelId, {
        config: {
          broadcast: { ack: true }
        }
      });
      supabaseChannelRef.current = channel;

      channel
        .on('broadcast', { event: 'new_message' }, ({ payload }) => {
          if (!payload || !payload.id) return;
          const incomingMsg = payload as TeamChatMessage;
          mergeMessages([incomingMsg]);

          const lastRead = Number(localStorage.getItem(STORAGE_LAST_READ_KEY) || '0');
          if (!isOpen && incomingMsg.senderId !== currentUserId && incomingMsg.timestamp > lastRead) {
            setUnreadCount((c) => c + 1);
            playAppSound('alert');
          }
        })
        .on('broadcast', { event: 'clear_chat' }, () => {
          setMessages([]);
          localStorage.removeItem(STORAGE_CACHE_KEY);
          setUnreadCount(0);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_store_info', filter: 'key=eq.team_chat_history' }, (changePayload: any) => {
          const raw = changePayload.new?.whatsapp_template;
          if (raw) {
            try {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                mergeMessages(list);
              }
            } catch {}
          }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'oxente_team_messages' }, (changePayload: any) => {
          const row = changePayload.new;
          if (row) {
            const incoming: TeamChatMessage = {
              id: row.id,
              senderId: row.sender_id || row.senderId,
              senderName: row.sender_name || row.senderName,
              senderRole: row.sender_role || row.senderRole,
              text: row.text,
              timestamp: Number(row.timestamp),
              createdAt: row.created_at || row.createdAt
            };
            mergeMessages([incoming]);
          }
        })
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') {
            setIsConnected(true);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setIsConnected(false);
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(() => {
              if (active) connectSupabaseChannel();
            }, 3000);
          }
        });
    };

    connectSupabaseChannel();

    return () => {
      active = false;
      clearTimeout(reconnectTimer);
      if (supabaseChannelRef.current) {
        try { supabase.removeChannel(supabaseChannelRef.current); } catch {}
      }
    };
  }, [currentUserId, isOpen]);

  // 3. Fallback/Redundancy: Listen to Firestore real-time messages if active
  useEffect(() => {
    let unsubscribe = () => {};

    try {
      if (db) {
        const messagesRef = collection(db, 'oxente_team_messages');
        const q = query(messagesRef, orderBy('timestamp', 'asc'), limit(80));

        unsubscribe = onSnapshot(
          q,
          (snapshot) => {
            const loaded: TeamChatMessage[] = [];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              loaded.push({
                id: docSnap.id,
                senderId: data.senderId || 'desconhecido',
                senderName: data.senderName || 'Colaborador',
                senderRole: data.senderRole || 'colaborador',
                text: data.text || '',
                timestamp: data.timestamp || Date.now(),
                createdAt: data.createdAt || new Date().toISOString()
              });
            });

            if (loaded.length > 0) {
              mergeMessages(loaded);
            }
          },
          (error) => {
            console.warn('Firestore fallback chat note:', error.message);
          }
        );
      }
    } catch (err) {
      console.warn('Falha no listener Firestore:', err);
    }

    return () => unsubscribe();
  }, []);

  // When opening the chat, clear unread count and record last read
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      const now = Date.now();
      localStorage.setItem(STORAGE_LAST_READ_KEY, String(now));
      setTimeout(() => {
        scrollToBottom('auto');
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Scroll to bottom when messages change and chat is open
  useEffect(() => {
    if (isOpen) {
      scrollToBottom('smooth');
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInputText('');

    const now = Date.now();
    const tempId = `msg_${now}_${Math.random().toString(36).substr(2, 9)}`;

    const newMsg: TeamChatMessage = {
      id: tempId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      text,
      timestamp: now,
      createdAt: new Date().toISOString()
    };

    // 1. Optimistic UI update
    setMessages((prev) => {
      const updated = [...prev, newMsg];
      try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(updated.slice(-120)));
      } catch {}
      return updated;
    });

    // 2. Broadcast immediately to same-machine browser tabs
    broadcastRef.current?.postMessage({
      type: 'NEW_MESSAGE',
      payload: newMsg
    });

    playAppSound('pop');
    localStorage.setItem(STORAGE_LAST_READ_KEY, String(now));

    // 3. Send Supabase Realtime Broadcast across all employee computers and phones!
    if (supabaseChannelRef.current) {
      try {
        await supabaseChannelRef.current.send({
          type: 'broadcast',
          event: 'new_message',
          payload: newMsg
        });
      } catch (e) {
        console.warn('Aviso: falha ao enviar broadcast Supabase:', e);
      }
    }

    // 4. Persist to Supabase Database (First try oxente_team_messages, always update oxente_store_info)
    try {
      // Background attempt into dedicated table
      supabase.from('oxente_team_messages').insert({
        id: newMsg.id,
        sender_id: newMsg.senderId,
        sender_name: newMsg.senderName,
        sender_role: newMsg.senderRole,
        text: newMsg.text,
        timestamp: newMsg.timestamp,
        created_at: newMsg.createdAt
      }).then(() => {}).catch(() => {});

      // Guaranteed fallback storage in oxente_store_info
      const currentList = [...messages, newMsg].slice(-100);
      await supabase.from('oxente_store_info').upsert({
        key: 'team_chat_history',
        nome: 'Chat Equipe',
        whatsapp_template: JSON.stringify(currentList),
        updated_at: new Date().toISOString()
      });
    } catch (supaErr) {
      console.warn('Aviso de persistência Supabase:', supaErr);
    }

    // 5. Redundant backup write to Firestore
    try {
      if (db) {
        const messagesRef = collection(db, 'oxente_team_messages');
        await addDoc(messagesRef, {
          senderId: currentUserId,
          senderName: currentUserName,
          senderRole: currentUserRole,
          text,
          timestamp: now,
          createdAt: new Date().toISOString(),
          serverTime: serverTimestamp()
        });
      }
    } catch (fbErr) {
      // Non-blocking Firestore error
    } finally {
      setIsSending(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  };

  const handleClearHistory = async () => {
    if (!isAdmin) return;
    if (!window.confirm('Deseja realmente limpar as mensagens do chat da equipe?')) return;

    try {
      setMessages([]);
      localStorage.removeItem(STORAGE_CACHE_KEY);

      // 1. Broadcast clear event to all staff in real time
      if (supabaseChannelRef.current) {
        try {
          await supabaseChannelRef.current.send({
            type: 'broadcast',
            event: 'clear_chat'
          });
        } catch {}
      }

      broadcastRef.current?.postMessage({ type: 'CLEAR_HISTORY' });

      // 2. Clear from Supabase
      await supabase.from('oxente_store_info').upsert({
        key: 'team_chat_history',
        nome: 'Chat Equipe',
        whatsapp_template: '[]',
        updated_at: new Date().toISOString()
      });
      await supabase.from('oxente_team_messages').delete().neq('id', '00000000');

      // 3. Clear from Firestore
      if (db) {
        const messagesRef = collection(db, 'oxente_team_messages');
        const snap = await getDocs(messagesRef);
        const deletePromises = snap.docs.map((docSnap) => deleteDoc(doc(db, 'oxente_team_messages', docSnap.id)));
        await Promise.all(deletePromises);
      }

      playAppSound('trash');
    } catch (e) {
      console.error('Erro ao limpar histórico do chat:', e);
    }
  };

  const formatMessageTime = (timestamp: number) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  const getSenderColor = (name: string, isSelf: boolean) => {
    if (isSelf) return 'text-white';
    const lower = name.toLowerCase();
    if (lower.includes('abraão') || lower.includes('abraao')) return 'text-amber-400';
    if (lower.includes('ana clara') || lower.includes('anaclara')) return 'text-pink-400';
    if (lower.includes('juan')) return 'text-emerald-400';
    if (lower.includes('assis')) return 'text-sky-400';
    return 'text-violet-400';
  };

  return (
    <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-auto">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-[92vw] sm:w-[380px] h-[520px] max-h-[82vh] bg-zinc-950 border border-zinc-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3.5 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="px-4 py-3.5 bg-zinc-900/95 border-b border-zinc-800/80 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
                    <MessageSquare className="h-4 w-4" />
                  </div>
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs font-bold text-white tracking-wide truncate">Chat da Equipe</h3>
                    <span className="text-[10px] bg-emerald-950 text-emerald-300 border border-emerald-800/60 px-1.5 py-0.2 rounded-full font-medium">
                      Online
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 truncate">
                    Você: <strong className="text-zinc-200">{currentUserName}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isAdmin && messages.length > 0 && (
                  <button
                    type="button"
                    onClick={handleClearHistory}
                    title="Limpar histórico (Admin)"
                    className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  title="Minimizar chat"
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                  <Minus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-zinc-950/60">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-6 text-zinc-500">
                  <div className="w-12 h-12 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-3 text-zinc-400">
                    <MessageSquare className="h-6 w-6 text-brand-pink/60" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-300">Nenhuma mensagem ainda</p>
                  <p className="text-[11px] text-zinc-500 mt-1 max-w-[220px]">
                    Envie um recado para a equipe ou use um dos atalhos rápidos abaixo!
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isSelf = msg.senderId === currentUserId;
                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                    >
                      {!isSelf && (
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className={`text-[11px] font-bold ${getSenderColor(msg.senderName, false)}`}>
                            {msg.senderName}
                          </span>
                          {msg.senderRole === 'admin' && (
                            <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-800/50 px-1 rounded font-semibold">
                              Admin
                            </span>
                          )}
                        </div>
                      )}

                      <div
                        className={`max-w-[82%] px-3.5 py-2.5 rounded-2xl text-xs break-words shadow-xs ${
                          isSelf
                            ? 'bg-brand-pink text-white rounded-tr-none font-medium'
                            : 'bg-zinc-850 border border-zinc-750 text-zinc-100 rounded-tl-none'
                        }`}
                      >
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                            isSelf ? 'text-pink-100/70' : 'text-zinc-500'
                          }`}
                        >
                          <span>{formatMessageTime(msg.timestamp)}</span>
                          {isSelf && <Check className="h-2.5 w-2.5 opacity-80" />}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Quick Action Chips */}
            <div className="px-3 py-1.5 bg-zinc-900/60 border-t border-zinc-850 overflow-x-auto flex items-center gap-1.5 no-scrollbar shrink-0">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleSendMessage(action)}
                  className={`shrink-0 text-[10px] font-medium px-2.5 py-1 rounded-full border transition-colors cursor-pointer ${
                    i === 0
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 hover:bg-orange-500/30'
                      : i === 1
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30'
                      : 'bg-zinc-800 hover:bg-zinc-750 text-zinc-300 hover:text-white border-zinc-700/60'
                  }`}
                >
                  {action}
                </button>
              ))}
            </div>

            {/* Input Footer */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-2.5 bg-zinc-900/95 border-t border-zinc-800/80 flex items-center gap-2 shrink-0"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Escreva para a equipe..."
                className="flex-1 bg-black border border-zinc-750 rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500 transition-all"
                disabled={isSending}
              />
              <button
                type="submit"
                disabled={!inputText.trim() || isSending}
                className={`p-2 rounded-xl transition-all flex items-center justify-center ${
                  inputText.trim() && !isSending
                    ? 'bg-orange-500 text-white hover:bg-orange-600 cursor-pointer shadow-sm shadow-orange-500/30 active:scale-95'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
                title="Enviar mensagem"
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Trigger Button */}
      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`relative flex items-center gap-2 px-3.5 py-2.5 rounded-full font-sans font-semibold text-xs transition-all shadow-xl cursor-pointer ${
          isOpen
            ? 'bg-zinc-850 text-orange-400 border border-orange-500/40'
            : unreadCount > 0
            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-orange-500/50 ring-2 ring-orange-400 animate-bounce'
            : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-100 border border-orange-500/40 hover:border-orange-500/80 shadow-black/60 shadow-lg'
        }`}
        title={isOpen ? 'Minimizar Chat da Equipe' : 'Abrir Chat da Equipe'}
      >
        <div className="relative">
          <div className="p-1 rounded-full bg-orange-500/20 text-orange-400">
            <MessageSquare className="h-4 w-4" />
          </div>
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-red-600 text-white text-[10px] font-extrabold rounded-full flex items-center justify-center border-2 border-zinc-950 animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className="hidden sm:inline font-semibold text-zinc-100">Chat Equipe</span>
        {unreadCount > 0 && !isOpen && (
          <span className="sm:hidden text-[11px] font-bold text-white">
            ({unreadCount})
          </span>
        )}
      </motion.button>
    </div>
  );
}
