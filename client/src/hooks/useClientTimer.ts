import { useState, useEffect, useRef } from 'react';

interface UseClientTimerProps {
    serverTimer: number;
    isPlaying: boolean;
}

export function useClientTimer({ serverTimer, isPlaying }: UseClientTimerProps) {
    const [clientTimer, setClientTimer] = useState(serverTimer);
    const intervalRef = useRef<number | null>(null);

    // Sync with server timer when it changes
    useEffect(() => {
        // Only sync if difference is more than 2 seconds (to avoid constant resyncing)
        if (Math.abs(clientTimer - serverTimer) > 2) {
            console.log('⏰ Syncing timer with server:', serverTimer);
            setClientTimer(serverTimer);
        }
    }, [serverTimer]); // Don't include clientTimer in deps to avoid loops

    // Start/stop countdown based on game status
    useEffect(() => {
        if (isPlaying && clientTimer > 0) {
            // Start countdown
            intervalRef.current = window.setInterval(() => {
                setClientTimer(prev => Math.max(0, prev - 1));
            }, 1000);

            return () => {
                if (intervalRef.current) {
                    clearInterval(intervalRef.current);
                    intervalRef.current = null;
                }
            };
        } else {
            // Stop countdown
            if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
            }
        }
    }, [isPlaying, clientTimer > 0]);

    // Format timer for display
    const formatTimer = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return {
        clientTimer,
        formattedTimer: formatTimer(clientTimer)
    };
}
