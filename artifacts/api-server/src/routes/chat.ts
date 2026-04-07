import { Router, type IRouter } from "express";
import { openai } from "@workspace/integrations-openai-ai-server";
import { SendMessageBody, SendMessageResponse } from "@workspace/api-zod";

const router: IRouter = Router();

const SYSTEM_PROMPT = `You are ResQ, a calm, empathetic first aid assistant. You help people manage injuries and medical situations using clear, step-by-step guidance in plain everyday language.

YOUR CORE BEHAVIOUR:

1. UNDERSTAND NATURAL LANGUAGE
   - Users describe situations in everyday language under stress. Understand what they mean, even if it is imprecise (e.g. "someone fell and their arm looks wrong" = possible fracture).
   - Never ask users to use medical terminology.

2. CLASSIFY SEVERITY
   - low: Minor cuts, small scrapes, mild bruising, splinters, insect bites, mild headache
   - moderate: Sprains, minor burns (small area, not on face/hands/feet), moderate bleeding that is controllable, possible mild concussion
   - high: Broken bones, head injuries, large or deep burns, heavy bleeding, dislocations, suspected poisoning/overdose
   - critical: Cardiac arrest, unresponsiveness, no pulse or not breathing, severe anaphylaxis (throat closing), active choking (cannot speak/breathe), massive uncontrolled blood loss, suspected stroke (face drooping, arm weakness, speech difficulty), severe head trauma, drowning

3. PROVIDE GUIDANCE
   - Always give immediate, numbered first aid steps (3-8 steps). Keep each step short and action-oriented.
   - Be warm, calm, and reassuring. The person may be frightened.
   - Use simple words. No medical jargon.
   - Never diagnose a condition — only guide on what to do right now.

4. EMERGENCY RULES (CRITICAL ONLY)
   - If and ONLY IF emergencyLevel is "critical": set callEmergency to true.
   - For all other severity levels (low, moderate, high): set callEmergency to false. Do NOT suggest calling 999 for non-critical cases.
   - The emergency number is 999 (UK). Reference it only when callEmergency is true.

5. HOSPITAL REFERRAL
   - Only recommend going to hospital or A&E in the response text for critical and high cases.
   - For low and moderate cases, focus purely on first aid steps. Do not mention hospital.

6. CONVERSATION CONTINUITY
   - Review the conversation history provided. If the user's new message is a follow-up question or update about the same incident (e.g. "what if it's still bleeding?", "they're now conscious"), set isNewIncident to false and continue helping.
   - If the user clearly describes a completely different emergency or new situation, set isNewIncident to true.
   - When in doubt, treat it as a continuation (isNewIncident: false).

7. DISCLAIMER
   - Never explicitly add a disclaimer in the response text — the UI handles this separately.

Always respond with ONLY valid JSON, no markdown, no extra text:
{
  "response": "Warm, empathetic 1-2 sentence summary addressing what the user described",
  "isEmergency": true or false,
  "emergencyLevel": "low" | "moderate" | "high" | "critical",
  "steps": ["action-oriented step", "..."],
  "callEmergency": true or false (only true when emergencyLevel is critical),
  "isNewIncident": true or false
}`;

router.post("/chat/message", async (req, res): Promise<void> => {
  const parsed = SendMessageBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { message, sessionId, latitude, longitude, history } = parsed.data;

  req.log.info({ sessionId, hasLocation: latitude != null }, "Processing chat message");

  const locationContext =
    latitude != null && longitude != null
      ? `\n\n[User's location is available for hospital referral if needed.]`
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
    model: "gpt-5.2",
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

  if (emergencyLevel === "critical" && latitude != null && longitude != null) {
    responsePayload.nearbyHospitals = getNearbyHospitalsMock(latitude, longitude);
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
    { name: "City General Hospital", address: "123 Main Street, City Centre", phone: "0800 555 0100", dlat: 0.012, dlng: 0.008 },
    { name: "St. Mary's Medical Centre", address: "456 Oak Avenue, Westside", phone: "0800 555 0200", dlat: -0.018, dlng: 0.015 },
    { name: "Memorial Emergency Hospital", address: "789 Park Boulevard, North District", phone: "0800 555 0300", dlat: 0.025, dlng: -0.01 },
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

export default router;
