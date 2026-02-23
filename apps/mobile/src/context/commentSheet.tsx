import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CommentSheet } from '../../components/CommentSheet';

export type CommentTarget =
    | { type: 'video'; videoUrl: string }
    | { type: 'image_post'; imagePostId: number };

interface CommentSheetContextType {
    openCommentSheet: (target: CommentTarget) => void;
    closeCommentSheet: () => void;
    isOpen: boolean;
}

const CommentSheetContext = createContext<CommentSheetContextType | null>(null);

export function useCommentSheet() {
    const context = useContext(CommentSheetContext);
    if (!context) {
        throw new Error('useCommentSheet must be used within a CommentSheetProvider');
    }
    return context;
}

interface CommentSheetProviderProps {
    children: ReactNode;
}

export function CommentSheetProvider({ children }: CommentSheetProviderProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [currentTarget, setCurrentTarget] = useState<CommentTarget | null>(null);

    const openCommentSheet = useCallback((target: CommentTarget) => {
        setCurrentTarget(target);
        setIsOpen(true);
    }, []);

    const closeCommentSheet = useCallback(() => {
        setIsOpen(false);
        setCurrentTarget(null);
    }, []);

    return (
        <CommentSheetContext.Provider value={{ openCommentSheet, closeCommentSheet, isOpen }}>
            {children}
            {/* Global CommentSheet - only one instance renders */}
            {currentTarget && (
                <CommentSheet
                    target={currentTarget}
                    visible={isOpen}
                    onClose={closeCommentSheet}
                />
            )}
        </CommentSheetContext.Provider>
    );
}
