// content.js

console.log('Zip Captions Companion Bridge script loaded.');

// --- Resilient Port Connection Management ---
let port = null;

function connect() {
    port = chrome.runtime.connect({ name: 'zipcaptions' });
    console.log('Companion Bridge: Attempting to connect to background script...');

    port.onDisconnect.addListener(() => {
        port = null;
        console.warn('Companion Bridge: Disconnected from background script. Will try to reconnect in 5 seconds.');
        setTimeout(connect, 5000); 
    });

    console.log('Companion Bridge: Connection established.');
}

// --- Safe Message Sending ---
function sendMessage(message) {
    if (port) {
        try { port.postMessage(message); }
        catch (e) {
            if (e.message.includes('disconnected port')) {
                console.warn('Companion Bridge: Could not post message, port was disconnected.');
            } else {
				console.error('Companion Bridge: Error posting message:', e);
			}
        }
    } else {
        console.warn('Companion Bridge: Port not connected. Message not sent.', message);
    }
}


// --- Core Logic Functions ---

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
        // We still need this to get feedback for commands sent FROM Companion
		setTimeout(checkAndReportStatus, 150);
	}
}

let lastKnownStatus = 'unknown';

function checkAndReportStatus() {
	const listenButton = document.querySelector('button[data-tip="Listen"], button[data-tip="Stop"]');
	let currentStatus = 'unknown';

	if (listenButton) {
		currentStatus = (listenButton.getAttribute('data-tip') === 'Stop') ? 'running' : 'stopped';
	}
    
    if (currentStatus !== 'unknown' && currentStatus !== lastKnownStatus) {
        lastKnownStatus = currentStatus;
        sendMessage({ type: 'STATUS_UPDATE', payload: currentStatus });
    }
}

// --- Observer 1: For Last Word (High Frequency) ---
function setupWordObserver() {
    console.log('Companion Bridge: Starting real-time word observer (no debounce).');
    const captionTextSelector = 'div.recognized-text';
    let lastSentWord = ''; // Keep track of the last word we sent

    const wordObserver = new MutationObserver(() => {
        // Find the last line of text on the page
        const allTextElements = document.querySelectorAll(captionTextSelector);
        if (allTextElements.length === 0) return;

        const lastElement = allTextElements[allTextElements.length - 1];
        const latestText = lastElement.textContent;

        if (latestText) {
            const words = latestText.trim().split(/\s+/);
            const lastWord = words.pop() || '';

            // ONLY send an update if the last word has actually changed
            if (lastWord && lastWord !== lastSentWord) {
                lastSentWord = lastWord; // Update our tracker
                sendMessage({ type: 'LAST_WORD_UPDATE', payload: lastWord });
            }
        }
    });

    // Attach the observer to the entire body to ensure it is never destroyed.
    wordObserver.observe(document.body, {
		childList: true,
		subtree: true,
        characterData: true, // Keep this to detect text modifications
	});
}



// --- Observer 2: For Button Status (Low Frequency) ---
async function setupButtonObserver() {
    console.log('Companion Bridge: Waiting for button to observe status.');
    const buttonSelector = 'button[data-tip="Listen"], button[data-tip="Stop"]';
    const buttonToWatch = await waitForElement(buttonSelector);

    console.log('Companion Bridge: Button found. Starting status observer.');
    const buttonObserver = new MutationObserver((mutationsList) => {
        // This observer only cares that an attribute changed.
        // When it fires, we know the button state was likely toggled.
        for (const mutation of mutationsList) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'data-tip') {
                checkAndReportStatus();
                // No need to check other mutations
                return;
            }
        }
    });

    // This is a very efficient observer that only watches for a specific attribute change on one element.
    buttonObserver.observe(buttonToWatch, { attributes: true, attributeFilter: ['data-tip'] });
}


// --- Listeners and Initializers ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
	if (request.command) {
		executeZipCaptionsAction(request.command);
		sendResponse({ status: 'processed' });
	}
	return true;
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

async function initialize() {
	console.log('Companion Bridge: Zip Captions UI found. Activating features.');
	connect(); 
	setTimeout(() => {
		checkAndReportStatus(); 
		// Set up our TWO separate, specialized observers
		setupWordObserver();
		setupButtonObserver();
	}, 500);
}

waitForElement('button[data-tip="Listen"], button[data-tip="Stop"]').then(initialize);