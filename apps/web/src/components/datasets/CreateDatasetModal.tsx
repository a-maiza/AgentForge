'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { datasetsApi } from '@/lib/api';
import { useWorkspaceStore } from '@/stores/workspace.store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface Props {
  readonly open: boolean;
  readonly onClose: () => void;
  readonly onSuccess: (id: string) => void;
}

interface CreatedDataset {
  id: string;
}

interface UploadResult {
  version?: { versionNumber: number };
}

export function CreateDatasetModal({ open, onClose, onSuccess }: Props) {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspaceStore();

  const [step, setStep] = useState<1 | 2>(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [uploadedVersion, setUploadedVersion] = useState<number | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [nameError, setNameError] = useState('');

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] },
    maxFiles: 1,
  });

  const formatBytes = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      setNameError('Name is required');
      return;
    }
    if (!activeWorkspace) return;
    setNameError('');
    setIsSubmitting(true);
    setStep(2);
    setProgress(0);

    try {
      const createPayload: { name: string; description?: string } = { name: name.trim() };
      if (description.trim()) createPayload.description = description.trim();
      const createRes = await datasetsApi.create(activeWorkspace.id, createPayload);
      const created = createRes.data as CreatedDataset;
      setCreatedId(created.id);

      if (file) {
        setProgress(10);
        const uploadRes = await datasetsApi.upload(activeWorkspace.id, created.id, file, (pct) =>
          setProgress(10 + Math.round(pct * 0.85)),
        );
        const result = uploadRes.data as UploadResult;
        setProgress(100);
        setUploadedVersion(result.version?.versionNumber ?? 1);
      } else {
        setProgress(100);
        setUploadedVersion(1);
      }

      await queryClient.invalidateQueries({ queryKey: ['datasets', activeWorkspace.id] });
      toast.success('Dataset created successfully');
    } catch {
      toast.error('Failed to create dataset');
      setStep(1);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setName('');
    setDescription('');
    setFile(null);
    setProgress(0);
    setUploadedVersion(null);
    setCreatedId(null);
    setNameError('');
    onClose();
  };

  const handleSuccessClose = () => {
    if (createdId) onSuccess(createdId);
    handleClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{step === 1 ? 'Create Dataset' : 'Uploading Dataset'}</DialogTitle>
        </DialogHeader>

        {step === 1 ? (
          <div className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="ds-name">Name *</Label>
              <Input
                id="ds-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setNameError('');
                }}
                placeholder="My dataset"
              />
              {nameError && <p className="text-xs text-destructive">{nameError}</p>}
            </div>

            <div className="space-y-1">
              <Label htmlFor="ds-desc">Description</Label>
              <Textarea
                id="ds-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description..."
                rows={2}
              />
            </div>

            <div className="space-y-1">
              <Label>File (CSV or JSON)</Label>
              <div
                {...getRootProps()}
                className={cn(
                  'flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors',
                  isDragActive
                    ? 'border-primary bg-primary/5'
                    : 'border-muted-foreground/30 hover:border-primary/60',
                )}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="flex items-center gap-2 text-sm">
                    <FileText className="h-5 w-5 text-primary" />
                    <span className="font-medium">{file.name}</span>
                    <span className="text-muted-foreground">({formatBytes(file.size)})</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                    <p className="text-sm font-medium">
                      {isDragActive ? 'Drop the file here' : 'Drag & drop or click to upload'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">CSV or JSON, any size</p>
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {progress < 100 ? (
              <>
                <div className="flex items-center gap-3">
                  <Upload className="h-5 w-5 text-primary animate-bounce" />
                  <span className="text-sm font-medium">
                    {progress < 10 ? 'Creating dataset…' : 'Uploading file…'}
                  </span>
                </div>
                <Progress value={progress} />
                <p className="text-center text-sm text-muted-foreground">{progress}%</p>
              </>
            ) : (
              <div className="flex flex-col items-center gap-3 text-center">
                <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                <p className="text-lg font-semibold">Dataset created!</p>
                <p className="text-sm text-muted-foreground">Version {uploadedVersion} is ready.</p>
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          {step === 1 && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={isSubmitting}>
                Create &amp; Upload
              </Button>
            </>
          )}
          {step === 2 && progress === 100 && (
            <Button onClick={handleSuccessClose}>View Dataset</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
