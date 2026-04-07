import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSendMessage } from "@workspace/api-client-react";
import { Send, Activity, MapPin, AlertCircle, Phone, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChatMessage } from "@/lib/types";

const INITIAL_SUGGESTIONS = [
  "Choking",
  "Burns",
  "CPR needed",
  "Bleeding",
  "Broken bone",
  "Seizure",
  "Allergic reaction",
  "Heart attack"
];

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [callEmergencyBanner, setCallEmergencyBanner] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { mutateAsync: sendMessage } = useSendMessage();

  useEffect(() => {
    // Initial welcome message
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "bot",
        content: "Hi! I'm ResQ, your personal first aid assistant. Tell me what's happening — describe the emergency or injury, and I'll guide you through it step by step.",
        timestamp: new Date()
      }
    ]);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  const requestLocation = async () => {
    if (hasRequestedLocation) return location;
    
    setHasRequestedLocation(true);
    
    try {
      if (!navigator.geolocation) {
        return null;
      }
      
      const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const newLoc = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude
      };
      
      setLocation(newLoc);
      return newLoc;
    } catch (error) {
      console.warn("Location permission denied or timed out");
      return null;
    }
  };

  const handleSend = async (text: string = input) => {
    if (!text.trim()) return;

    setShowSuggestions(false);
    
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      timestamp: new Date()
    };
    
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsTyping(true);

    // Request location on first message
    const loc = await requestLocation();

    try {
      const response = await sendMessage({
        data: {
          message: text,
          sessionId,
          latitude: loc?.latitude,
          longitude: loc?.longitude
        }
      });

      if (response.isEmergency && response.callEmergency) {
        setCallEmergencyBanner(true);
      }

      const botMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "bot",
        content: response.response,
        timestamp: new Date(),
        isEmergency: response.isEmergency,
        emergencyLevel: response.emergencyLevel as any,
        steps: response.steps,
        callEmergency: response.callEmergency,
        nearbyHospitals: response.nearbyHospitals
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      const errorMessage: ChatMessage = {
        id: crypto.randomUUID(),
        role: "bot",
        content: "I'm having trouble connecting right now. If this is a life-threatening emergency, please call emergency services immediately.",
        timestamp: new Date(),
        isEmergency: true,
        callEmergency: true
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsTyping(false);
      // Keep focus on input after sending for fast consecutive messaging
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  };

  const getEmergencyColor = (level?: string) => {
    switch (level) {
      case "low": return "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800/50";
      case "moderate": return "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-800/50";
      case "high": return "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300 dark:border-orange-800/50";
      case "critical": return "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800/50";
      default: return "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700";
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-3xl mx-auto w-full bg-slate-50 dark:bg-slate-950 relative overflow-hidden">
      {/* Header */}
      <header className="bg-[#0a5c36] text-white p-4 shadow-md z-10 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-lg leading-tight flex items-center gap-2">
              ResQ
            </h1>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <span className="text-xs text-white/80 font-medium">Online • Medical Assistant</span>
            </div>
          </div>
        </div>
      </header>

      {/* Emergency Banner */}
      {callEmergencyBanner && (
        <div className="bg-red-600 text-white p-3 flex items-center justify-between shadow-sm animate-in slide-in-from-top shrink-0 z-10">
          <div className="flex items-center gap-2 font-medium">
            <Phone className="w-5 h-5" />
            <span>Call Emergency Services</span>
          </div>
          <Button variant="secondary" size="sm" className="bg-white text-red-600 hover:bg-red-50 font-bold" onClick={() => window.open('tel:911')}>
            Call Now
          </Button>
        </div>
      )}

      {/* Chat Area */}
      <ScrollArea className="flex-1 p-4 w-full">
        <div className="flex flex-col gap-4 pb-4 max-w-full">
          <div className="text-center my-4 flex justify-center">
            <Badge variant="outline" className="bg-[#0a5c36]/5 text-[#0a5c36] border-[#0a5c36]/20 font-normal px-3 py-1 text-xs backdrop-blur-sm">
              Conversations are private and secure
            </Badge>
          </div>

          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex flex-col max-w-[85%] ${
                msg.role === "user" ? "self-end items-end" : "self-start items-start"
              } animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              <div
                className={`rounded-2xl px-4 py-3 shadow-sm ${
                  msg.role === "user"
                    ? "bg-[#e2f5ea] text-[#0a5c36] dark:bg-[#0a5c36]/40 dark:text-[#e2f5ea] rounded-tr-sm"
                    : "bg-white text-slate-800 border border-slate-100 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200 rounded-tl-sm"
                }`}
              >
                {msg.role === "bot" && msg.emergencyLevel && (
                  <div className="mb-2">
                    <Badge variant="outline" className={`${getEmergencyColor(msg.emergencyLevel)} uppercase tracking-wider text-[10px] font-bold border`}>
                      {msg.emergencyLevel} Severity
                    </Badge>
                  </div>
                )}
                
                <div className="text-[15px] leading-relaxed whitespace-pre-wrap">
                  {msg.content}
                </div>

                {msg.steps && msg.steps.length > 0 && (
                  <div className="mt-4 space-y-2 bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-700/50">
                    <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 mb-3">
                      <AlertCircle className="w-4 h-4 text-[#0a5c36] dark:text-green-400" />
                      Immediate Steps
                    </h4>
                    {msg.steps.map((step, idx) => (
                      <div key={idx} className="flex gap-3 items-start">
                        <div className="w-6 h-6 rounded-full bg-[#0a5c36] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 shadow-sm">
                          {idx + 1}
                        </div>
                        <p className="text-[15px] leading-snug pt-0.5 text-slate-700 dark:text-slate-300 font-medium">{step}</p>
                      </div>
                    ))}
                  </div>
                )}

                {msg.nearbyHospitals && msg.nearbyHospitals.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5" />
                      Nearby Medical Facilities
                    </h4>
                    <div className="space-y-2">
                      {msg.nearbyHospitals.map((hospital, idx) => (
                        <Card key={idx} className="border-slate-200 shadow-none bg-slate-50 dark:bg-slate-800 dark:border-slate-700">
                          <CardContent className="p-3">
                            <h5 className="font-semibold text-sm text-[#0a5c36] dark:text-green-400">{hospital.name}</h5>
                            <p className="text-xs text-slate-500 mt-1">{hospital.address}</p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs font-medium bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded text-slate-600 dark:text-slate-300">
                                {hospital.distance} away
                              </span>
                              {hospital.phone && (
                                <a href={`tel:${hospital.phone}`} className="text-xs font-medium text-[#0a5c36] flex items-center gap-1">
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
              <span className="text-[10px] text-slate-400 mt-1 px-1 font-medium">
                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          ))}

          {isTyping && (
            <div className="flex flex-col self-start items-start animate-in fade-in duration-300">
              <div className="bg-white border border-slate-100 dark:bg-slate-900 dark:border-slate-800 rounded-2xl rounded-tl-sm px-4 py-3.5 shadow-sm">
                <div className="flex gap-1.5 items-center h-4">
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                  <div className="w-2 h-2 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                </div>
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="bg-[#f0f2f5] dark:bg-slate-950 border-t border-slate-200 dark:border-slate-800 p-3 shrink-0 relative z-20">
        {showSuggestions && (
          <div className="flex overflow-x-auto gap-2 pb-3 mb-1 snap-x scrollbar-none" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {INITIAL_SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => handleSend(suggestion)}
                className="snap-start shrink-0 bg-white border border-[#0a5c36]/20 text-[#0a5c36] dark:bg-slate-900 dark:border-[#0a5c36]/40 dark:text-green-400 px-4 py-2 rounded-full text-sm font-medium shadow-sm hover:bg-[#e2f5ea] dark:hover:bg-[#0a5c36]/20 transition-colors active:scale-95 touch-manipulation whitespace-nowrap"
              >
                {suggestion}
              </button>
            ))}
          </div>
        )}
        
        <form 
          onSubmit={(e) => { e.preventDefault(); handleSend(); }}
          className="flex items-end gap-2 bg-white dark:bg-slate-900 rounded-3xl p-1 shadow-sm border border-slate-200 dark:border-slate-800 focus-within:ring-2 focus-within:ring-[#0a5c36]/30 transition-all"
        >
          <div className="w-10 h-10 flex items-center justify-center shrink-0 ml-1 rounded-full text-slate-400">
            <Info className="w-5 h-5" />
          </div>
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Describe the emergency..."
            className="flex-1 border-0 shadow-none focus-visible:ring-0 px-1 py-3 bg-transparent min-h-[44px] text-[15px]"
            disabled={isTyping}
            autoFocus
          />
          <Button 
            type="submit" 
            size="icon"
            disabled={!input.trim() || isTyping}
            className="rounded-full w-10 h-10 bg-[#0a5c36] hover:bg-[#084528] text-white shrink-0 mr-1 shadow-md transition-transform active:scale-90"
          >
            <Send className="w-4 h-4 ml-0.5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
        <div className="text-center mt-2">
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-medium">For life-threatening emergencies, always call 911</span>
        </div>
      </div>
    </div>
  );
}
