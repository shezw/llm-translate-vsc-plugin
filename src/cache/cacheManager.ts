import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

import { getSettings } from '../config';
import { getTranslationPlan } from '../translation/fileClassifier';

interface HashPayload {
  sourceHash: string;
  sourceFile: string;
  relativePath: string;
  updatedAt: string;
}

export interface CacheArtifacts {
  cacheDir: string;
  cacheBaseName: string;
  hashFilePath: string;
  translatedFilePath: string;
  relativePath: string;
}

export function computeMd5(content: string): string {
  return crypto.createHash('md5').update(content, 'utf8').digest('hex');
}

export class CacheManager {
  async resolveArtifacts(sourceUri: vscode.Uri): Promise<CacheArtifacts> {
    const cacheRoot = expandHome(getSettings().cacheRoot);
    const userName = sanitizeSegment(os.userInfo().username || 'user');
    const cacheDir = path.join(cacheRoot, userName);
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(sourceUri);
    const relativePath = workspaceFolder
      ? path.relative(workspaceFolder.uri.fsPath, sourceUri.fsPath)
      : path.basename(sourceUri.fsPath);

    const parsedPath = path.parse(relativePath);
    const workspaceKey = sanitizeSegment(workspaceFolder?.uri.fsPath ?? path.dirname(sourceUri.fsPath));
    const fileKey = sanitizeSegment(path.join(parsedPath.dir, parsedPath.name) || parsedPath.name);
    const cacheBaseName = `${workspaceKey}_${fileKey}`;
    const extension = parsedPath.ext || getTranslationPlan(sourceUri.fsPath).extension || '.txt';

    return {
      cacheDir,
      cacheBaseName,
      hashFilePath: path.join(cacheDir, `${cacheBaseName}.hash`),
      translatedFilePath: path.join(cacheDir, `${cacheBaseName}_llm-trans${extension}`),
      relativePath
    };
  }

  async hasTranslation(sourceUri: vscode.Uri): Promise<boolean> {
    const artifacts = await this.resolveArtifacts(sourceUri);
    return pathExists(artifacts.translatedFilePath);
  }

  async readTranslation(sourceUri: vscode.Uri): Promise<string | undefined> {
    const artifacts = await this.resolveArtifacts(sourceUri);
    if (!(await pathExists(artifacts.translatedFilePath))) {
      return undefined;
    }

    return fs.readFile(artifacts.translatedFilePath, 'utf8');
  }

  async isUpToDate(sourceUri: vscode.Uri, sourceHash: string): Promise<boolean> {
    const artifacts = await this.resolveArtifacts(sourceUri);
    const hashPayload = await this.readHashPayload(artifacts.hashFilePath);
    if (!hashPayload) {
      return false;
    }

    if (!(await pathExists(artifacts.translatedFilePath))) {
      return false;
    }

    return hashPayload.sourceHash === sourceHash;
  }

  async write(sourceUri: vscode.Uri, sourceHash: string, translatedContent: string): Promise<CacheArtifacts> {
    const artifacts = await this.resolveArtifacts(sourceUri);
    await fs.mkdir(artifacts.cacheDir, { recursive: true });
    await fs.writeFile(artifacts.translatedFilePath, translatedContent, 'utf8');

    const payload: HashPayload = {
      sourceHash,
      sourceFile: sourceUri.fsPath,
      relativePath: artifacts.relativePath,
      updatedAt: new Date().toISOString()
    };

    await fs.writeFile(artifacts.hashFilePath, JSON.stringify(payload, null, 2), 'utf8');
    return artifacts;
  }

  private async readHashPayload(hashFilePath: string): Promise<HashPayload | undefined> {
    if (!(await pathExists(hashFilePath))) {
      return undefined;
    }

    const raw = await fs.readFile(hashFilePath, 'utf8');
    return JSON.parse(raw) as HashPayload;
  }
}

function expandHome(inputPath: string): string {
  if (inputPath === '~') {
    return os.homedir();
  }

  if (inputPath.startsWith('~/')) {
    return path.join(os.homedir(), inputPath.slice(2));
  }

  return inputPath;
}

function sanitizeSegment(value: string): string {
  return value
    .replace(/[:\\/]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'file';
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}
