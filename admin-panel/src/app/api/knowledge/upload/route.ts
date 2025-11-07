import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    
    // Forward the form data to the backend
    const response = await fetch(`${BACKEND_URL}/api/knowledge/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Backend responded with ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error uploading files:', error);
    return NextResponse.json(
      { 
        error: 'Failed to upload files',
        stats: {
          total: 0,
          successful: 0,
          failed: 0,
          errors: [error instanceof Error ? error.message : 'Unknown error']
        }
      },
      { status: 500 }
    );
  }
}