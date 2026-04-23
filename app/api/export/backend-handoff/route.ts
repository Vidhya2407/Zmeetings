import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), 'docs', 'BACKEND_HANDOFF.md');
    const content = await readFile(filePath, 'utf8');

    return new NextResponse(content, {
      headers: {
        'Cache-Control': 'no-store',
        'Content-Disposition':
          'attachment; filename="zmeetings-backend-handoff.md"',
        'Content-Type': 'text/markdown; charset=utf-8',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'Backend handoff document is not available.' },
      { status: 404 },
    );
  }
}
