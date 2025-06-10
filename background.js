let ws = null;
const COMPANION_WS_URL = "ws://localhost:8082/"; // *** This MUST match the port in your Companion module! ***

function connectWebSocket() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        console.log("WebSocket already open or connecting.");
        return;
    }

    console.log("Attempting to connect to Companion module WebSocket server...");
    ws = new WebSocket(COMPANION_WS_URL);

    ws.onopen = () => {
        console.log("Successfully connected to Companion module WebSocket server.");
    };

    ws.onmessage = (event) => {
        const command = event.data;
        console.log("Received command from Companion module:", command);

        chrome.tabs.query({ url: "*://zipcaptions.app/*" }, function(tabs) {
    if (chrome.runtime.lastError) {
        console.error("Error querying tabs:", chrome.runtime.lastError.message);
        // Optionally, send an error status back to Companion via WebSocket if needed
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ status: "error", message: "Error querying tabs: " + chrome.runtime.lastError.message }));
        }
        return;
    }

    if (tabs && tabs.length > 0) {
        // What if there are multiple Zip Captions tabs open?
        // Option 1: Send to the first one found (simplest)
        const targetTab = tabs[0];
        console.log(`Found Zip Captions tab: ID ${targetTab.id}, URL ${targetTab.url}. Sending command.`);

        // Option 2: Send to all found (if appropriate for your commands)
        // tabs.forEach(targetTab => { ... });

        chrome.tabs.sendMessage(targetTab.id, { command: command })
            .then(response => {
                console.log("Message sent to content script. Response:", response);
                // Optionally, send success status/response back to Companion
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ status: "success", command: command, tabResponse: response }));
                }
            })
            .catch(error => {
                console.error(`Error sending message to content script in tab ${targetTab.id}:`, error.message);
                // Optionally, send an error status back to Companion
                if (ws && ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ status: "error", message: `Error sending to tab ${targetTab.id}: ${error.message}` }));
                }
            });
    } else {
        console.log("No Zip Captions tab found matching the URL pattern.");
        // Optionally, send a status back to Companion
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ status: "error", message: "No Zip Captions tab found." }));
        }
    }
});
    };

    ws.onclose = (event) => {
        console.warn(`Disconnected from Companion module WebSocket server. Code: ${event.code}, Reason: ${event.reason}. Reconnecting in 5 seconds...`);
        setTimeout(connectWebSocket, 5000);
    };

    ws.onerror = (error) => {
        console.error("WebSocket Error:", error);
    };
}

connectWebSocket();

chrome.runtime.onInstalled.addListener(() => {
    console.log("Zip Captions Companion Bridge extension installed/updated.");
    connectWebSocket();
});