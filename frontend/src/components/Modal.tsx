import React, { useEffect } from 'react';

interface ModalProps {
    title: string;
    children: React.ReactNode;
    onClose: () => void;
}

import { createPortal } from 'react-dom';

export const Modal = ({ title, children, onClose, hasUnsavedChanges }: ModalProps & { hasUnsavedChanges?: boolean }) => {
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                if (hasUnsavedChanges) {
                    if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
                        onClose();
                    }
                } else {
                    onClose();
                }
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [onClose, hasUnsavedChanges]);

    const handleBackdropClick = (e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            if (hasUnsavedChanges) {
                if (window.confirm("You have unsaved changes. Are you sure you want to close?")) {
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
                className="bg-background border border-border w-full max-w-md rounded-xl p-6 shadow-2xl scale-100 animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-xl font-semibold mb-4">{title}</h3>
                {children}
            </div>
        </div>,
        document.body
    );
};
