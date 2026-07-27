import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

export const dynamic = 'force-dynamic';

const workspaceDir = 'C:\\Users\\dgtll\\OneDrive\\Documents\\ACCOUNTS.DGT.LLC';
const tempBaseDir = 'C:\\tmp\\recovery_zips_extracted';

const zipSources = [
  { name: 'ACCOUNTS.DGT.LLC-main.zip', path: 'C:\\Users\\dgtll\\OneDrive\\Desktop\\cods\\ACCOUNTS.DGT.LLC-main.zip' },
  { name: 'dht-nextjs-main.zip', path: 'C:\\Users\\dgtll\\OneDrive\\Desktop\\cods\\dht-nextjs-main.zip' },
  { name: 'vigilant-adventure-main.zip', path: 'C:\\Users\\dgtll\\OneDrive\\Desktop\\cods\\vigilant-adventure-main.zip' }
];

function hashFile(filePath: string) {
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return null;
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function cleanRelPath(p: string): string {
  const normalized = p.replace(/\\/g, '/');
  // Strip top level folder prefix like ACCOUNTS.DGT.LLC-main/ or dht-nextjs-main/ or vigilant-adventure-main/
  return normalized.replace(/^(?:ACCOUNTS\.DGT\.LLC-main|dht-nextjs-main|vigilant-adventure-main)\//, '');
}

function getRelativeFiles(dirPath: string, currentDir = '', fileList: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return fileList;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const relPath = path.join(currentDir, entry.name);
    const fullPath = path.join(dirPath, entry.name);

    if (
      entry.name === '.git' ||
      entry.name === 'node_modules' ||
      entry.name === '.next' ||
      entry.name === '.vscode' ||
      entry.name === 'backups' ||
      entry.name === 'scratch' ||
      entry.name === '.tmp' ||
      entry.name === '_review-conflicts' ||
      entry.name.endsWith('.env') ||
      entry.name.endsWith('.env.local') ||
      entry.name.endsWith('.env.production')
    ) {
      continue;
    }

    if (entry.isDirectory()) {
      getRelativeFiles(fullPath, relPath, fileList);
    } else {
      fileList.push(cleanRelPath(relPath));
    }
  }
  return fileList;
}

export async function GET() {
  try {
    if (!fs.existsSync(tempBaseDir)) {
      fs.mkdirSync(tempBaseDir, { recursive: true });
    }

    const extractionLogs: string[] = [];

    zipSources.forEach((zip, index) => {
      const destDir = path.join(tempBaseDir, `zip_${index + 1}_${zip.name.replace(/\.zip$/i, '')}`);
      if (!fs.existsSync(destDir) || fs.readdirSync(destDir).length === 0) {
        fs.mkdirSync(destDir, { recursive: true });
        const psCmd = `powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '${zip.path}' -DestinationPath '${destDir}' -Force"`;
        try {
          execSync(psCmd);
          extractionLogs.push(`Extracted ${zip.name} successfully`);
        } catch (err: any) {
          extractionLogs.push(`Failed ${zip.name}: ${err.message}`);
        }
      } else {
        extractionLogs.push(`Already extracted ${zip.name}`);
      }
    });

    const mainFiles = getRelativeFiles(workspaceDir);

    const zipExtractions = zipSources.map((zip, index) => {
      const destDir = path.join(tempBaseDir, `zip_${index + 1}_${zip.name.replace(/\.zip$/i, '')}`);
      const files = getRelativeFiles(destDir);
      return {
        name: zip.name,
        rootDir: destDir,
        files
      };
    });

    const zipFileMap = new Map<string, Array<{ zipName: string; fullPath: string; hash: string | null; size: number; mtime: Date }>>();

    zipExtractions.forEach(extraction => {
      extraction.files.forEach(relPath => {
        // Construct full path safely
        let fullPath = path.join(extraction.rootDir, relPath);
        if (!fs.existsSync(fullPath)) {
          // Check if it was nested under top-level folder name
          const contents = fs.readdirSync(extraction.rootDir);
          if (contents.length > 0) {
            fullPath = path.join(extraction.rootDir, contents[0], relPath);
          }
        }

        if (fs.existsSync(fullPath) && !fs.statSync(fullPath).isDirectory()) {
          const hash = hashFile(fullPath);
          const stat = fs.statSync(fullPath);

          if (!zipFileMap.has(relPath)) {
            zipFileMap.set(relPath, []);
          }
          zipFileMap.get(relPath)!.push({
            zipName: extraction.name,
            fullPath,
            hash,
            size: stat.size,
            mtime: stat.mtime
          });
        }
      });
    });

    const missingInMain: Array<{ relPath: string; zipVersions: any[] }> = [];
    const truncatedInMain: Array<{ relPath: string; mainSize: number; zipVersions: any[] }> = [];
    const differentInMain: Array<{ relPath: string; mainSize: number; zipVersions: any[] }> = [];
    const identical: string[] = [];

    zipFileMap.forEach((zipVersions, relPath) => {
      const mainFullPath = path.join(workspaceDir, relPath);
      const existsInMain = fs.existsSync(mainFullPath);

      if (!existsInMain) {
        missingInMain.push({ relPath, zipVersions });
      } else {
        const mainHash = hashFile(mainFullPath);
        const mainStat = fs.statSync(mainFullPath);

        const matchingZip = zipVersions.find(v => v.hash === mainHash);
        if (matchingZip) {
          identical.push(relPath);
        } else {
          const isTruncated = mainStat.size === 0 || zipVersions.some(v => v.size > mainStat.size * 2 && mainStat.size < 500);
          if (isTruncated) {
            truncatedInMain.push({ relPath, mainSize: mainStat.size, zipVersions });
          } else {
            differentInMain.push({ relPath, mainSize: mainStat.size, zipVersions });
          }
        }
      }
    });

    const mainOnly: string[] = [];
    mainFiles.forEach(relPath => {
      if (!zipFileMap.has(relPath)) {
        mainOnly.push(relPath);
      }
    });

    const missingErpCode = missingInMain.filter(m => 
      m.relPath.startsWith('app/') ||
      m.relPath.startsWith('components/') ||
      m.relPath.startsWith('features/') ||
      m.relPath.startsWith('lib/') ||
      m.relPath.startsWith('hooks/') ||
      m.relPath.startsWith('services/') ||
      m.relPath.startsWith('routes/') ||
      m.relPath.startsWith('public/') ||
      m.relPath.startsWith('supabase/')
    );

    const reportData = {
      timestamp: new Date().toISOString(),
      extractionLogs,
      counts: {
        totalUniqueInZips: zipFileMap.size,
        totalInMain: mainFiles.length,
        missingInMain: missingInMain.length,
        missingErpCodeCount: missingErpCode.length,
        truncatedInMain: truncatedInMain.length,
        differentInMain: differentInMain.length,
        identical: identical.length,
        mainOnly: mainOnly.length
      },
      missingErpCode,
      missingInMain,
      truncatedInMain,
      differentInMain
    };

    const reportPath = path.join(workspaceDir, 'docs', 'RECOVERY_COMPARISON_DATA.json');
    if (!fs.existsSync(path.dirname(reportPath))) {
      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    }
    fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));

    return NextResponse.json({ success: true, reportData });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message, stack: err.stack }, { status: 500 });
  }
}
