'use client';

import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Save, Variable } from 'lucide-react';
import { promptsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';

// Regex to find {{variable}} patterns (matches letter/underscore start)
const VARIABLE_RE = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

function extractVariables(content: string): string[] {
  const vars = new Set<string>();
  let match: RegExpExecArray | null;
  const re = new RegExp(VARIABLE_RE.source, VARIABLE_RE.flags);
  while ((match = re.exec(content)) !== null) {
    if (match[1]) vars.add(match[1]);
  }
  return Array.from(vars);
}

/** Renders prompt content with {{variable}} highlighted */
function HighlightedContent({ content }: { content: string }) {
  const parts = content.split(/(\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\})/g);
  return (
    <div className="pointer-events-none absolute inset-0 whitespace-pre-wrap break-words px-3 py-2 font-mono text-sm text-transparent">
      {parts.map((part, i) =>
        /^\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}$/.test(part) ? (
          <mark key={i} className="rounded bg-violet-200/60 text-transparent">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </div>
  );
}

interface PromptEditorProps {
  promptId: string;
  initialContent: string;
  initialName: string;
}

export function PromptEditor({ promptId, initialContent, initialName }: PromptEditorProps) {
  const [content, setContent] = useState(initialContent);
  const [name, setName] = useState(initialName);
  const variables = extractVariables(content);
  const charCount = content.length;

  const { activeWorkspace } = useWorkspaceStore();
  const toast = useToast();
  const queryClient = useQueryClient();

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => {
      if (!activeWorkspace) throw new Error('No workspace selected');
      return promptsApi.update(activeWorkspace.id, promptId, { name, content });
    },
    onSuccess: () => {
      toast.success('Saved — new version created');
      void queryClient.invalidateQueries({ queryKey: ['prompt', promptId] });
      void queryClient.invalidateQueries({ queryKey: ['prompts', activeWorkspace?.id] });
    },
    onError: () => {
      toast.error('Failed to save', 'Please try again');
    },
  });

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        save();
      }
    },
    [save],
  );

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 bg-transparent text-xl font-semibold focus:outline-none focus:ring-0 border-b border-transparent focus:border-border pb-1"
          placeholder="Prompt name"
        />
        <Button onClick={() => save()} disabled={isPending}>
          <Save className="h-4 w-4" />
          {isPending ? 'Saving...' : 'Save (⌘S)'}
        </Button>
      </div>

      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Editor */}
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label>Content</Label>
            <span className="text-xs text-muted-foreground">{charCount} chars</span>
          </div>
          <div className="relative flex-1">
            <HighlightedContent content={content} />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              className="relative h-full min-h-[400px] w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              placeholder="Write your prompt here. Use {{variable}} for dynamic content."
              spellCheck={false}
            />
          </div>
        </div>

        {/* Variables panel */}
        <div className="w-56 shrink-0">
          <div className="flex items-center gap-2 mb-2">
            <Variable className="h-4 w-4 text-muted-foreground" />
            <Label>Variables</Label>
          </div>
          {variables.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No variables detected. Use {'{{name}}'} syntax to add variables.
            </p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {variables.map((v) => (
                <Badge
                  key={v}
                  variant="secondary"
                  className="font-mono text-xs cursor-pointer select-all"
                >
                  {`{{${v}}}`}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
