import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSendMessage } from "@workspace/api-client-react";
import { Send, Activity, MapPin, AlertCircle, Phone, X, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatMessage, ConversationTurn } from "@/lib/types";

const INITIAL_SUGGESTIONS = [
  "Choking",
  "Burns",
  "CPR needed",
  "Bleeding",
  "Broken bone",
  "Seizure",
  "Allergic reaction",
  "Heart attack",
];

type LocationPermission = "undecided" | "granted" | "declined";

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [locationPermission, setLocationPermission] = useState<LocationPermission>("undecided");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [showLocationPrompt, setShowLocationPrompt] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [callEmergencyBanner, setCallEmergencyBanner] = useState(false);
  const [history, setHistory] = useState<ConversationTurn[]>([]);

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: sendMessage } = useSendMessage();

  useEffect(() => {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "bot",
        content:
          "Hi, I'm ResQ — your first aid assistant. Tell me what's happening and I'll walk you through exactly what to do, step by step.",
        timestamp: new Date(),
      },
    ]);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, showLocationPrompt, scrollToBottom]);

  const acquireLocation = async (): Promise<{ latitude: number; longitude: number } | null> => {
    if (!navigator.geolocation) return null;
    try {
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 30000,
        })
      );
      const loc = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
      setLocation(loc);
      return loc;
    } catch {
      return null;
    }
  };

  const dispatchMessage = useCallback(
    async (text: string, loc: { latitude: number; longitude: number } | null, currentHistory: ConversationTurn[]) => {
      setIsTyping(true);

      try {
        const response = await sendMessage({
          data: {
            message: text,
            sessionId,
            history: currentHistory,
            latitude: loc?.latitude,
            longitude: loc?.longitude,
          },
        });

        if (response.emergencyLevel === "critical" && response.callEmergency) {
          setCallEmergencyBanner(true);
        }

        if (response.isNewIncident) {
          setCallEmergencyBanner(false);
        }

        const botMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "bot",
          content: response.response,
          timestamp: new Date(),
          isEmergency: response.isEmergency,
          emergencyLevel: response.emergencyLevel as ChatMessage["emergencyLevel"],
          steps: response.steps,
          callEmergency: response.callEmergency,
          nearbyHospitals: response.nearbyHospitals,
        };

        setMessages((prev) => [...prev, botMessage]);

        setHistory((prev) => {
          const base = response.isNewIncident ? [] : prev;
          return [
            ...base,
            { role: "user" as const, content: text },
            { role: "assistant" as const, content: response.response },
          ];
        });
      } catch {
        const errorMessage: ChatMessage = {
          id: crypto.randomUUID(),
          role: "bot",
          content:
            "I'm having trouble connecting right now. If this is a life-threatening emergency, call 999 immediately.",
          timestamp: new Date(),
          isEmergency: true,
          callEmergency: true,
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsTyping(false);
        setTimeout(() => inputRef.current?.focus(), 10);
      }
    },
    [sendMessage, sessionId]
  );

  const handleSend = async (text: string = input) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    setShowSuggestions(false);

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");

    if (locationPermission === "undecided") {
      setPendingMessage(trimmed);
      setShowLocationPrompt(true);
      return;
    }

    await dispatchMessage(trimmed, location, history);
  };

  const handleLocationAllow = async () => {
    setShowLocationPrompt(false);
    setLocationPermission("granted");
    const loc = await acquireLocation();
    if (pendingMessage) {
      const msg = pendingMessage;
      setPendingMessage(null);
      await dispatchMessage(msg, loc, history);
    }
  };

  const handleLocationDecline = async () => {
    setShowLocationPrompt(false);
    setLocationPermission("declined");
    if (pendingMessage) {
      const msg = pendingMessage;
      setPendingMessage(null);
      await dispatchMessage(msg, null, history);
    }
  };

  const getEmergencyColor = (level?: string) => {
    switch (level) {
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      case "moderate":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "high":
        return "bg-orange-100 text-orange-800 border-orange-200";
      case "critical":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-slate-100 text-slate-600 border-slate-200";
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-3xl mx-auto w-full bg-slate-50 relative overflow-hidden">
      {/* Header */}
      <header className="bg-[#0a5c36] text-white px-4 py-3 shadow-md z-10 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 bg-white/10 rounded-full flex items-center justify-center">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-base leading-tight">ResQ</h1>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs text-white/75 font-medium">First Aid Assistant</span>
          </div>
        </div>
      </header>

      {/* Critical Emergency Banner */}
      {callEmergencyBanner && (
        <div className="bg-red-600 text-white px-4 py-2.5 flex items-center justify-between shadow-sm shrink-0 z-10 animate-in slide-in-from-top duration-300">
          <div className="flex items-center gap-2 font-semibold text-sm">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Call 999 immediately — this is a critical emergency</span>
          </div>
          <div className="flex items-center gap-2">
            <a
              href="tel:999"
              className="bg-white text-red-600 hover:bg-red-50 font-bold text-xs px-3 py-1.5 rounded-full transition-colors"
            >
              Call 999
            </a>
            <button
              onClick={() => setCallEmergencyBanner(false)}
              className="text-white/70 hover:text-white transition-colors"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Chat Messages */}
      <ScrollArea className="flex-1 px-4 py-3 w-full">
        <div className="flex flex-col gap-3 pb-2">
          {/* Privacy badge */}
          <div className="text-center flex justify-center pt-1 pb-2">
            <Badge
              variant="outline"
              className="bg-[#0a5c36]/5 text-[#0a5c36] border-[#0a5c36]/20 font-normal px-3 py-1 text-xs"
            >
              Conversations are private and secure
            </Badge>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[86%] ${
                msg.role === "user" ? "self-end items-end" : "self-start items-start"
              } animate-in fade-in slide-in-from-bottom-1 duration-200`}
            >
              <div
                className={`rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === "user"
                    ? "bg-[#dcf8c6] text-slate-800 rounded-tr-sm"
                    : "bg-white text-slate-800 border border-slate-100 rounded-tl-sm"
                }`}
              >
                {/* Severity badge — only for bot messages */}
                {msg.role === "bot" && msg.emergencyLevel && (
                  <div className="mb-2">
                    <Badge
                      variant="outline"
                      className={`${getEmergencyColor(msg.emergencyLevel)} uppercase tracking-wider text-[10px] font-bold border`}
                    >
                      {msg.emergencyLevel} severity
                    </Badge>
                  </div>
                )}

                <div className="text-[15px] leading-relaxed">{msg.content}</div>

                {/* Step-by-step guidance */}
                {msg.steps && msg.steps.length > 0 && (
                  <div className="mt-3 space-y-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                      <AlertCircle className="w-3.5 h-3.5 text-[#0a5c36]" />
                      What to do now
                    </h4>
                    {msg.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <div className="w-5 h-5 rounded-full bg-[#0a5c36] text-white flex items-center justify-center text-[11px] font-bold shrink-0 mt-0.5">
                          {idx + 1}
                        </div>
                        <p className="text-[14px] leading-snug text-slate-700 pt-0.5">{step}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Nearby hospitals — only shown for critical cases with location */}
                {msg.nearbyHospitals && msg.nearbyHospitals.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-100">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Nearest hospitals
                    </h4>
                    <div className="space-y-2">
                      {msg.nearbyHospitals.map((hospital, idx) => (
                        <Card key={idx} className="border-slate-200 shadow-none bg-slate-50">
                          <CardContent className="p-3">
                            <h5 className="font-semibold text-sm text-[#0a5c36]">{hospital.name}</h5>
                            <p className="text-xs text-slate-500 mt-0.5">{hospital.address}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs font-medium bg-slate-200 px-2 py-0.5 rounded text-slate-600">
                                {hospital.distance}
                              </span>
                              {hospital.phone && (
                                <a
                                  href={`tel:${hospital.phone}`}
                                  className="text-xs font-medium text-[#0a5c36] flex items-center gap-1"
                                >
                                  <Phone className="w-3 h-3" />
                                  Call
                                </a>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <span className="text-[10px] text-slate-400 mt-1 px-1">
                {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex self-start animate-in fade-in duration-200">
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm">
                <div className="flex gap-1.5 items-center h-4">
                  {[0, 150, 300].map((delay) => (
                    <div
                      key={delay}
                      className="w-2 h-2 rounded-full bg-slate-300 animate-bounce"
                      style={{ animationDelay: `${delay}ms` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Location permission prompt — inline in chat */}
          {showLocationPrompt && (
            <div className="self-start max-w-[86%] animate-in fade-in slide-in-from-bottom-1 duration-200">
              <div className="bg-white border border-[#0a5c36]/20 rounded-2xl rounded-tl-sm px-4 py-4 shadow-sm">
                <div className="flex items-start gap-3 mb-3">
                  <MapPin className="w-5 h-5 text-[#0a5c36] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px] font-semibold text-slate-800 mb-1">
                      Share your location?
                    </p>
                    <p className="text-[13px] text-slate-500 leading-relaxed">
                      In critical emergencies, I can show you nearby hospitals. This is completely
                      optional — I'll help you either way.
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={handleLocationAllow}
                    className="bg-[#0a5c36] hover:bg-[#084528] text-white text-xs px-4"
                  >
                    Allow location
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleLocationDecline}
                    className="text-xs px-4 border-slate-200 text-slate-600"
                  >
                    No thanks
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="bg-[#f0f2f5] border-t border-slate-200 px-3 pt-2 pb-3 shrink-0">
        {/* Quick suggestion chips */}
        {showSuggestions && (
          <div
            className="flex overflow-x-auto gap-2 pb-2 mb-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {INITIAL_SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => handleSend(s)}
                className="shrink-0 bg-white border border-[#0a5c36]/20 text-[#0a5c36] px-3 py-1.5 rounded-full text-sm font-medium shadow-sm hover:bg-[#e2f5ea] transition-colors active:scale-95 touch-manipulation whitespace-nowrap"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {/* Text input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center gap-2 bg-white rounded-3xl px-4 py-1 shadow-sm border border-slate-200 focus-within:ring-2 focus-within:ring-[#0a5c36]/25 transition-all"
        >
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe what happened..."
            className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0 py-2.5 bg-transparent text-[15px] placeholder:text-slate-400"
            disabled={isTyping || showLocationPrompt}
            autoFocus
          />
          <Button
            type="submit"
            size="icon"
            disabled={!input.trim() || isTyping || showLocationPrompt}
            className="rounded-full w-9 h-9 bg-[#0a5c36] hover:bg-[#084528] text-white shrink-0 shadow-sm transition-transform active:scale-90"
          >
            <Send className="w-4 h-4 ml-0.5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>

        {/* Disclaimer */}
        <p className="text-center text-[10px] text-slate-400 mt-2 leading-relaxed px-2">
          ResQ provides first aid guidance only and is not a substitute for professional medical care.
          In a life-threatening emergency, always call 999.
        </p>
      </div>
    </div>
  );
}
