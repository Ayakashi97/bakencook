
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    pageSize: number;
    totalItems: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
}

export function Pagination({
    currentPage,
    totalPages,
    pageSize,
    totalItems,
    onPageChange,
    onPageSizeChange
}: PaginationProps) {
    const { t } = useTranslation();

    return (
        <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                    {t('common.rows_per_page') || "Rows per page"}:
                </span>
                <select
                    className="h-8 w-16 rounded-md border border-input bg-background px-2 text-sm"
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                >
                    {[10, 25, 50, 100].map((size) => (
                        <option key={size} value={size}>
                            {size}
                        </option>
                    ))}
                </select>
                <span className="text-sm text-muted-foreground ml-2">
                    {t('common.total_items', { count: totalItems }) || `Total: ${totalItems}`}
                </span>
            </div>
            <div className="flex items-center gap-2">
                <button
                    className="p-1 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => onPageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium">
                    {currentPage} / {Math.max(1, totalPages)}
                </span>
                <button
                    className="p-1 rounded-md hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => onPageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>
        </div>
    );
}
