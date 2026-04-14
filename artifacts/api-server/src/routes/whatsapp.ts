import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.get("/webhook/whatsapp", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

router.post("/webhook/whatsapp", async (req, res) => {
  try {
    const entry = req.body?.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;
    const message = value?.messages?.[0];

    if (!message) {
      return res.sendStatus(200);
    }

const from = message.from;
const text = message.text?.body;

if (!from || !text) {
  return res.sendStatus(200);
}

const chatResponse = await fetch(
  `${process.env.PUBLIC_BASE_URL}/api/chat/message`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message: text,
      sessionId: from,
    }),
  }
);

const aiData = await chatResponse.json();
const replyText =
  aiData?.response ?? "Hello Lily 👋 your bot is working!";

const whatsappResponse = await fetch(
  `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: from,
      type: "text",
      text: {
        body: replyText,
      },
    }),
  }
);

const whatsappData = await whatsappResponse.json();
console.log("WhatsApp send status:", whatsappResponse.status);
console.log("WhatsApp send response:", JSON.stringify(whatsappData));

return res.sendStatus(200);

    const chatResponse = await fetch(
      `${process.env.PUBLIC_BASE_URL}/api/chat/message`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: text,
          sessionId: from,
        }),
      }
    );

    const aiData = await chatResponse.json();
    const replyText =
      aiData?.response ??
      "I received your message, but I could not generate a reply.";

    await fetch(
      `https://graph.facebook.com/v25.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: from,
          type: "text",
          text: {
            body: replyText,
          },
        }),
      }
    );

    return res.sendStatus(200);
  } catch (error) {
    console.error("WhatsApp webhook error:", error);
    return res.sendStatus(500);
  }
});

export default router;
