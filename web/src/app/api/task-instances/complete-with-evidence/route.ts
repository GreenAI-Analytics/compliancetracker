import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { validateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { rateLimitMiddleware } from "@/lib/rate-limit";
import { parseBody } from "@/lib/body-limit";

// Increase limit to 6 MB for base64-encoded file payloads (~4.5 MB actual file)
const MAX_BODY_BYTES = 6 * 1024 * 1024;

type CompleteWithEvidenceBody = {
  instanceId: string;
  fileName: string;
  fileType: string;
  fileData: string; // base64-encoded content
  notes?: string;
};

export async function POST(request: NextRequest) {
  // 1. CSRF protection
  const csrfCheck = validateCsrfToken(request);
  if (!csrfCheck.valid) {
    return NextResponse.json({ error: csrfCheck.error }, { status: 403 });
  }

  // 2. Authenticate user
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 3. Rate limit by user ID
  const rateCheck = rateLimitMiddleware(user.id);
  if (!rateCheck.allowed) {
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: { "Retry-After": String(rateCheck.retryAfterSeconds) },
      },
    );
  }

  // 4. Parse and validate the request body (with increased size limit)
  const parsed = await parseBody<CompleteWithEvidenceBody>(
    request,
    MAX_BODY_BYTES,
  );
  if (parsed.error) {
    return NextResponse.json(
      { error: parsed.error },
      { status: parsed.status ?? 400 },
    );
  }

  const { instanceId, fileName, fileType, fileData, notes } = parsed.data!;

  if (!instanceId || !fileName || !fileType || !fileData) {
    return NextResponse.json(
      { error: "instanceId, fileName, fileType, and fileData are required" },
      { status: 400 },
    );
  }

  // Validate file name (basic sanitization — prevent path traversal)
  if (
    fileName.includes("/") ||
    fileName.includes("\\") ||
    fileName.includes("..")
  ) {
    return NextResponse.json({ error: "Invalid file name" }, { status: 400 });
  }

  // Validate base64 string
  const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
  if (!base64Regex.test(fileData)) {
    return NextResponse.json(
      { error: "Invalid file data encoding" },
      { status: 400 },
    );
  }

  // 5. Use admin client for DB and storage operations
  //    (TODO: switch to server client once RLS is deployed)
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  try {
    // 6. Verify the task instance belongs to the authenticated user and get
    //    its organization_id and task details (including evidence_required)
    const { data: instance, error: instanceError } = await admin
      .from("user_task_instances")
      .select(
        `
        id,
        organization_id,
        status,
        tasks!inner (
          evidence_required
        )
      `,
      )
      .eq("id", instanceId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (instanceError) {
      console.error("Failed to fetch task instance:", instanceError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!instance) {
      return NextResponse.json(
        { error: "Task instance not found" },
        { status: 404 },
      );
    }

    const typedInstance = instance as {
      id: string;
      organization_id: string;
      status: string;
      tasks: { evidence_required: boolean }[];
    };

    const evidenceRequired =
      typedInstance.tasks.length > 0
        ? typedInstance.tasks[0].evidence_required
        : false;

    if (typedInstance.status === "completed") {
      return NextResponse.json(
        { error: "Task instance is already completed" },
        { status: 409 },
      );
    }

    // 7. Create the task_completion record
    const { data: completion, error: completionError } = await admin
      .from("task_completions")
      .insert({
        user_task_instance_id: instanceId,
        completed_by: user.id,
        notes: notes ?? null,
        evidence_required: evidenceRequired,
        evidence_submitted: true,
        completed_at: new Date().toISOString(),
      })
      .select("id")
      .maybeSingle();

    if (completionError || !completion) {
      console.error(
        "Failed to create task completion:",
        completionError?.message,
      );
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // 8. Decode base64 file data
    let fileBuffer: Buffer;
    try {
      fileBuffer = Buffer.from(fileData, "base64");
    } catch {
      return NextResponse.json(
        { error: "Failed to decode file data" },
        { status: 400 },
      );
    }

    const fileSize = fileBuffer.length;

    // 9. Upload file to Supabase Storage
    //    Path: {organization_id}/{task_instance_id}/{uuid}-{filename}
    const storageFileName = `${crypto.randomUUID()}-${fileName}`;
    const storagePath = `${typedInstance.organization_id}/${instanceId}/${storageFileName}`;

    const { error: uploadError } = await admin.storage
      .from("evidence")
      .upload(storagePath, fileBuffer, {
        contentType: fileType,
        upsert: false,
      });

    if (uploadError) {
      console.error("Failed to upload file to storage:", uploadError.message);
      // Clean up the task_completion record since evidence upload failed
      await admin.from("task_completions").delete().eq("id", completion.id);
      return NextResponse.json(
        { error: "Failed to upload evidence file" },
        { status: 500 },
      );
    }

    // 10. Create the evidence_attachment record
    const { data: attachment, error: attachmentError } = await admin
      .from("evidence_attachments")
      .insert({
        task_completion_id: completion.id,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        storage_path: storagePath,
        uploaded_by: user.id,
      })
      .select("id")
      .maybeSingle();

    if (attachmentError || !attachment) {
      console.error(
        "Failed to create evidence attachment:",
        attachmentError?.message,
      );
      // Clean up: remove the uploaded file and the completion record
      await admin.storage.from("evidence").remove([storagePath]);
      await admin.from("task_completions").delete().eq("id", completion.id);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // 11. Update the user_task_instance status to "completed"
    const { error: updateError } = await admin
      .from("user_task_instances")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", instanceId);

    if (updateError) {
      console.error(
        "Failed to update task instance status:",
        updateError.message,
      );
      // Non-fatal — the completion + evidence are already recorded.
      // Log and continue to return a partial success.
    }

    // 12. Return success response with rotated CSRF token
    const response = NextResponse.json({
      ok: true,
      completionId: completion.id,
      attachmentId: attachment.id,
    });
    setCsrfCookie(response);
    return response;
  } catch (err) {
    console.error("Unexpected error in complete-with-evidence:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
