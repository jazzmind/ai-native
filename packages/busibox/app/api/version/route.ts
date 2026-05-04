import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET() {
  try {
    const versionFilePath = join(process.cwd(), '.deployed-version');
    try {
      const content = await readFile(versionFilePath, 'utf-8');
      const info = JSON.parse(content);
      return NextResponse.json({
        success: true,
        data: { ...info, shortCommit: info.commit ? info.commit.substring(0, 7) : 'unknown' },
      });
    } catch {
      return NextResponse.json({
        success: true,
        data: {
          type: 'development',
          branch: 'local',
          commit: 'development',
          shortCommit: 'dev',
          deployed_at: null,
          deployed_by: 'local',
        },
      });
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get version info';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
