/**
 * Utility functions for managing timers in tests
 * This helps prevent Jest worker process failures due to timer leaks
 */

export class TimerManager {
    private timers: Array<NodeJS.Timeout | NodeJS.Immediate> = [];
    private intervals: Array<NodeJS.Timeout> = [];

    /**
     * Create a managed setTimeout
     */
    setTimeout(callback: (...args: any[]) => void, delay: number, ...args: any[]): NodeJS.Timeout {
        const timer = setTimeout(callback, delay, ...args);
        this.timers.push(timer);
        return timer;
    }

    /**
     * Create a managed setInterval
     */
    setInterval(callback: (...args: any[]) => void, delay: number, ...args: any[]): NodeJS.Timeout {
        const interval = setInterval(callback, delay, ...args);
        this.intervals.push(interval);
        return interval;
    }

    /**
     * Create a managed setImmediate
     */
    setImmediate(callback: (...args: any[]) => void, ...args: any[]): NodeJS.Immediate {
        const immediate = setImmediate(callback, ...args);
        this.timers.push(immediate);
        return immediate;
    }

    /**
     * Clear all managed timers
     */
    clearAll(): void {
        this.timers.forEach(timer => {
            try {
                if (timer && typeof timer === 'object') {
                    // Check if timer has unref method and call it
                    if ('unref' in timer && typeof (timer as any).unref === 'function') {
                        (timer as any).unref();
                    }
                    // Mark as destroyed if possible
                    if ('_destroyed' in timer) {
                        (timer as any)._destroyed = true;
                    }
                }
            } catch (error) {
                // Ignore errors during cleanup
                console.warn('Error cleaning up timer:', error);
            }
        });

        this.intervals.forEach(interval => {
            try {
                clearInterval(interval);
            } catch (error) {
                // Ignore errors during cleanup
                console.warn('Error clearing interval:', error);
            }
        });

        this.timers = [];
        this.intervals = [];
    }

    /**
     * Clear a specific timer
     */
    clearTimer(timer: NodeJS.Timeout | NodeJS.Immediate): void {
        const index = this.timers.indexOf(timer);
        if (index > -1) {
            this.timers.splice(index, 1);
        }

        try {
            if (timer && typeof timer === 'object') {
                // Check if timer has unref method and call it
                if ('unref' in timer && typeof (timer as any).unref === 'function') {
                    (timer as any).unref();
                }
            }
        } catch (error) {
            // Ignore errors during cleanup
            console.warn('Error cleaning up specific timer:', error);
        }
    }

    /**
     * Clear a specific interval
     */
    clearInterval(interval: NodeJS.Timeout): void {
        const index = this.intervals.indexOf(interval);
        if (index > -1) {
            this.intervals.splice(index, 1);
        }
        try {
            clearInterval(interval);
        } catch (error) {
            // Ignore errors during cleanup
            console.warn('Error clearing specific interval:', error);
        }
    }

    /**
     * Get the count of active timers
     */
    getActiveTimerCount(): number {
        return this.timers.length + this.intervals.length;
    }
}

/**
 * Global timer manager instance
 */
export const globalTimerManager = new TimerManager();

/**
 * Helper function to create a managed promise that resolves after a delay
 */
export function delay(ms: number): Promise<void> {
    return new Promise(resolve => {
        globalTimerManager.setTimeout(resolve, ms);
    });
}

/**
 * Helper function to create a managed promise that resolves on next tick
 */
export function nextTick(): Promise<void> {
    return new Promise(resolve => {
        globalTimerManager.setImmediate(resolve);
    });
}

/**
 * Clean up function to be called in test teardown
 */
export function cleanupTimers(): void {
    globalTimerManager.clearAll();
}

/**
 * Safe cleanup function that handles errors gracefully
 */
export function safeCleanupTimers(): void {
    try {
        cleanupTimers();
    } catch (error) {
        console.warn('Error during timer cleanup:', error);
    }
}

// Auto-cleanup on process exit
if (typeof process !== 'undefined') {
    process.on('exit', safeCleanupTimers);
    process.on('SIGINT', safeCleanupTimers);
    process.on('SIGTERM', safeCleanupTimers);
}
