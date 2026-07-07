// frontend/src/app/api/report/[patientId]/route.ts
import { NextResponse } from 'next/server';

export async function POST(
  request: Request,
  { params }: { params: { patientId: string } }
) {
  try {
    const analysisPayload = await request.json();
    const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:8000";

    const backendResponse = await fetch(
      `${backendBaseUrl}/api/report/${params.patientId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(analysisPayload),
      }
    );

    if (!backendResponse.ok) {
      throw new Error(`Backend report endpoint returned ${backendResponse.status}`);
    }

    const reportData = await backendResponse.json();
    return NextResponse.json(reportData);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed generating brief report.' },
      { status: 500 }
    );
  }
}
