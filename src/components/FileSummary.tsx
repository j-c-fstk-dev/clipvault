import React from 'react';
import { File, Folder } from 'lucide-react';
import { AccentColor, FileInfo, Theme } from '../types';

const STATUS_LABELS: Record<FileInfo['status'], string> = {
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
}

/** Copied files and folders with whether the vault kept a copy of each. */
const FileSummary: React.FC<FileSummaryProps> = ({ files, theme, accentColor, limit }) => {
  const shown = limit === undefined ? files : files.slice(0, limit);
  const hidden = files.length - shown.length;
  const muted = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';

  return (
    <ul className={`space-y-1 text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'}`}>
      {shown.map(file => {
        const Icon = file.isDir ? Folder : File;
        return (
          <li key={file.path} className="min-w-0" title={file.path}>
            <div className="flex items-center gap-2 min-w-0">
              <Icon className="w-4 h-4 shrink-0" style={{ color: accentColor }} />
              <span className="truncate">{file.name}</span>
              <span
                className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wide ${
                  file.status === 'stored' ? '' : muted
                }`}
                style={file.status === 'stored' ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}
              >
                {STATUS_LABELS[file.status]}
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
