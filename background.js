// background.js - Final Version

let ws = null;
const COMPANION_WS_URL = 'ws://localhost:8082/';

function connectWebSocket() {
	if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
		return;
	}
	console.log('Attempting to connect to Companion module...');
	ws = new WebSocket(COMPANION_WS_URL);

	ws.onopen = () => console.log('Successfully connected to Companion module.');

	ws.onmessage = (event) => {
		const command = event.data;
		if (command === 'PING') {
			if (ws.readyState === WebSocket.OPEN) ws.send('PONG');
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

	ws.onerror = () => console.error('WebSocket Error Occurred.');
}

// REMOVED: The old onMessage listener.
// ADDED: A listener for persistent connections from the content script.
chrome.runtime.onConnect.addListener((port) => {
	console.assert(port.name === 'zipcaptions');
	console.log('Content script connected.');

	// Listen for messages coming from the content script through this persistent port
	port.onMessage.addListener((msg) => {
		let messageForCompanion = null;
		if (msg.type === 'STATUS_UPDATE') {
			messageForCompanion = JSON.stringify({ status: msg.payload });
		} else if (msg.type === 'LAST_WORD_UPDATE') {
			messageForCompanion = JSON.stringify({ lastWord: msg.payload });
		}

		if (messageForCompanion && ws && ws.readyState === WebSocket.OPEN) {
			try {
				console.log('Relaying to Companion:', messageForCompanion);
				ws.send(messageForCompanion);
			} catch (e) {
				console.error('Failed to send message to Companion:', e);
			}
		}
	});

	port.onDisconnect.addListener(() => {
		console.warn('Content script disconnected.');
	});
});

// Start the initial connection
connectWebSocket();