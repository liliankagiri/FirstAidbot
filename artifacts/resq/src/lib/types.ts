export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: Date;
  isEmergency?: boolean;
  emergencyLevel?: "low" | "moderate" | "high" | "critical";
  steps?: string[];
  callEmergency?: boolean;
  nearbyHospitals?: Array<{
    name: string;
    address: string;
    distance: string;
    phone?: string;
  }>;
}
