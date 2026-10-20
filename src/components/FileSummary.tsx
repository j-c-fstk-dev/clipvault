import React from 'react';
import { AccentColor, FileInfo, Theme } from '../types';
import { fileIcon } from '../lib/fileTypes';

const STATUS_LABELS: Record<FileInfo['status'], string> = {
  pending: 'Saving…',
  stored: 'Saved copy',
  too_large: 'Path only',
  unavailable: 'Missing',
};

interface FileSummaryProps {
  files: FileInfo[];
  theme: Theme;
  accentColor: AccentColor;
  /** Show at most this many entries; all, with full paths, when omitted. */
  limit?: number;
  /** Makes each entry a button that opens the file at that position. */
  onOpen?: (position: number) => void;
}

/** Badge for a file: where its contents can still be found. */
const statusLabel = (file: FileInfo): string => {
  if (file.exists) return STATUS_LABELS[file.status];
  return file.status === 'stored' ? 'Saved copy only' : 'Not found';
};

/** Copied files and folders with whether the vault kept a copy of each. */
const FileSummary: React.FC<FileSummaryProps> = ({ files, theme, accentColor, limit, onOpen }) => {
  const shown = limit === undefined ? files : files.slice(0, limit);
  const hidden = files.length - shown.length;
  const muted = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';

  return (
    <ul className={`space-y-1 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
      {shown.map((file, position) => {
        const Icon = fileIcon(file.name, file.isDir);
        const name = onOpen ? (
          <button
            onClick={e => {
              e.stopPropagation();
              onOpen(position);
            }}
            title={`Open ${file.path}`}
            className="truncate text-left hover:underline underline-offset-2 focus:outline-none focus-visible:underline"
          >
            {file.name}
          </button>
        ) : (
          <span className="truncate">{file.name}</span>
        );
        return (
          <li key={file.path} className="min-w-0" title={file.path}>
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              {name}
              <span
                className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                  file.status === 'stored' ? '' : file.exists ? muted : 'text-red-500'
                }`}
                style={file.status === 'stored' ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}
              >
                {statusLabel(file)}
              </span>
            </div>
            {limit === undefined && (
              <p className={`ml-6 text-xs font-mono [overflow-wrap:anywhere] ${muted}`}>{file.path}</p>
            )}
          </li>
        );
      })}
      {hidden > 0 && <li className={`text-xs ${muted}`}>+{hidden} more</li>}
    </ul>
  );
};

export default FileSummary;
