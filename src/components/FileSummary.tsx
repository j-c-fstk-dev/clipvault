import React from 'react';
import { FileInfo } from '../types';
import { fileIcon } from '../lib/fileTypes';

/** Badge for a file: where its contents can still be found. */
const status = (file: FileInfo): { label: string; tone: string } => {
  if (!file.exists) {
    return file.status === 'stored'
      ? { label: 'Saved copy only', tone: 'bg-accent-faint text-accent' }
      : { label: 'Not found', tone: 'bg-line text-danger' };
  }
  switch (file.status) {
    case 'stored':
      return { label: 'Saved copy', tone: 'bg-accent-faint text-accent' };
    case 'pending':
      return { label: 'Saving…', tone: 'bg-line text-muted' };
    case 'too_large':
      return { label: 'Path only', tone: 'bg-line text-muted' };
    default:
      return { label: 'Missing', tone: 'bg-line text-danger' };
  }
};

interface FileSummaryProps {
  files: FileInfo[];
  /** Show at most this many entries; all, with full paths, when omitted. */
  limit?: number;
  /** Makes each entry a button that opens the file at that position. */
  onOpen?: (position: number) => void;
}

/** Copied files and folders with whether the vault kept a copy of each. */
const FileSummary: React.FC<FileSummaryProps> = ({ files, limit, onOpen }) => {
  const shown = limit === undefined ? files : files.slice(0, limit);
  const hidden = files.length - shown.length;

  return (
    <ul className="flex flex-col gap-1.5 text-small min-w-0">
      {shown.map((file, position) => {
        const Icon = fileIcon(file.name, file.isDir);
        const badge = status(file);
        return (
          <li key={file.path} className="min-w-0" title={file.path}>
            <div className="flex items-center gap-2 min-w-0">
              <Icon aria-hidden className="w-4 h-4 shrink-0 text-muted" />
              {onOpen ? (
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    onOpen(position);
                  }}
                  title={`Open ${file.name}`}
                  className="truncate text-left font-medium hover:text-accent hover:underline underline-offset-2"
                >
                  {file.name}
                </button>
              ) : (
                <span className="truncate font-medium">{file.name}</span>
              )}
              <span className={`ml-auto shrink-0 px-1.5 h-[18px] inline-flex items-center rounded-md text-[11px] font-medium ${badge.tone}`}>
                {badge.label}
              </span>
            </div>
            {limit === undefined && (
              <p className="ml-6 mt-0.5 font-mono text-caption text-faint [overflow-wrap:anywhere]">{file.path}</p>
            )}
          </li>
        );
      })}
      {hidden > 0 && <li className="text-caption text-faint">{hidden} more</li>}
    </ul>
  );
};

export default FileSummary;
