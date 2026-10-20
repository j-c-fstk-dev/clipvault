import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Folder,
} from 'lucide-react';

const EXTENSION_ICONS: [string[], typeof File][] = [
  [['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif', 'ico', 'tif', 'tiff', 'heic'], FileImage],
  [['mp4', 'mkv', 'webm', 'avi', 'mov', 'wmv', 'flv', 'm4v'], FileVideo],
  [['mp3', 'flac', 'ogg', 'opus', 'wav', 'm4a', 'aac'], FileAudio],
  [['zip', 'tar', 'gz', 'tgz', 'xz', 'bz2', '7z', 'rar', 'zst', 'deb', 'rpm', 'appimage', 'iso'], FileArchive],
  [['csv', 'xls', 'xlsx', 'ods'], FileSpreadsheet],
  [['pdf', 'txt', 'md', 'doc', 'docx', 'odt', 'rtf', 'epub'], FileText],
  [['rs', 'ts', 'tsx', 'js', 'jsx', 'py', 'sh', 'c', 'h', 'cpp', 'go', 'java', 'json', 'toml', 'yaml', 'yml', 'html', 'css', 'sql'], FileCode],
];

/** Icon for a file by its extension. */
export const fileIcon = (name: string, isDir: boolean): typeof File => {
  if (isDir) return Folder;
  const ext = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  return EXTENSION_ICONS.find(([exts]) => exts.includes(ext))?.[1] ?? File;
};
