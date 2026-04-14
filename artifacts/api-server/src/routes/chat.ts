import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const systemPrompt = `
You are a FIRST AID assistant.

When a user describes an injury:
- Give clear step-by-step first aid instructions
- Be direct and practical
- Use numbered steps
- Do NOT ask unnecessary questions
- Always prioritize safety

Example:
Burn:
1. Cool the burn with running water for 10–20 minutes
2. Remove tight items
3. Cover with clean cloth
4. Do not apply ice or butter
5. Seek medical help if severe
`;

router.post("/chat/message", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, sessionId, latitude, longitude, history, locationText } = parsed.data;

  const hasGps = latitude != null && longitude != null;
  const hasLocationText = typeof locationText === "string" && locationText.trim().length > 0;

  req.log.info(
    { sessionId, hasGps, hasLocationText },
    "Processing chat message"
  );

  const locationContext = hasGps
    ? `\n\n[User's GPS location is available for hospital referral if needed.]`
    : hasLocationText
    ? `\n\n[User's general area: ${locationText}. Use this for hospital referral if needed.]`
    : "";

  const conversationMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: SYSTEM_PROMPT },
  ];

  if (history && history.length > 0) {
    const recentHistory = history.slice(-10);
    for (const turn of recentHistory) {
      conversationMessages.push({
        role: turn.role as "user" | "assistant",
        content: turn.content,
      });
    }
  }

  conversationMessages.push({
    role: "user",
    content: `${message}${locationContext}`,
  });

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    max_completion_tokens: 8192,
    messages: conversationMessages,
  });

  const rawContent = completion.choices[0]?.message?.content ?? "{}";

  let parsed2: {
    response: string;
    isEmergency: boolean;
    emergencyLevel: "low" | "moderate" | "high" | "critical";
    steps: string[];
    callEmergency: boolean;
    isNewIncident: boolean;
  };

  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    parsed2 = JSON.parse(jsonMatch ? jsonMatch[0] : rawContent);
  } catch {
    req.log.error({ rawContent }, "Failed to parse AI response as JSON");
    parsed2 = {
      response: "I'm here to help. Could you tell me more about what happened?",
      isEmergency: false,
      emergencyLevel: "low",
      steps: [],
      callEmergency: false,
      isNewIncident: false,
    };
  }

  const emergencyLevel = parsed2.emergencyLevel ?? "low";
  const callEmergency = emergencyLevel === "critical" ? (parsed2.callEmergency ?? true) : false;

  const responsePayload = {
    response: parsed2.response ?? "",
    isEmergency: parsed2.isEmergency ?? false,
    emergencyLevel,
    steps: Array.isArray(parsed2.steps) ? parsed2.steps : [],
    sessionId,
    callEmergency,
    isNewIncident: parsed2.isNewIncident ?? false,
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

  if (emergencyLevel === "critical") {
    if (hasGps && latitude != null && longitude != null) {
      responsePayload.nearbyHospitals = getNearbyHospitalsMock(latitude, longitude, undefined);
    } else if (hasLocationText && locationText) {
      responsePayload.nearbyHospitals = getNearbyHospitalsMock(null, null, locationText.trim());
    }
  }

  const validated = SendMessageResponse.safeParse(responsePayload);
  if (!validated.success) {
    req.log.warn({ error: validated.error.message }, "Response validation warning");
    res.json(responsePayload);
    return;
  }

  res.json(validated.data);
});

function getNearbyHospitalsMock(
  lat: number | null,
  lng: number | null,
  locationText: string | undefined
): Array<{
  name: string;
  address: string;
  distance: string;
  phone?: string;
  latitude?: number;
  longitude?: number;
}> {
  const area = locationText ?? "City Centre";

  if (lat != null && lng != null) {
    const offsets = [
      { name: `${area} General Hospital`, address: `123 Main Street, ${area}`, phone: "0800 555 0100", dlat: 0.012, dlng: 0.008 },
      { name: "St. Mary's Medical Centre", address: `456 Oak Avenue, ${area}`, phone: "0800 555 0200", dlat: -0.018, dlng: 0.015 },
      { name: "Memorial Emergency Hospital", address: `789 Park Boulevard, ${area}`, phone: "0800 555 0300", dlat: 0.025, dlng: -0.01 },
    ];
    return offsets.map((h) => {
      const distKm = Math.round(Math.sqrt(Math.pow(h.dlat * 111, 2) + Math.pow(h.dlng * 111, 2)) * 10) / 10;
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

  // Text-based fallback — approximate distances
  return [
    { name: `${area} General Hospital`, address: `Main Street, ${area}`, distance: "1.2 km away", phone: "0800 555 0100" },
    { name: `${area} St. Mary's Medical Centre`, address: `Oak Avenue, ${area}`, distance: "2.1 km away", phone: "0800 555 0200" },
    { name: `${area} Memorial Emergency`, address: `Park Boulevard, ${area}`, distance: "3.4 km away", phone: "0800 555 0300" },
  ];
}

export default router;
