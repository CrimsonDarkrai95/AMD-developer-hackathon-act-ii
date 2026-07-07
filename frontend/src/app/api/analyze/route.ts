import { NextResponse } from 'next/server';

const backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8000';

export async function POST(request: Request) {
  try {
    const { patientId } = await request.json();

    const backendResponse = await fetch(`${backendBaseUrl}/api/analyze/${patientId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!backendResponse.ok) {
      throw new Error(`Python engine returned status error: ${backendResponse.status}`);
    }

    const reportData = await backendResponse.json();
    return NextResponse.json(reportData);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed connecting to execution core.' },
      { status: 500 }
    );
  }
}