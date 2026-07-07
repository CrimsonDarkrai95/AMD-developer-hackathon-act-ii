// frontend/src/app/api/analyze/[patientId]/stream/route.ts
export async function GET(
  request: Request,
  { params }: { params: { patientId: string } }
) {
  const backendBaseUrl = process.env.BACKEND_BASE_URL || "http://localhost:8000";
  const backendResponse = await fetch(
    `${backendBaseUrl}/api/analyze/${params.patientId}/stream`
  );

  if (!backendResponse.ok || !backendResponse.body) {
    return new Response("Failed to reach backend stream", { status: 502 });
  }

  // Pass through the backend SSE stream to the Next.js client
  return new Response(backendResponse.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
