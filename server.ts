import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import cors from "cors";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let stripe: Stripe | null = null;

const getStripe = () => {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error("STRIPE_SECRET_KEY is not defined in environment variables");
    }
    stripe = new Stripe(key);
  }
  return stripe;
};

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    }
  }));

  // API Routes
  app.post("/api/webhook", async (req: any, res) => {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event;

    try {
      const stripeClient = getStripe();
      if (endpointSecret && sig && req.rawBody) {
        event = stripeClient.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
      } else {
        event = req.body;
      }
    } catch (err: any) {
      console.error(`❌ Webhook Error: ${err.message}`);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    console.log(`🔔 Stripe Webhook recebido: Tipo do evento = ${event?.type}`);

    // Responder imediatamente com 200 OK para a Stripe para certificar taxa de entrega perfeita de 100%
    res.json({ received: true });
  });

  app.post("/api/create-checkout-session", async (req, res) => {
    try {
      const { priceId, customerEmail, origin } = req.body;
      console.log(`🔑 Recebida solicitação de checkout: priceId=${priceId}, email=${customerEmail}`);
      
      const stripeClient = getStripe();
      const baseDomain = origin || process.env.APP_URL || "http://localhost:3000";

      const session = await stripeClient.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${baseDomain}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseDomain}/cancel`,
        customer_email: customerEmail,
      });

      console.log(`✅ Sessão do Stripe criada com sucesso: ID=${session.id}`);
      res.json({ id: session.id, url: session.url });
    } catch (error: any) {
      console.error(`❌ Erro ao criar Checkout Session: ${error.message}`);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
