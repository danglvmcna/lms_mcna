import { Pool } from "pg";
import { generateId } from "./ids";

export type EventType =
  | "grade.saved"
  | "attendance.session.saved"
  | "registration.dropped"
  | "user.created";

type Handler<T = any> = (payload: T, pool: Pool) => Promise<void>;

class EventBus {
  private listeners: Map<EventType, Handler[]> = new Map();

  on<T>(event: EventType, handler: Handler<T>) {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(handler as Handler);
  }

  async emit<T>(event: EventType, payload: T, pool: Pool) {
    // Automatically log event to database
    try {
      const eventId = generateId("evt");
      const triggeredAt = new Date().toISOString();
      const payloadJson = JSON.stringify(payload || {});
      await pool.query(
        `INSERT INTO system_events (id, type, payload, triggered_at, processed)
         VALUES ($1, $2, $3, $4, $5)`,
        [eventId, event, payloadJson, triggeredAt, false]
      );
    } catch (err) {
      console.error(`[EventBus] Failed to log system event "${event}" to DB:`, err);
    }

    const handlers = this.listeners.get(event) || [];
    for (const handler of handlers) {
      try {
        await handler(payload, pool);
      } catch (err) {
        console.error(`[EventBus] Handler error for "${event}":`, err);
      }
    }
  }
}

export const eventBus = new EventBus();
