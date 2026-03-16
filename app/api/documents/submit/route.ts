import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
} from "docx";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type SubmitPayload = {
  user_id: string;
  document_type: string;
  project_name: string;
  form_data: Record<string, unknown>;
};

function valueOf(input: unknown): string {
  if (input === null || input === undefined) return "N/A";
  if (Array.isArray(input)) return input.join(", ");
  if (typeof input === "object") return JSON.stringify(input);
  return String(input);
}

function buildPshsepDoc(projectName: string, formData: Record<string, unknown>) {
  return new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            heading: HeadingLevel.TITLE,
            children: [
              new TextRun({
                text: "Project Safety & Health Execution Plan",
                bold: true,
                size: 32,
              }),
            ],
            spacing: { after: 300 },
          }),

          new Paragraph({
            children: [
              new TextRun({
                text: `Project: ${projectName || "Untitled Project"}`,
                bold: true,
                size: 24,
              }),
            ],
            spacing: { after: 200 },
          }),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "Project Information",
            spacing: { before: 200, after: 120 },
          }),
          new Paragraph(`Project Name: ${valueOf(formData.project_name)}`),
          new Paragraph(`Project Address: ${valueOf(formData.project_address)}`),
          new Paragraph(
            `Project Description: ${valueOf(formData.project_description)}`
          ),
          new Paragraph(`Owner / Client: ${valueOf(formData.owner_client)}`),
          new Paragraph(`GC / CM: ${valueOf(formData.gc_cm)}`),
          new Paragraph(
            `GC Safety Contact: ${valueOf(formData.gc_safety_contact)}`
          ),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "Contractor Information",
            spacing: { before: 200, after: 120 },
          }),
          new Paragraph(
            `Contractor Company: ${valueOf(formData.contractor_company)}`
          ),
          new Paragraph(
            `Contractor Address: ${valueOf(formData.contractor_address)}`
          ),
          new Paragraph(
            `Contractor Phone: ${valueOf(formData.contractor_phone)}`
          ),
          new Paragraph(
            `Contractor Email: ${valueOf(formData.contractor_email)}`
          ),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "Plan Approval",
            spacing: { before: 200, after: 120 },
          }),
          new Paragraph(`Plan Author: ${valueOf(formData.plan_author)}`),
          new Paragraph(
            `Plan Author Title: ${valueOf(formData.plan_author_title)}`
          ),
          new Paragraph(`Approval Name: ${valueOf(formData.approval_name)}`),
          new Paragraph(`Approval Title: ${valueOf(formData.approval_title)}`),
          new Paragraph(`Approval Date: ${valueOf(formData.approval_date)}`),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "Work Scope",
            spacing: { before: 200, after: 120 },
          }),
          new Paragraph(`Scope of Work: ${valueOf(formData.scope_of_work)}`),
          new Paragraph(`Max Headcount: ${valueOf(formData.max_headcount)}`),
          new Paragraph(`Trades Involved: ${valueOf(formData.trades_involved)}`),

          new Paragraph({
            heading: HeadingLevel.HEADING_1,
            text: "Submitted Form Data",
            spacing: { before: 200, after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: JSON.stringify(formData, null, 2),
                size: 18,
              }),
            ],
          }),
        ],
      },
    ],
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as SubmitPayload;

    const { user_id, document_type, project_name, form_data } = body;

    if (!user_id || !document_type || !project_name || !form_data) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    const { data: insertedDoc, error: insertError } = await supabase
      .from("documents")
      .insert({
        user_id,
        document_type,
        project_name,
        status: "submitted",
        form_data,
      })
      .select("id")
      .single();

    if (insertError || !insertedDoc) {
      return NextResponse.json(
        { error: insertError?.message || "Failed to create document row." },
        { status: 500 }
      );
    }

    const doc = buildPshsepDoc(project_name, form_data);
    const buffer = await Packer.toBuffer(doc);

    const safeProjectName = project_name.replace(/[^a-zA-Z0-9-_]/g, "_");
    const filePath = `drafts/${user_id}/${insertedDoc.id}/${safeProjectName}_Draft.docx`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, buffer, {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      await supabase.from("documents").delete().eq("id", insertedDoc.id);

      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 }
      );
    }

    const { error: updateError } = await supabase
      .from("documents")
      .update({
        draft_file_path: filePath,
        updated_at: new Date().toISOString(),
      })
      .eq("id", insertedDoc.id);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      document_id: insertedDoc.id,
      draft_file_path: filePath,
    });
  } catch (error) {
    console.error("Submit route error:", error);

    return NextResponse.json(
      { error: "Unexpected server error." },
      { status: 500 }
    );
  }
}