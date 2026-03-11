import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { EventEmitter } from 'events';

/**
 * WebSocket Manager for SpineGuardAI
 * Handles real-time progress updates for AI analysis.
 */

class AnalysisProgressEmitter extends EventEmitter { }
export const analysisProgress = new AnalysisProgressEmitter();

export function setupWebSocket(server: Server) {
    const wss = new WebSocketServer({ server, path: '/ws/analysis' });

    console.log('WebSocket server initialized on /ws/analysis');

    const clients = new Map<string, WebSocket>();

    wss.on('connection', (ws) => {
        let currentScanId: string | null = null;
        console.log('New WebSocket connection established');

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());
                if (data.type === 'subscribe' && data.scanId) {
                    currentScanId = data.scanId;
                    clients.set(currentScanId!, ws);
                    console.log(`Client subscribed to progress for scan: ${currentScanId}`);

                    ws.send(JSON.stringify({
                        type: 'subscribed',
                        scanId: currentScanId,
                        message: 'Waiting for analysis to start...'
                    }));
                }
            } catch (err) {
                console.error('WebSocket message error:', err);
            }
        });

        ws.on('close', () => {
            if (currentScanId) {
                clients.delete(currentScanId);
                console.log(`Client unsubscribed from scan: ${currentScanId}`);
            }
        });
    });

    // Listen for progress events and broadcast to relevant clients
    analysisProgress.on('progress', ({ scanId, progress, status }) => {
        const client = clients.get(scanId);
        if (client && client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({
                type: 'progress',
                scanId,
                progress,
                status
            }));
        }
    });
}

/**
 * Helper to emit progress updates from analysis functions
 */
export function updateAnalysisProgress(scanId: string, progress: number, status: string) {
    analysisProgress.emit('progress', { scanId, progress, status });
}
