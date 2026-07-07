import { NextResponse } from 'next/server';

const backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const backendResponse = await fetch(`${backendBaseUrl}/api/patients`);

    if (!backendResponse.ok) {
      throw new Error(`Backend returned status ${backendResponse.status}`);
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reach the backend patient index.' },
      { status: 500 }
    );
  }
}
