import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { Upload, Link as LinkIcon, Image as ImageIcon, X, Trash2, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface ImageUploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (file: File) => void;
    onUrl: (url: string) => void;
    onRemove: () => void;
    currentImage?: string;
}

export function ImageUploadModal({ isOpen, onClose, onUpload, onUrl, onRemove, currentImage }: ImageUploadModalProps) {
    const { t } = useTranslation();
    const [activeTab, setActiveTab] = useState<'upload' | 'url'>('upload');
    const [urlInput, setUrlInput] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!isOpen) return;
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (urlInput) {
                    if (confirm(t('common.unsaved_changes_warning') || "You have unsaved changes. Are you sure you want to close?")) {
                        onClose();
                    }
                } else {
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [isOpen, onClose, urlInput, t]);

    if (!isOpen) return null;

    const stripMetadata = async (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const url = URL.createObjectURL(file);

            img.onload = () => {
                URL.revokeObjectURL(url);
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    reject(new Error('Canvas context not available'));
                    return;
                }
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                    if (blob) {
                        const newFile = new File([blob], file.name, { type: 'image/jpeg', lastModified: Date.now() });
                        resolve(newFile);
                    } else {
                        reject(new Error('Blob creation failed'));
                    }
                }, 'image/jpeg', 0.9);
            };

            img.onerror = () => {
                URL.revokeObjectURL(url);
                reject(new Error('Image load failed'));
            };

            img.src = url;
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent) => {
        let file: File | null = null;

        if ('files' in e.target && e.target.files) {
            file = e.target.files[0];
        } else if ('dataTransfer' in e && e.dataTransfer.files) {
            file = e.dataTransfer.files[0];
        }

        if (file && file.type.startsWith('image/')) {
            setIsProcessing(true);
            try {
                const cleanFile = await stripMetadata(file);
                onUpload(cleanFile);
                onClose();
            } catch (error) {
                console.error('Error processing image:', error);
                toast.error(t('admin.save_error')); // Generic error for now
            } finally {
                setIsProcessing(false);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        handleFileSelect(e);
    };

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            if (urlInput) {
                if (confirm(t('common.unsaved_changes_warning') || "You have unsaved changes. Are you sure you want to close?")) {
                    onClose();
                }
            } else {
                onClose();
            }
        }
    };

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200"
            onClick={handleBackdropClick}
        >
            <div
                className="bg-background border border-border w-full max-w-md rounded-xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200 space-y-6"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center justify-between border-b border-border pb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <ImageIcon className="w-5 h-5 text-primary" />
                        {currentImage ? t('image.change') : t('image.add')}
                    </h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Tabs */}
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted/50 rounded-lg">
                    <button
                        className={cn(
                            "py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                            activeTab === 'upload' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                        onClick={() => setActiveTab('upload')}
                    >
                        <Upload className="w-4 h-4" />
                        {t('image.upload_tab')}
                    </button>
                    <button
                        className={cn(
                            "py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                            activeTab === 'url' ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                        )}
                        onClick={() => setActiveTab('url')}
                    >
                        <LinkIcon className="w-4 h-4" />
                        {t('image.url_tab')}
                    </button>
                </div>

                {activeTab === 'upload' ? (
                    <div
                        className={cn(
                            "border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 transition-colors cursor-pointer min-h-[200px]",
                            isDragging ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/20"
                        )}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileSelect}
                        />
                        {isProcessing ? (
                            <Loader2 className="w-10 h-10 text-primary animate-spin" />
                        ) : (
                            <Upload className="w-10 h-10 text-muted-foreground" />
                        )}
                        <p className="text-sm text-muted-foreground text-center">
                            {t('image.drag_drop')}
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4 min-h-[200px] flex flex-col justify-center">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-muted-foreground">Image URL</label>
                            <input
                                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary/20 transition-all"
                                placeholder="https://..."
                                value={urlInput}
                                onChange={(e) => setUrlInput(e.target.value)}
                            />
                        </div>
                        <Button
                            onClick={() => {
                                if (urlInput) {
                                    onUrl(urlInput);
                                    onClose();
                                }
                            }}
                            disabled={!urlInput}
                            className="w-full"
                        >
                            {t('common.save')}
                        </Button>
                    </div>
                )}

                {currentImage && (
                    <div className="pt-4 border-t border-border">
                        <Button
                            variant="destructive"
                            className="w-full"
                            onClick={() => {
                                if (confirm(t('image.remove_confirm'))) {
                                    onRemove();
                                    onClose();
                                }
                            }}
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            {t('image.remove')}
                        </Button>
                    </div>
                )}
            </div>
        </div>,
        document.body
    );
}
