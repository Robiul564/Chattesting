import express from "express";
import { conversationRouter } from "./routes/conversations";
import { webhookRouter } from "./routes/webhooks";

export const app = express();

app.use(
  express.json({
    verify: (req, _res, buf) => {
      (req as any).rawBody = Buffer.from(buf);
    },
  }),
);

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/webhooks", webhookRouter);
app.use("/api/conversations", conversationRouter);
