import { NextRequest, NextResponse } from "next/server";
import { convertProjectToPng, Ratio } from "@/lib/convert";

export async function POST(req: NextRequest) {
  const { projectName, ratio, scale } = await req.json();

  try {
    const files = await convertProjectToPng(projectName, ratio as Ratio, scale ?? 1);
    return NextResponse.json({ success: true, files });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
