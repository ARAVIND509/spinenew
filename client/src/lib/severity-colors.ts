export const SEVERITY_COLORS = {
    severe: {
        border: '#ef4444',          // red-500
        background: 'rgba(239,68,68,0.15)',
        text: '#fca5a5',          // red-300
        badge: 'bg-rose-600',
        chip: 'bg-rose-500',
        label: 'CRITICAL',
    },
    moderate: {
        border: '#f97316',          // orange-500
        background: 'rgba(249,115,22,0.15)',
        text: '#fdba74',          // orange-300
        badge: 'bg-orange-500',
        chip: 'bg-orange-400',
        label: 'MODERATE',
    },
    mild: {
        border: '#eab308',          // yellow-500
        background: 'rgba(234,179,8,0.15)',
        text: '#fde047',          // yellow-300
        badge: 'bg-amber-500',
        chip: 'bg-amber-400',
        label: 'MILD',
    },
    normal: {
        border: '#22c55e',          // green-500
        background: 'rgba(34,197,94,0.1)',
        text: '#86efac',          // green-300
        badge: 'bg-green-600',
        chip: 'bg-green-500',
        label: 'NORMAL',
    },
} as const;

export type Severity = keyof typeof SEVERITY_COLORS;
