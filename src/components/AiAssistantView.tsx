'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  Sparkles, 
  Send, 
  Key, 
  ShieldCheck, 
  Lock, 
  ChevronDown, 
  ChevronUp, 
  Cpu, 
  CheckCircle2, 
  X, 
  Bot, 
  User as UserIcon,
  RefreshCw
} from 'lucide-react';

interface ToolCall {
  toolName: string;
  arguments: Record<string, unknown>;
  output: unknown;
}

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  toolCalls?: ToolCall[] | null;
  createdAt: string;
}

interface AiAssistantViewProps {
  userHasKey: boolean;
  userProvider: string;
  onRefreshUser: () => void;
}

export default function AiAssistantView({
  userHasKey,
  userProvider,
  onRefreshUser,
}: AiAssistantViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [keyModalOpen, setKeyModalOpen] = useState(false);
  const [expandedToolMsgId, setExpandedToolMsgId] = useState<string | null>(null);

  // Key vault modal state
  const [selectedProvider, setSelectedProvider] = useState<'openai' | 'anthropic' | 'gemini'>('openai');
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [keySaving, setKeySaving] = useState(false);
  const [keyStatusMsg, setKeyStatusMsg] = useState('');

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchMessages = async () => {
    try {
      const res = await fetch('/api/ai/messages');
      if (res.ok) {
        const json = await res.json();
        setMessages(json.messages || []);
      }
    } catch (e) {
      console.error('Failed to fetch messages:', e);
    }
  };

  useEffect(() => {
    fetchMessages();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSend = async (promptToSend?: string) => {
    const prompt = (promptToSend || input).trim();
    if (!prompt || loading) return;

    setInput('');
    // Optimistic user message
    const tempId = `temp_${Date.now()}`;
    const newMsg: Message = {
      id: tempId,
      role: 'user',
      content: prompt,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, newMsg]);
    setLoading(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          provider: userHasKey ? userProvider : 'mock',
        }),
      });

      if (res.ok) {
        const json = await res.json();
        setMessages((prev) => [...prev, json.message]);
      } else {
        const errJson = await res.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ Error: ${errJson.error || 'Failed to process request.'}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          role: 'assistant',
          content: '⚠️ Network error communicating with financial assistant.',
          createdAt: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKeyInput.trim()) return;

    setKeySaving(true);
    setKeyStatusMsg('');
    try {
      const res = await fetch('/api/ai/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKeyInput.trim(),
        }),
      });

      if (res.ok) {
        setKeyStatusMsg('Key encrypted with AES-256-GCM and saved successfully!');
        setApiKeyInput('');
        onRefreshUser();
        setTimeout(() => {
          setKeyModalOpen(false);
          setKeyStatusMsg('');
        }, 1500);
      } else {
        const err = await res.json();
        setKeyStatusMsg(`Error: ${err.error}`);
      }
    } catch {
      setKeyStatusMsg('Failed to store API key.');
    } finally {
      setKeySaving(false);
    }
  };

  const handleRemoveKey = async () => {
    if (!confirm('Remove your stored encrypted API key? Assistant will fall back to local offline mode.')) return;
    try {
      const res = await fetch(`/api/ai/keys?provider=${userProvider}`, { method: 'DELETE' });
      if (res.ok) {
        onRefreshUser();
        setKeyModalOpen(false);
      }
    } catch {
      alert('Failed to remove key.');
    }
  };

  const quickPills = [
    { label: '💡 Personalized savings advice', prompt: 'Give me personalized savings recommendations based on my spending' },
    { label: '📊 Category spending breakdown', prompt: 'Break down my expenses by category and show percentages' },
    { label: '🎯 Check budget health', prompt: 'Are any of my budgets near or exceeded their limit?' },
    { label: '🕒 Show recent transactions', prompt: 'Show my latest recent transactions with amounts' },
  ];

  return (
    <div className="h-[calc(100vh-10rem)] flex flex-col glass-panel rounded-2xl overflow-hidden">
      {/* Header bar */}
      <div className="p-4 border-b border-white/10 bg-white/[0.02] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 p-[1px]">
            <div className="w-full h-full bg-[#090D16] rounded-xl flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white">FinTrack AI Assistant</h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono">
                {userHasKey ? `Live (${userProvider})` : 'Offline Mock Fallback'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Tool-calling over verified user-scoped financial database records
            </p>
          </div>
        </div>

        <button
          onClick={() => setKeyModalOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-all"
        >
          <Lock className="w-3.5 h-3.5 text-amber-400" />
          <span>{userHasKey ? 'Key Vault (Encrypted)' : 'Configure AI Key'}</span>
        </button>
      </div>

      {/* Message History */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto space-y-4 py-8">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
              <Cpu className="w-7 h-7" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">Provider-Agnostic Financial AI</h3>
              <p className="text-xs text-slate-400 mt-1">
                Ask questions about your transactions, spending habits, budget limits, or request savings recommendations. The assistant calls local tools strictly scoped to your account.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full pt-2">
              {quickPills.map((pill) => (
                <button
                  key={pill.label}
                  onClick={() => handleSend(pill.prompt)}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-indigo-600/20 border border-white/5 hover:border-indigo-500/30 text-left text-xs text-slate-300 hover:text-white transition-all"
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.role === 'user';
            const isToolExpanded = expandedToolMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex gap-3 max-w-3xl ${isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'}`}
              >
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    isUser ? 'bg-indigo-600 text-white' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  }`}
                >
                  {isUser ? <UserIcon className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                </div>

                <div className="space-y-2">
                  <div
                    className={`p-4 rounded-2xl text-xs leading-relaxed ${
                      isUser
                        ? 'bg-indigo-600 text-white rounded-tr-none'
                        : 'bg-white/5 border border-white/10 text-slate-200 rounded-tl-none prose prose-invert'
                    }`}
                  >
                    <div className="whitespace-pre-wrap font-sans">{msg.content}</div>
                  </div>

                  {/* Tool Call Inspector Accordion */}
                  {!isUser && msg.toolCalls && msg.toolCalls.length > 0 && (
                    <div className="bg-black/30 border border-white/5 rounded-xl overflow-hidden text-[11px]">
                      <button
                        onClick={() => setExpandedToolMsgId(isToolExpanded ? null : msg.id)}
                        className="w-full px-3 py-2 flex items-center justify-between text-slate-400 hover:text-slate-200 bg-white/[0.02]"
                      >
                        <span className="flex items-center gap-1.5 font-mono text-emerald-400">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Executed {msg.toolCalls.length} Scoped Financial Tool(s)</span>
                        </span>
                        {isToolExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                      </button>

                      {isToolExpanded && (
                        <div className="p-3 border-t border-white/5 space-y-2 font-mono text-[10px] text-slate-300 max-h-48 overflow-y-auto">
                          {msg.toolCalls.map((tc, idx) => (
                            <div key={idx} className="p-2 rounded bg-black/40 border border-white/5">
                              <div className="text-indigo-400 font-bold">tool: {tc.toolName}()</div>
                              <pre className="mt-1 text-slate-400 overflow-x-auto">
                                {JSON.stringify(tc.output, null, 2)}
                              </pre>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}

        {loading && (
          <div className="flex gap-3 max-w-xl mr-auto">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center animate-pulse">
              <Bot className="w-4 h-4" />
            </div>
            <div className="p-4 rounded-2xl rounded-tl-none bg-white/5 border border-white/10 text-xs text-slate-400 flex items-center gap-2">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
              <span>Analyzing authenticated financial records...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Quick Prompts Bar & Input Box */}
      <div className="p-4 border-t border-white/10 bg-[#090D16]/70 backdrop-blur-md space-y-3">
        {/* Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
          {quickPills.map((pill) => (
            <button
              key={pill.label}
              onClick={() => handleSend(pill.prompt)}
              className="px-3 py-1 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-indigo-500/30 text-slate-300 hover:text-white shrink-0 transition-all text-[11px]"
            >
              {pill.label}
            </button>
          ))}
        </div>

        {/* Input Form */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            placeholder="Ask about spending trends, category totals, budget status..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-5 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md shadow-indigo-600/30 transition-all disabled:opacity-40 flex items-center gap-1.5"
          >
            <span>Send</span>
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>

      {/* Key Vault Modal */}
      {keyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="glass-panel w-full max-w-md p-6 rounded-2xl border border-white/10 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-emerald-400" />
                <h3 className="font-bold text-sm text-white">AI Key Vault (AES-256-GCM)</h3>
              </div>
              <button
                onClick={() => setKeyModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-[11px] text-indigo-300 space-y-1">
              <div className="font-semibold flex items-center gap-1 text-white">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Zero Plaintext Exposure Guarantee</span>
              </div>
              <p>
                Keys are encrypted at rest using AES-256-GCM (storing <code>keyCiphertext</code>, <code>iv</code>, and <code>authTag</code>). Decrypted exclusively server-side in memory during execution.
              </p>
            </div>

            {keyStatusMsg && (
              <div className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-emerald-400">
                {keyStatusMsg}
              </div>
            )}

            <form onSubmit={handleSaveKey} className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Select LLM Provider</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value as any)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="openai" className="bg-slate-900 text-white">OpenAI (GPT-4o / GPT-4o-mini)</option>
                  <option value="anthropic" className="bg-slate-900 text-white">Anthropic (Claude 3.5 Sonnet)</option>
                  <option value="gemini" className="bg-slate-900 text-white">Google Gemini (Gemini 1.5 Pro)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">API Key</label>
                <input
                  type="password"
                  required
                  placeholder="sk-... or API key token"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-white font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                {userHasKey ? (
                  <button
                    type="button"
                    onClick={handleRemoveKey}
                    className="text-xs text-rose-400 hover:text-rose-300 font-medium"
                  >
                    Delete Stored Key
                  </button>
                ) : <span />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setKeyModalOpen(false)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 font-semibold"
                  >
                    Close
                  </button>
                  <button
                    type="submit"
                    disabled={keySaving}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md disabled:opacity-50"
                  >
                    {keySaving ? 'Encrypting...' : 'Encrypt & Store'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
