import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/task-instances/evidence?taskInstanceId=<uuid>
 *
 * Returns the evidence attachments for a given task instance.
 * Only the owner of the task instance can view its evidence.
 */
export async function GET(request: NextRequest) {
  // 1. Authenticate user
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Extract and validate query parameter
  const { searchParams } = new URL(request.url);
  const taskInstanceId = searchParams.get("taskInstanceId");

  if (!taskInstanceId) {
    return NextResponse.json(
      { error: "taskInstanceId query parameter is required" },
      { status: 400 },
    );
  }

  // 3. Use admin client for DB operations
  //    (TODO: switch to server client once RLS is deployed)
  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 },
    );
  }

  try {
    // 4. Verify the task instance belongs to the authenticated user
    const { data: instance, error: instanceError } = await admin
      .from("user_task_instances")
      .select("id")
      .eq("id", taskInstanceId)
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

    // 5. Fetch task_completions for this instance, then their evidence attachments
    const { data: completions, error: completionsError } = await admin
      .from("task_completions")
      .select("id")
      .eq("user_task_instance_id", taskInstanceId);

    if (completionsError) {
      console.error("Failed to fetch completions:", completionsError.message);
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    if (!completions || completions.length === 0) {
      return NextResponse.json({ attachments: [] });
    }

    const completionIds = completions.map((c: { id: string }) => c.id);

    // 6. Fetch evidence attachments for all completions, ordered by upload time
    const { data: attachments, error: attachmentsError } = await admin
      .from("evidence_attachments")
      .select(
        "id, file_name, file_type, file_size, storage_path, uploaded_at, verified",
      )
      .in("task_completion_id", completionIds)
      .order("uploaded_at", { ascending: false });

    if (attachmentsError) {
      console.error(
        "Failed to fetch evidence attachments:",
        attachmentsError.message,
      );
      return NextResponse.json({ error: "Database error" }, { status: 500 });
    }

    // 7. Generate signed URLs for each attachment (valid for 1 hour)
    const attachmentsWithUrls = await Promise.all(
      (attachments ?? []).map(async (att: {
        id: string;
        file_name: string;
        file_type: string | null;
        file_size: number | null;
        storage_path: string;
        uploaded_at: string | null;
        verified: boolean | null;
      }) => {
        const { data: signedUrlData } = await admin.storage
          .from("evidence")
          .createSignedUrl(att.storage_path, 3600); // 1 hour expiry

        return {
          id: att.id,
          fileName: att.file_name,
          fileType: att.file_type,
          fileSize: att.file_size,
          uploadedAt: att.uploaded_at,
          verified: att.verified,
          downloadUrl: signedUrlData?.signedUrl ?? null,
        };
      }),
    );

    return NextResponse.json({ attachments: attachmentsWithUrls });
  } catch (err) {
    console.error("Unexpected error in evidence GET:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
