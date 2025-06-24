// content.js - Final Version

console.log('Zip Captions Companion Bridge script loaded.');

// ADDED: Establish a persistent connection to the background script.
const port = chrome.runtime.connect({ name: 'zipcaptions' });
port.onDisconnect.addListener(() => {
    console.warn('Companion Bridge: Disconnected from background script.');
});

function waitForElement(selector) {
	return new Promise(resolve => {
		const element = document.querySelector(selector);
		if (element) return resolve(element);
		
		const observer = new MutationObserver(() => {
			const element = document.querySelector(selector);
			if (element) {
				observer.disconnect();
				resolve(element);
			}
		});
		observer.observe(document.body, { childList: true, subtree: true });
	});
}

function executeZipCaptionsAction(command) {
	let buttonSelector = '';
	switch (command) {
		case 'TOGGLE_LISTEN':
			buttonSelector = 'button[data-tip="Listen"], button[data-tip="Stop"]';
			break;
		case 'PLAY_PAUSE':
			buttonSelector = 'button:has(ng-icon[name="heroPause"]), button:has(ng-icon[name="heroPlay"])';
			break;
		default:
			console.warn(`Companion Bridge: Unknown command received: ${command}`);
			return;
	}
	const targetButton = document.querySelector(buttonSelector);
	if (targetButton) {
		targetButton.click();
		setTimeout(checkAndReportStatus, 150);
	}
}

function checkAndReportStatus() {
	const listenButton = document.querySelector('button[data-tip="Listen"], button[data-tip="Stop"]');
	let currentStatus = 'unknown';
	if (listenButton) {
		const tooltip = listenButton.getAttribute('data-tip');
		currentStatus = (tooltip === 'Stop') ? 'running' : 'stopped';
	}
	// CHANGED: Send message over the persistent port
	port.postMessage({ type: 'STATUS_UPDATE', payload: currentStatus });
}

async function setupWordObserver() {
    const captionContainerSelector = 'div.recognized-text';    
    const hostElement = await waitForElement(captionContainerSelector);
    const targetNode = hostElement.shadowRoot || hostElement;

    console.log('Companion Bridge: Word observer is active.');

    const wordObserver = new MutationObserver(() => {
        const latestText = hostElement.textContent;
        if (latestText) {
            const words = latestText.trim().split(/\s+/);
            const lastWord = words.pop() || '';
            if (lastWord) {
                // CHANGED: Send message over the persistent port
                port.postMessage({ type: 'LAST_WORD_UPDATE', payload: lastWord });
            }
        }
    });

    wordObserver.observe(targetNode, { childList: true, subtree: true, characterData: true });
}

// This listener is now ONLY for commands coming FROM companion
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.command) {
		executeZipCaptionsAction(request.command);
		sendResponse({ status: 'processed' });
	}
	return true;
});

async function initialize() {
	console.log('Companion Bridge: Zip Captions UI found. Activating features.');
	checkAndReportStatus(); 
	await setupWordObserver();
}

waitForElement('button[data-tip="Listen"], button[data-tip="Stop"]').then(initialize);