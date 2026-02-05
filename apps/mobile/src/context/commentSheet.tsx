import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { CommentSheet } from '../../components/CommentSheet';

interface CommentSheetContextType {
    openCommentSheet: (videoUrl: string) => void;
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
    const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null);

    const openCommentSheet = useCallback((videoUrl: string) => {
        setCurrentVideoUrl(videoUrl);
        setIsOpen(true);
    }, []);

    const closeCommentSheet = useCallback(() => {
        setIsOpen(false);
        setCurrentVideoUrl(null);
    }, []);

    return (
        <CommentSheetContext.Provider value={{ openCommentSheet, closeCommentSheet, isOpen }}>
            {children}
            {/* Global CommentSheet - only one instance renders */}
            {currentVideoUrl && (
                <CommentSheet
                    videoUrl={currentVideoUrl}
                    visible={isOpen}
                    onClose={closeCommentSheet}
                />
            )}
        </CommentSheetContext.Provider>
    );
}
