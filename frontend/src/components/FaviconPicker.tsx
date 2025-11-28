import { useState, useRef } from 'react';
import { Upload, Loader2 } from 'lucide-react';
import { api } from '../lib/api';
import { cn } from '../lib/utils';
import { useTranslation } from 'react-i18next';

interface FaviconPickerProps {
    value: string;
    onChange: (url: string) => void;
}

export function FaviconPicker({ value, onChange }: FaviconPickerProps) {
    const { t } = useTranslation();
    const [mode, setMode] = useState<'presets' | 'url' | 'upload'>('presets');
    const [urlInput, setUrlInput] = useState(value);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const PRESETS = [
        { label: t('admin.favicon_picker.presets.default', 'Default'), value: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>👨‍🍳</text></svg>' },
        { label: t('admin.favicon_picker.presets.bread', 'Bread'), value: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍞</text></svg>' },
        { label: t('admin.favicon_picker.presets.croissant', 'Croissant'), value: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥐</text></svg>' },
        { label: t('admin.favicon_picker.presets.cookie', 'Cookie'), value: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍪</text></svg>' },
        { label: t('admin.favicon_picker.presets.cake', 'Cake'), value: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍰</text></svg>' },
        { label: t('admin.favicon_picker.presets.pie', 'Pie'), value: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🥧</text></svg>' },
        { label: t('admin.favicon_picker.presets.pizza', 'Pizza'), value: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍕</text></svg>' },
        { label: t('admin.favicon_picker.presets.donut', 'Donut'), value: 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>🍩</text></svg>' },
    ];

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('file', file);

        setIsUploading(true);
        try {
            const res = await api.post('/upload', formData);
            onChange(res.data.url);
            setUrlInput(res.data.url);
            setMode('presets');
        } catch (err) {
            console.error(err);
            alert(t('admin.favicon_picker.upload_failed', 'Failed to upload image'));
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex gap-2 border-b pb-2">
                <button
                    type="button"
                    onClick={() => setMode('presets')}
                    className={cn("px-3 py-1 text-sm rounded-md transition-colors", mode === 'presets' ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted")}
                >
                    {t('admin.favicon_picker.presets', 'Presets')}
                </button>
                <button
                    type="button"
                    onClick={() => setMode('url')}
                    className={cn("px-3 py-1 text-sm rounded-md transition-colors", mode === 'url' ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted")}
                >
                    {t('admin.favicon_picker.url', 'URL')}
                </button>
                <button
                    type="button"
                    onClick={() => setMode('upload')}
                    className={cn("px-3 py-1 text-sm rounded-md transition-colors", mode === 'upload' ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted")}
                >
                    {t('admin.favicon_picker.upload', 'Upload')}
                </button>
            </div>

            {mode === 'presets' && (
                <div className="grid grid-cols-4 gap-4">
                    {PRESETS.map((preset) => (
                        <button
                            key={preset.label}
                            type="button"
                            onClick={() => {
                                onChange(preset.value);
                                setUrlInput(preset.value);
                            }}
                            className={cn(
                                "flex flex-col items-center gap-2 p-3 rounded-lg border transition-all hover:bg-muted/50",
                                value === preset.value ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border"
                            )}
                        >
                            <img src={preset.value} alt={preset.label} className="w-8 h-8 object-contain" />
                            <span className="text-xs text-muted-foreground">{preset.label}</span>
                        </button>
                    ))}
                </div>
            )}

            {mode === 'url' && (
                <div className="flex gap-2">
                    <input
                        value={urlInput}
                        onChange={(e) => {
                            setUrlInput(e.target.value);
                            onChange(e.target.value);
                        }}
                        placeholder="https://example.com/favicon.ico"
                        className="flex-1 h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                    />
                </div>
            )}

            {mode === 'upload' && (
                <div className="border-2 border-dashed rounded-lg p-8 text-center hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileUpload}
                    />
                    {isUploading ? (
                        <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
                    ) : (
                        <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                    )}
                    <p className="text-sm text-muted-foreground">
                        {isUploading ? t('admin.favicon_picker.uploading', "Uploading...") : t('admin.favicon_picker.click_to_upload', "Click to upload image")}
                    </p>
                </div>
            )}

            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border">
                <div className="text-sm font-medium text-muted-foreground">{t('admin.favicon_picker.preview', 'Current Preview')}:</div>
                <img src={value} alt="Preview" className="w-8 h-8 rounded bg-white border p-1" onError={(e) => (e.currentTarget.src = '/favicon.ico')} />
                <div className="text-xs text-muted-foreground truncate flex-1">{value || t('admin.favicon_picker.none', 'None')}</div>
            </div>
        </div>
    );
}
