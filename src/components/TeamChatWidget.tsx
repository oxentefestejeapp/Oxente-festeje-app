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
  Check,
  Bell,
  Crown,
  Car,
  ClipboardList
} from 'lucide-react';
import { UberAlertOverlay, UberAlertData } from './UberAlertOverlay';
import { OrderAlertOverlay, OrderAlertData } from './OrderAlertOverlay';
import { 
  collection, 
  setDoc,
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

interface MessageAlert {
  id: string;
  senderName: string;
  senderRole?: string;
  senderId?: string;
  text: string;
  timestamp: number;
}

const STORAGE_CACHE_KEY = 'oxente_team_chat_messages_cache';
const STORAGE_LAST_READ_KEY = 'oxente_team_chat_last_read';

export const isUberAlertText = (text: string): boolean => {
  if (!text) return false;
  const clean = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    clean.includes('uber a caminho') ||
    clean.includes('uber a caminho!') ||
    (clean.includes('uber') && (clean.includes('caminho') || clean.includes('chegando') || clean.includes('porta') || clean.includes('espera') || clean.includes('retirar')))
  );
};

export const isOrderAlertText = (text: string): boolean => {
  if (!text) return false;
  const clean = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return (
    clean.includes('anota os pedidos') ||
    clean.includes('anotar os pedidos') ||
    clean.includes('anotar pedidos') ||
    clean.includes('anota pedidos') ||
    clean.includes('anotem os pedidos') ||
    clean.includes('anotar pedido') ||
    clean.includes('anota o pedido')
  );
};

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

  // Determine if current logged in user is Abraão / Administrator
  const isUserAdmin = Boolean(
    isAdmin || 
    currentUser?.role === 'admin' || 
    currentUser?.id === 'abraaoapp' ||
    currentUser?.email === 'oxentefesteje@gmail.com' || 
    currentUser?.email === 'abraaoapp@oxente.com' || 
    (currentUser?.name && (currentUser.name.toLowerCase().includes('abra') || currentUser.name.toLowerCase().includes('admin'))) ||
    (currentUser?.displayName && (currentUser.displayName.toLowerCase().includes('abra') || currentUser.displayName.toLowerCase().includes('admin')))
  );

  const currentUserId = isUserAdmin ? 'abraaoapp' : (currentUser?.id || 'colaborador');
  const currentUserName = isUserAdmin ? 'Abraão Administrador' : (currentUser?.name || currentUser?.displayName || 'Colaborador');
  const currentUserRole = isUserAdmin ? 'admin' : (currentUser?.role || 'colaborador');

  // Check if any message is authored by the admin (Abraão)
  const isMessageFromAdmin = (senderName?: string, senderRole?: string, senderId?: string) => {
    const sName = (senderName || '').toLowerCase();
    const sId = (senderId || '').toLowerCase();
    return (
      senderRole === 'admin' ||
      sId === 'abraaoapp' ||
      sId === 'admin' ||
      sName.includes('abraão') ||
      sName.includes('abraao') ||
      sName.includes('admin')
    );
  };

  const getSenderDisplayName = (senderName: string, senderRole?: string, senderId?: string) => {
    if (isMessageFromAdmin(senderName, senderRole, senderId)) {
      return 'Abraão Administrador';
    }
    return senderName || 'Colaborador';
  };

  // Check if two message records are the same to prevent duplicates
  const isSameChatMessage = (a: TeamChatMessage, b: TeamChatMessage): boolean => {
    if (!a || !b) return false;
    if (a.id && b.id && a.id === b.id) return true;

    const textA = (a.text || '').trim().toLowerCase();
    const textB = (b.text || '').trim().toLowerCase();
    if (!textA || !textB || textA !== textB) return false;

    const aIsAdmin = isMessageFromAdmin(a.senderName, a.senderRole, a.senderId);
    const bIsAdmin = isMessageFromAdmin(b.senderName, b.senderRole, b.senderId);
    const sameAdmin = aIsAdmin && bIsAdmin;

    const sameSender =
      sameAdmin ||
      (a.senderId && b.senderId && a.senderId === b.senderId) ||
      (a.senderName && b.senderName && a.senderName.trim().toLowerCase() === b.senderName.trim().toLowerCase());

    const timeDiff = Math.abs((a.timestamp || 0) - (b.timestamp || 0));
    return Boolean(sameSender && timeDiff < 8000);
  };

  // Sanitize initial cached messages against duplicates
  const [messages, setMessages] = useState<TeamChatMessage[]>(() => {
    try {
      const cached = localStorage.getItem(STORAGE_CACHE_KEY);
      if (!cached) return [];
      const parsed = JSON.parse(cached);
      if (!Array.isArray(parsed)) return [];
      const cleaned: TeamChatMessage[] = [];
      for (const item of parsed) {
        if (!item || !item.text) continue;
        if (!cleaned.some((c) => isSameChatMessage(c, item))) {
          cleaned.push(item);
        }
      }
      return cleaned;
    } catch {
      return [];
    }
  });

  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isConnected, setIsConnected] = useState(true);
  const [incomingAlert, setIncomingAlert] = useState<MessageAlert | null>(null);
  const [uberAlertData, setUberAlertData] = useState<UberAlertData | null>(null);
  const [orderAlertData, setOrderAlertData] = useState<OrderAlertData | null>(null);
  const [isConfirmingClear, setIsConfirmingClear] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);
  const supabaseChannelRef = useRef<any>(null);
  const lastSentMsgIdRef = useRef<string>('');
  const alertTimerRef = useRef<any>(null);

  // Auto-scroll to latest message
  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  // Helper to trigger alert when a new message arrives with chat minimized
  const triggerIncomingMessageAlert = (msg: TeamChatMessage) => {
    // If chat is currently open, no floating alert needed
    if (isOpen) return;

    // Check if message is authored by the current user (don't alert own messages)
    const isSelf = 
      msg.senderId === currentUserId || 
      (isUserAdmin && isMessageFromAdmin(msg.senderName, msg.senderRole, msg.senderId));
    if (isSelf) return;

    // Increase unread count
    setUnreadCount((prev) => prev + 1);

    // Play audible alert sound
    playAppSound('alert');

    // Create toast alert payload
    const displayName = getSenderDisplayName(msg.senderName, msg.senderRole, msg.senderId);
    const alertData: MessageAlert = {
      id: msg.id,
      senderName: displayName,
      senderRole: msg.senderRole,
      senderId: msg.senderId,
      text: msg.text,
      timestamp: msg.timestamp
    };

    setIncomingAlert(alertData);

    // Auto-dismiss after 8.5 seconds
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current);
    alertTimerRef.current = setTimeout(() => {
      setIncomingAlert(null);
    }, 8500);

    // Flash browser tab title to alert the user even if they are in another tab
    if (typeof document !== 'undefined') {
      const originalTitle = document.title;
      let count = 0;
      const interval = setInterval(() => {
        count++;
        document.title = count % 2 === 1 
          ? `💬 [Nova Mensagem] ${displayName}` 
          : originalTitle;
        if (count >= 10 || isOpen) {
          clearInterval(interval);
          document.title = originalTitle;
        }
      }, 1200);
    }
  };

  // Helper to trigger Uber high-urgency fullscreen alert for staff/collaborators
  const triggerUberAlert = (msg: TeamChatMessage) => {
    const isSelf = 
      msg.senderId === currentUserId || 
      (isUserAdmin && isMessageFromAdmin(msg.senderName, msg.senderRole, msg.senderId));
    if (isSelf) return;

    const displayName = getSenderDisplayName(msg.senderName, msg.senderRole, msg.senderId);
    setUberAlertData({
      id: msg.id,
      senderName: displayName,
      senderRole: msg.senderRole,
      text: msg.text,
      timestamp: msg.timestamp
    });
  };

  // Helper to trigger Orders fullscreen alert for staff/collaborators
  const triggerOrderAlert = (msg: TeamChatMessage) => {
    const isSelf = 
      msg.senderId === currentUserId || 
      (isUserAdmin && isMessageFromAdmin(msg.senderName, msg.senderRole, msg.senderId));
    if (isSelf) return;

    const displayName = getSenderDisplayName(msg.senderName, msg.senderRole, msg.senderId);
    setOrderAlertData({
      id: msg.id,
      senderName: displayName,
      senderRole: msg.senderRole,
      text: msg.text,
      timestamp: msg.timestamp
    });
  };

  // Helper to merge and strictly deduplicate messages
  const mergeMessages = (incoming: TeamChatMessage[], shouldAlert = false) => {
    if (!incoming || incoming.length === 0) return;

    setMessages((prev) => {
      // 1. Clean existing array of any duplicates
      const uniqueList: TeamChatMessage[] = [];
      for (const item of prev) {
        if (!item || !item.text) continue;
        if (!uniqueList.some((u) => isSameChatMessage(u, item))) {
          uniqueList.push(item);
        }
      }

      let hasNew = false;
      const newItemsToAlert: TeamChatMessage[] = [];

      for (const inc of incoming) {
        if (!inc || !inc.text) continue;
        const matchIdx = uniqueList.findIndex((u) => isSameChatMessage(u, inc));
        if (matchIdx === -1) {
          uniqueList.push(inc);
          hasNew = true;
          newItemsToAlert.push(inc);
        } else {
          // If match found, update with any more complete id (e.g. from database)
          if (inc.id && !inc.id.startsWith('msg_local_')) {
            uniqueList[matchIdx] = { ...uniqueList[matchIdx], ...inc };
          }
        }
      }

      if (!hasNew && uniqueList.length === prev.length) {
        return prev;
      }

      // If there are brand new items and alert is allowed, trigger alert for the latest one
      if (shouldAlert && newItemsToAlert.length > 0) {
        const latest = newItemsToAlert[newItemsToAlert.length - 1];
        if (isUberAlertText(latest.text)) {
          triggerUberAlert(latest);
        } else if (isOrderAlertText(latest.text)) {
          triggerOrderAlert(latest);
        }
        triggerIncomingMessageAlert(latest);
      }

      const sorted = uniqueList.sort((a, b) => a.timestamp - b.timestamp).slice(-120);
      try {
        localStorage.setItem(STORAGE_CACHE_KEY, JSON.stringify(sorted));
      } catch {}
      return sorted;
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
          if (newMsg && newMsg.id !== lastSentMsgIdRef.current) {
            mergeMessages([newMsg], true);
          }
        } else if (event.data?.type === 'CLEAR_HISTORY') {
          setMessages([]);
          setUnreadCount(0);
          setIncomingAlert(null);
          localStorage.removeItem(STORAGE_CACHE_KEY);
        }
      };
      return () => {
        channel.close();
      };
    }
  }, [isOpen, currentUserId, isUserAdmin]);

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
          mergeMessages(mapped, false);
          return;
        }

        // Fallback to oxente_store_info record 'team_chat_history'
        const { data: storeData } = await supabase
          .from('oxente_store_info')
          .select('whatsapp_template')
          .eq('key', 'team_chat_history')
          .maybeSingle();

        if (storeData?.whatsapp_template) {
          try {
            const parsed = JSON.parse(storeData.whatsapp_template);
            if (Array.isArray(parsed) && parsed.length > 0) {
              mergeMessages(parsed, false);
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

      const channelId = 'oxente_team_chat_global_room';
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
          // Ignore echo if we just sent this exact message
          if (incomingMsg.id === lastSentMsgIdRef.current) return;
          mergeMessages([incomingMsg], true);
        })
        .on('broadcast', { event: 'clear_chat' }, () => {
          setMessages([]);
          localStorage.removeItem(STORAGE_CACHE_KEY);
          setUnreadCount(0);
          setIncomingAlert(null);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'oxente_store_info', filter: 'key=eq.team_chat_history' }, (changePayload: any) => {
          const raw = changePayload.new?.whatsapp_template;
          if (raw) {
            try {
              const list = JSON.parse(raw);
              if (Array.isArray(list)) {
                if (list.length === 0) {
                  setMessages([]);
                  localStorage.removeItem(STORAGE_CACHE_KEY);
                  setUnreadCount(0);
                  setIncomingAlert(null);
                } else {
                  mergeMessages(list, true);
                }
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
            if (incoming.id !== lastSentMsgIdRef.current) {
              mergeMessages([incoming], true);
            }
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
  }, [currentUserId, isOpen, isUserAdmin]);

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
              // Only alert if there are messages newer than last read
              const lastRead = Number(localStorage.getItem(STORAGE_LAST_READ_KEY) || '0');
              const hasNewer = loaded.some(m => m.timestamp > lastRead && m.senderId !== currentUserId);
              mergeMessages(loaded, hasNewer);
            } else if (snapshot.empty) {
              setMessages([]);
              localStorage.removeItem(STORAGE_CACHE_KEY);
              setUnreadCount(0);
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
  }, [currentUserId]);

  // When opening the chat, clear unread count and dismiss alert
  useEffect(() => {
    if (isOpen) {
      setUnreadCount(0);
      setIncomingAlert(null);
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
    // Unique deterministic ID to prevent duplication across broadcasts and databases
    const stableId = `msg_${now}_${currentUserId}_${Math.random().toString(36).substring(2, 7)}`;
    lastSentMsgIdRef.current = stableId;

    const newMsg: TeamChatMessage = {
      id: stableId,
      senderId: currentUserId,
      senderName: currentUserName,
      senderRole: currentUserRole,
      text,
      timestamp: now,
      createdAt: new Date().toISOString()
    };

    // 1. Optimistic UI update via mergeMessages (automatically avoids duplication)
    mergeMessages([newMsg], false);

    // 2. Broadcast immediately to same-machine browser tabs
    broadcastRef.current?.postMessage({
      type: 'NEW_MESSAGE',
      payload: newMsg
    });

    playAppSound('pop');
    localStorage.setItem(STORAGE_LAST_READ_KEY, String(now));

    // 3. Send Supabase Realtime Broadcast across all employee computers and phones
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

    // 4. Persist to Supabase Database
    try {
      // Dedicated table
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

    // 5. Redundant backup write to Firestore with setDoc (Exact ID match prevents duplication!)
    try {
      if (db) {
        await setDoc(doc(db, 'oxente_team_messages', newMsg.id), {
          id: newMsg.id,
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
    if (!isUserAdmin) return;
    setIsConfirmingClear(false);

    try {
      // 1. Instantly clear local state for instantaneous user feedback
      setMessages([]);
      setUnreadCount(0);
      setIncomingAlert(null);
      localStorage.removeItem(STORAGE_CACHE_KEY);
      localStorage.setItem('oxente_team_chat_cleared_at', Date.now().toString());

      // 2. Play sound feedback
      playAppSound('trash');

      // 3. Multi-tab local broadcast
      try {
        broadcastRef.current?.postMessage({ type: 'CLEAR_HISTORY' });
      } catch {}

      // 4. Supabase broadcast to all connected team members
      if (supabaseChannelRef.current) {
        try {
          await supabaseChannelRef.current.send({
            type: 'broadcast',
            event: 'clear_chat'
          });
        } catch {}
      }

      // 5. Clear Supabase persistent store
      try {
        await supabase.from('oxente_store_info').upsert({
          key: 'team_chat_history',
          nome: 'Chat Equipe',
          whatsapp_template: '[]',
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Erro ao atualizar store_info:', err);
      }

      try {
        await supabase.from('oxente_team_messages').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      } catch (err) {
        console.warn('Erro ao deletar da tabela oxente_team_messages:', err);
      }

      // 6. Clear from Firestore
      if (db) {
        try {
          const messagesRef = collection(db, 'oxente_team_messages');
          const snap = await getDocs(messagesRef);
          const deletePromises = snap.docs.map((docSnap) => deleteDoc(doc(db, 'oxente_team_messages', docSnap.id)));
          await Promise.all(deletePromises);
        } catch (err) {
          console.warn('Erro ao deletar do Firestore:', err);
        }
      }
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
    <>
      {/* Fullscreen High-Urgency Uber A Caminho Overlay */}
      <UberAlertOverlay
        alert={uberAlertData}
        onClose={() => setUberAlertData(null)}
        onOpenChat={() => {
          setUberAlertData(null);
          setIsOpen(true);
        }}
      />

      {/* Fullscreen Attention Anota os Pedidos Overlay */}
      <OrderAlertOverlay
        alert={orderAlertData}
        onClose={() => setOrderAlertData(null)}
        onOpenChat={() => {
          setOrderAlertData(null);
          setIsOpen(true);
        }}
      />

      <div className="no-print fixed bottom-5 right-5 z-50 flex flex-col items-end pointer-events-auto">
      {/* Toast Flutuante de Notificação quando minimizado */}
      <AnimatePresence>
        {!isOpen && incomingAlert && (
          <motion.div
            initial={{ opacity: 0, y: 15, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.92 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            onClick={() => {
              setIsOpen(true);
              setIncomingAlert(null);
            }}
            className="mb-3 p-3.5 bg-zinc-950/95 border-2 border-orange-500 rounded-2xl shadow-2xl shadow-orange-500/30 max-w-[340px] backdrop-blur-xl cursor-pointer hover:border-orange-400 transition-all group"
          >
            <div className="flex items-start gap-3">
              <div className="relative shrink-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-amber-500 text-white flex items-center justify-center shadow-lg shadow-orange-500/30 group-hover:scale-105 transition-transform">
                  <Bell className="h-4.5 w-4.5 animate-bounce" />
                </div>
                <span className="absolute -top-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-1 mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-xs font-bold text-orange-400 truncate">
                      {incomingAlert.senderName}
                    </span>
                    {isMessageFromAdmin(incomingAlert.senderName, incomingAlert.senderRole, incomingAlert.senderId) && (
                      <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5 shrink-0">
                        <Crown className="h-2.5 w-2.5 text-amber-400" /> Admin
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIncomingAlert(null);
                    }}
                    className="p-1 text-zinc-500 hover:text-zinc-300 rounded-md transition-colors"
                    title="Dispensar aviso"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="text-xs text-zinc-100 font-medium line-clamp-2 leading-relaxed bg-zinc-900/80 px-2.5 py-1.5 rounded-lg border border-zinc-800/80">
                  {incomingAlert.text}
                </p>

                <div className="mt-2 flex items-center justify-between text-[10px]">
                  <span className="text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                    <span>Clique para responder</span>
                    <span>&rarr;</span>
                  </span>
                  <span className="text-zinc-500">Agora</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="w-[92vw] sm:w-[390px] h-[530px] max-h-[82vh] bg-zinc-950 border border-zinc-800/90 rounded-2xl shadow-2xl flex flex-col overflow-hidden mb-3.5 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="px-4 py-3.5 bg-zinc-900/95 border-b border-zinc-800/80 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative">
                  <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-500/40 flex items-center justify-center text-orange-400">
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
                  <div className="text-[11px] text-zinc-400 truncate flex items-center gap-1">
                    <span>Você:</span> 
                    <strong className="text-zinc-100 font-bold">{currentUserName}</strong>
                    {isUserAdmin && (
                      <span className="text-[9px] bg-amber-950/90 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded-full font-semibold inline-flex items-center gap-0.5">
                        <Crown className="h-2.5 w-2.5 text-amber-400" /> Admin
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                {isUserAdmin && messages.length > 0 && (
                  isConfirmingClear ? (
                    <div className="flex items-center gap-1 bg-red-950/90 border border-red-800/80 px-2 py-0.5 rounded-lg text-xs animate-in fade-in">
                      <span className="text-[10px] text-red-200 font-bold whitespace-nowrap">Limpar?</span>
                      <button
                        type="button"
                        onClick={handleClearHistory}
                        title="Confirmar limpeza das mensagens"
                        className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[10px] font-bold cursor-pointer transition-colors shadow-xs"
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsConfirmingClear(false)}
                        title="Cancelar"
                        className="px-1.5 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded text-[10px] cursor-pointer transition-colors"
                      >
                        Não
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsConfirmingClear(true)}
                      title="Limpar mensagens do chat (Admin)"
                      className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )
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
                    <MessageSquare className="h-6 w-6 text-orange-400/60" />
                  </div>
                  <p className="text-xs font-semibold text-zinc-300">Nenhuma mensagem ainda</p>
                  <p className="text-[11px] text-zinc-500 mt-1 max-w-[220px]">
                    Envie um recado para a equipe ou use um dos atalhos rápidos abaixo!
                  </p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isSelf = 
                    msg.senderId === currentUserId || 
                    (isUserAdmin && isMessageFromAdmin(msg.senderName, msg.senderRole, msg.senderId));
                  const senderName = getSenderDisplayName(msg.senderName, msg.senderRole, msg.senderId);
                  const msgIsAdmin = isMessageFromAdmin(msg.senderName, msg.senderRole, msg.senderId);
                  const isUberMsg = isUberAlertText(msg.text);
                  const isOrderMsg = isOrderAlertText(msg.text);

                  return (
                    <div
                      key={msg.id || idx}
                      className={`flex flex-col ${isSelf ? 'items-end' : 'items-start'}`}
                    >
                      {!isSelf && (
                        <div className="flex items-center gap-1.5 mb-1 px-1">
                          <span className={`text-[11px] font-bold ${getSenderColor(senderName, false)}`}>
                            {senderName}
                          </span>
                          {msgIsAdmin && (
                            <span className="text-[9px] bg-amber-950 text-amber-300 border border-amber-800/60 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                              <Crown className="h-2.5 w-2.5 text-amber-400" /> Admin
                            </span>
                          )}
                        </div>
                      )}

                      <div
                        className={`max-w-[86%] px-3.5 py-2.5 rounded-2xl text-xs break-words shadow-sm transition-all ${
                          isUberMsg
                            ? isSelf
                              ? 'bg-gradient-to-r from-amber-600 to-orange-600 border-2 border-amber-300 text-white rounded-tr-none shadow-amber-500/30 shadow-lg'
                              : 'bg-gradient-to-b from-amber-950/90 to-zinc-900 border-2 border-amber-500 text-amber-100 rounded-tl-none shadow-amber-500/30 shadow-lg'
                            : isOrderMsg
                            ? isSelf
                              ? 'bg-gradient-to-r from-indigo-600 to-violet-600 border-2 border-indigo-300 text-white rounded-tr-none shadow-indigo-500/30 shadow-lg'
                              : 'bg-gradient-to-b from-indigo-950/90 to-zinc-900 border-2 border-indigo-500 text-indigo-100 rounded-tl-none shadow-indigo-500/30 shadow-lg'
                            : isSelf
                            ? 'bg-orange-500 text-white rounded-tr-none font-medium'
                            : 'bg-zinc-850 border border-zinc-750 text-zinc-100 rounded-tl-none'
                        }`}
                      >
                        {isUberMsg && (
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-amber-300 mb-1.5 pb-1 border-b border-amber-500/30">
                            <Car className="h-3.5 w-3.5 animate-bounce" />
                            <span>Alerta Expedição Urgente</span>
                          </div>
                        )}
                        {isOrderMsg && (
                          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-indigo-300 mb-1.5 pb-1 border-b border-indigo-500/30">
                            <ClipboardList className="h-3.5 w-3.5 animate-bounce" />
                            <span>Alerta Anotação de Pedidos</span>
                          </div>
                        )}
                        <p className="leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[9px] ${
                            isSelf 
                              ? (isUberMsg ? 'text-amber-100' : isOrderMsg ? 'text-indigo-100' : 'text-orange-100/80') 
                              : (isUberMsg ? 'text-amber-400/80' : isOrderMsg ? 'text-indigo-300/80' : 'text-zinc-500')
                          }`}
                        >
                          <span>{formatMessageTime(msg.timestamp)}</span>
                          {isSelf && <Check className="h-2.5 w-2.5 opacity-90" />}
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
        onClick={() => {
          setIsOpen((prev) => !prev);
          setIncomingAlert(null);
        }}
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
          <div className={`p-1 rounded-full ${unreadCount > 0 && !isOpen ? 'bg-white/20 text-white' : 'bg-orange-500/20 text-orange-400'}`}>
            {unreadCount > 0 && !isOpen ? (
              <Bell className="h-4 w-4 animate-bounce" />
            ) : (
              <MessageSquare className="h-4 w-4" />
            )}
          </div>
          {unreadCount > 0 && !isOpen && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-red-600 text-white text-[10px] font-black rounded-full flex items-center justify-center border-2 border-zinc-950 shadow-md animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </div>
        <span className="hidden sm:inline font-semibold text-zinc-100">
          {unreadCount > 0 && !isOpen ? '💬 Nova Mensagem!' : 'Chat Equipe'}
        </span>
        {unreadCount > 0 && !isOpen && (
          <span className="sm:hidden text-[11px] font-black text-white">
            ({unreadCount})
          </span>
        )}
      </motion.button>
    </div>
    </>
  );
}
