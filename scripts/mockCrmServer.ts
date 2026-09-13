import http from "http";
import { verifyCrmSignature } from "../src/server/crm/signature";

// Local stand-in for the MCNA CRM: receives LMS webhooks, checks their signature and prints them.
// Usage:
//   CRM_WEBHOOK_SECRET=dev-secret npx tsx scripts/mockCrmServer.ts
//   then start the LMS with CRM_WEBHOOK_URL=http://localhost:4100/webhooks/lms and the same CRM_WEBHOOK_SECRET.
// MOCK_CRM_FAIL_FIRST=N answers the first N webhooks with 503 to exercise the LMS retry path.
// GET /events returns the distinct events received so far (used by scripts/e2eSignupCrmFlow.ts).

const port = Number(process.env.MOCK_CRM_PORT || 4100);
const secret = process.env.CRM_WEBHOOK_SECRET;
if (!secret) throw new Error("CRM_WEBHOOK_SECRET is required.");
const failFirst = Number(process.env.MOCK_CRM_FAIL_FIRST || 0);

const header = (req: http.IncomingMessage, name: string) => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

let deliveries = 0;
const events: any[] = [];
const seenIds = new Set<string>();

http.createServer((req, res) => {
  if (req.method === "GET" && req.url === "/events") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify(events));
    return;
  }
  if (req.method !== "POST" || req.url !== "/webhooks/lms") {
    res.writeHead(404);
    res.end();
    return;
  }

  const chunks: Buffer[] = [];
  req.on("data", chunk => chunks.push(chunk));
  req.on("end", () => {
    const body = Buffer.concat(chunks).toString("utf8");
    deliveries++;
    if (deliveries <= failFirst) {
      console.log(`[mock-crm] simulating outage (${deliveries}/${failFirst})`);
      res.writeHead(503);
      res.end();
      return;
    }

    const failure = verifyCrmSignature(secret, header(req, "x-lms-timestamp"), header(req, "x-lms-signature"), body, 300);
    if (failure) {
      console.warn("[mock-crm] rejected webhook:", failure.error);
      res.writeHead(failure.status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: failure.error }));
      return;
    }

    const event = JSON.parse(body);
    const duplicate = seenIds.has(event.id);
    seenIds.add(event.id);
    if (!duplicate) events.push(event);
    console.log(`[mock-crm] ${duplicate ? "duplicate " : ""}${event.type} origin=${event.origin}`, JSON.stringify(event.data));
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
  });
}).listen(port, () => console.log(`[mock-crm] listening on http://localhost:${port}/webhooks/lms`));
