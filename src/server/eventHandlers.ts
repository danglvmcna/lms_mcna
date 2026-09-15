import { eventBus } from "./eventBus";
import { notifyStudent } from "./notify";
import { provisioningService } from "./emailProvisioning/provisioningService";
import { auditRepository } from "./repositories/audit";

export function registerEventHandlers() {
  eventBus.on("grade.saved", async ({ studentId, courseRegistrationId, grade }, pool) => {
    await notifyStudent(pool, studentId, `Điểm số mới đã được công bố: ${grade}`, { relatedEntityType: "course_registration", relatedEntityId: courseRegistrationId });
  });

  eventBus.on("user.created", async (user: any, pool) => {
    if (user.role !== "student") return;
    // Self-registered and CRM-created learners sign in with their personal email; no school mailbox.
    if (user.signupSource && user.signupSource !== "admin") return;
    try {
      await provisioningService.provisionStudentEmail(pool, user.id);
    } catch (err: any) {
      console.error("[email-provisioning] failed for", user.id, err);
      try {
        await auditRepository.log(
          pool,
          user.id,
          "email_provisioning_failed",
          "email",
          String(err.message || err)
        );
      } catch (logErr) {
        console.error("[email-provisioning] failed to log audit error:", logErr);
      }
    }
  });
}
