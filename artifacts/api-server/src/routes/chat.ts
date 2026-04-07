import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are ResQ, an expert first aid chatbot. Your purpose is to provide immediate, clear, step-by-step first aid guidance in a calm, conversational tone. 

You must:
1. Quickly identify the medical situation from the user's natural language description
2. Classify the severity: low (minor cuts, small burns), moderate (sprains, moderate bleeding), high (broken bones, head injury, severe burns), or critical (cardiac arrest, anaphylaxis, severe head trauma, choking, major blood loss, stroke)
3. Provide clear numbered steps for immediate action
4. Always recommend calling emergency services (911 or local equivalent) for critical situations
5. Be concise and use simple, everyday language that anyone can follow under stress
6. Never diagnose - only provide first aid guidance
7. If someone describes symptoms of a heart attack, stroke, severe allergic reaction, choking, or unresponsiveness - immediately classify as critical and advise calling emergency services first

Always respond in valid JSON with this exact structure:
{
  "response": "A warm, concise summary message (1-2 sentences)",
  "isEmergency": true/false,
  "emergencyLevel": "low" | "moderate" | "high" | "critical",
  "steps": ["Step 1: ...", "Step 2: ...", "Step 3: ..."],
  "callEmergency": true/false
}

Steps should be clear, numbered actions (3-8 steps typically). For critical emergencies, the first step should always be to call emergency services if callEmergency is true.

Do not include any text outside the JSON. Do not use markdown formatting inside the JSON strings.`;

router.post("/chat/message", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, sessionId, latitude, longitude } = parsed.data;

  req.log.info({ sessionId }, "Processing chat message");

  const locationContext =
    latitude != null && longitude != null
      ? ` (User location available: ${latitude}, ${longitude})`
      : "";

  const completion = await openai.chat.completions.create({
    model: "gpt-5.2",
    max_completion_tokens: 8192,
    messages: [
      {
        role: "system",
        content: SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `${message}${locationContext}`,
      },
    ],
  });

  const rawContent = completion.choices[0]?.message?.content ?? "{}";

  let parsed2: {
    response: string;
    isEmergency: boolean;
    emergencyLevel: "low" | "moderate" | "high" | "critical";
    steps: string[];
    callEmergency: boolean;
  };

  try {
    parsed2 = JSON.parse(rawContent);
  } catch {
    req.log.error({ rawContent }, "Failed to parse AI response as JSON");
    parsed2 = {
      response:
        "I'm here to help. Please describe the emergency or injury and I'll guide you through the steps.",
      isEmergency: false,
      emergencyLevel: "low",
      steps: [],
      callEmergency: false,
    };
  }

  const responsePayload = {
    response: parsed2.response ?? "",
    isEmergency: parsed2.isEmergency ?? false,
    emergencyLevel: parsed2.emergencyLevel ?? "low",
    steps: Array.isArray(parsed2.steps) ? parsed2.steps : [],
    sessionId,
    callEmergency: parsed2.callEmergency ?? false,
    nearbyHospitals: undefined as
      | Array<{
          name: string;
          address: string;
          distance: string;
          phone?: string;
          latitude?: number;
          longitude?: number;
        }>
      | undefined,
  };

  if (
    parsed2.emergencyLevel === "critical" &&
    latitude != null &&
    longitude != null
  ) {
    const hospitals = getNearbyHospitalsMock(latitude, longitude);
    responsePayload.nearbyHospitals = hospitals;
  }

  const validated = SendMessageResponse.safeParse(responsePayload);
  if (!validated.success) {
    req.log.warn(
      { error: validated.error.message },
      "Response validation warning"
    );
    res.json(responsePayload);
    return;
  }

  res.json(validated.data);
});

function getNearbyHospitalsMock(
  lat: number,
  lng: number
): Array<{
  name: string;
  address: string;
  distance: string;
  phone?: string;
  latitude: number;
  longitude: number;
}> {
  const offsets = [
    {
      name: "City General Hospital",
      address: "123 Main Street, City Center",
      phone: "555-0100",
      dlat: 0.012,
      dlng: 0.008,
    },
    {
      name: "St. Mary Medical Center",
      address: "456 Oak Avenue, Westside",
      phone: "555-0200",
      dlat: -0.018,
      dlng: 0.015,
    },
    {
      name: "Memorial Emergency Hospital",
      address: "789 Park Blvd, North District",
      phone: "555-0300",
      dlat: 0.025,
      dlng: -0.01,
    },
  ];

  return offsets.map((h, i) => {
    const distKm = Math.round(
      Math.sqrt(Math.pow(h.dlat * 111, 2) + Math.pow(h.dlng * 111, 2)) * 10
    ) / 10;
    return {
      name: h.name,
      address: h.address,
      distance: `${distKm} km away`,
      phone: h.phone,
      latitude: lat + h.dlat,
      longitude: lng + h.dlng,
    };
  });
}

export default router;
