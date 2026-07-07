import { NextResponse } from 'next/server';

const backendBaseUrl = process.env.BACKEND_BASE_URL || 'http://localhost:8000';

export async function GET() {
  try {
    const backendResponse = await fetch(`${backendBaseUrl}/api/status`, {
      cache: 'no-store'
    });

    if (!backendResponse.ok) {
      throw new Error(`Backend status returned ${backendResponse.status}`);
    }

    const data = await backendResponse.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to reach the backend status.' },
      { status: 500 }
    );
  }
}
