/**
 * UI-related enums for MetalHead CAM
 */

/**
 * Canvas interaction modes - determines what type of objects can be selected
 */
export enum InteractionMode {
    SHAPES = 'shapes',
    CHAINS = 'chains',
    CUTS = 'cuts',
}

/**
 * Message severity levels for warnings and notifications
 */
export enum MessageSeverity {
    INFO = 'info',
    WARNING = 'warning',
    ERROR = 'error',
}

/**
 * Type guard for checking if a value is a valid InteractionMode
 */
export function isInteractionMode(value: string): value is InteractionMode {
    return Object.values(InteractionMode).includes(value as InteractionMode);
}

/**
 * Type guard for checking if a value is a valid MessageSeverity
 */
export function isMessageSeverity(value: string): value is MessageSeverity {
    return Object.values(MessageSeverity).includes(value as MessageSeverity);
}

/**
 * Get human-readable label for interaction mode
 */
export function getInteractionModeLabel(mode: InteractionMode): string {
    switch (mode) {
        case InteractionMode.SHAPES:
            return 'Shapes';
        case InteractionMode.CHAINS:
            return 'Chains';
        case InteractionMode.CUTS:
            return 'Cuts';
        default:
            return mode;
    }
}

/**
 * Get CSS class for message severity
 */
export function getMessageSeverityClass(severity: MessageSeverity): string {
    switch (severity) {
        case MessageSeverity.INFO:
            return 'text-blue-600';
        case MessageSeverity.WARNING:
            return 'text-yellow-600';
        case MessageSeverity.ERROR:
            return 'text-red-600';
        default:
            return 'text-gray-600';
    }
}
