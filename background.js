// background.js

let ws = null;
const COMPANION_WS_URL = 'ws://localhost:8082/';

function connectWebSocket() {
	if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
		return;
	}
	console.log('Attempting to connect to Companion module...');
	ws = new WebSocket(COMPANION_WS_URL);

	ws.onopen = () => {
		console.log('Successfully connected to Companion module.');
	};

	ws.onmessage = (event) => {
		const command = event.data;
		// Handle PING from Companion to keep connection alive
		if (command === 'PING') {
            if (ws.readyState === WebSocket.OPEN) {
				ws.send('PONG');
			}
			return;
		}
		
		console.log('Received command from Companion module:', command);
		chrome.tabs.query({ url: '*://zipcaptions.app/*' }, (tabs) => {
			if (tabs.length > 0) {
				chrome.tabs.sendMessage(tabs[0].id, { command: command })
                    .catch(err => console.error("Error sending message to content script:", err.message));
			}
		});
	};

	ws.onclose = () => {
		console.warn('Disconnected from Companion. Reconnecting in 5 seconds...');
		ws = null;
		setTimeout(connectWebSocket, 5000);
	};

	ws.onerror = () => {
		console.error('WebSocket Error Occurred.');
	};
}

// Listen for the persistent connection from content.js
chrome.runtime.onConnect.addListener((port) => {
	console.assert(port.name === 'zipcaptions');
	console.log('Content script connected.');

	// Listen for messages from content.js (status updates, last word)
	port.onMessage.addListener((msg) => {
		let messageForCompanion = null;
		if (msg.type === 'STATUS_UPDATE') {
			messageForCompanion = JSON.stringify({ status: msg.payload });
		} else if (msg.type === 'LAST_WORD_UPDATE') {
			messageForCompanion = JSON.stringify({ lastWord: msg.payload });
		}

		// Relay the message to Companion over the WebSocket
		if (messageForCompanion && ws && ws.readyState === WebSocket.OPEN) {
			try {
				ws.send(messageForCompanion);
			} catch (e) {
				console.error('Failed to send message to Companion:', e);
			}
		}
	});

	port.onDisconnect.addListener(() => {
		console.log('Content script port disconnected.');
	});
});

// Initial connection
connectWebSocket();