// This content script now listens for both messages from the background script
// AND for direct keyboard presses.

// Listener for messages coming from the background script (from Companion)
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  // Optional: Check sender if needed (e.g., if (sender.id !== chrome.runtime.id) return;)
  if (request.command) {
    console.log("Content script received command from background:", request.command);
    const success = executeZipCaptionsAction(request.command); // Get success status
    sendResponse({status: success ? "processed" : "failed_to_execute", action: request.command});
    // return true; // Only if executeZipCaptionsAction or sendResponse were async.
                 // If executeZipCaptionsAction is synchronous, this is not strictly needed.
  } else {
    // It's good practice to always send a response if the sender expects one.
    sendResponse({status: "error", message: "No command provided in request."});
  }
  // If you want to be explicit about handling all cases and ensuring sendResponse is called,
  // you might structure it to always call sendResponse. If sendResponse might be called
  // asynchronously within executeZipCaptionsAction, then you MUST return true here.
  // For now, assuming executeZipCaptionsAction is sync:
  return false; // Or simply don't return anything, as sendResponse is called sync.
});

// Listener for keyboard events (Ctrl + Shift + <key> shortcuts)
document.addEventListener('keydown', function(event) {
  if (!event.ctrlKey || !event.shiftKey) {
    return; // Not a Ctrl+Shift shortcut, ignore.
  }

  let commandToExecute = null;

  // It's good practice to see if we should prevent default behavior
  // only for the combinations we intend to handle.
  switch (event.code) {
    case 'Space':
      commandToExecute = 'PLAY_PAUSE';
      console.log("Ctrl + Shift + Space pressed.");
      event.preventDefault(); // Prevent default for this combo
      break;
    case 'ArrowUp':
      commandToExecute = 'INCREASE_TEXT_SIZE';
      console.log("Ctrl + Shift + Up Arrow pressed.");
      event.preventDefault();
      break;
    case 'ArrowDown':
      commandToExecute = 'DECREASE_TEXT_SIZE';
      console.log("Ctrl + Shift + Down Arrow pressed.");
      event.preventDefault();
      break;
    case 'KeyI':
      commandToExecute = 'TOGGLE_TEXT_FLOW';
      console.log("Ctrl + Shift + I pressed.");
      event.preventDefault();
      break;
    case 'KeyF':
      commandToExecute = 'TOGGLE_FULLSCREEN';
      console.log("Ctrl + alt + 5 pressed.");
      event.preventDefault();
      break;
    // Note: PING is not a standard event.code for a key.
    // If PING is a command from background, it's handled by onMessage.
    default:
      // console.warn("Unrecognized Ctrl+Shift shortcut. Code:", event.code);
      // No commandToExecute for unhandled keys, so no action needed.
      // No event.preventDefault() here unless you want to block ALL unhandled Ctrl+Shift combos.
      return; // Explicitly return if not handled
  }

  if (commandToExecute) {
    executeZipCaptionsAction(commandToExecute);
  }
});

// --- Shared function to execute the action on the Zip Captions page ---
function executeZipCaptionsAction(command) {
    let buttonFound = false;
    let buttonSelector = '';

    switch (command) {
      case 'PLAY_PAUSE':
       buttonSelector = 'button:has(ng-icon[name="heroPause"])'; // This might be too generic. Be careful.
        break;
      case 'TOGGLE_LISTEN': // Renamed for clarity, handles both start and stop
        buttonSelector = 'button[data-tip="Listen"], button[data-tip="Stop"]';
        break;
      case 'INCREASE_TEXT_SIZE':
        buttonSelector = 'button.btn.btn-sm.btn-primary[data-tip="Increase Text Size"]';
        break;
      case 'DECREASE_TEXT_SIZE':
        buttonSelector = 'button.btn.btn-sm.btn-primary[data-tip="Decrease Text Size"]';
        break;
      case 'TOGGLE_TEXT_FLOW':
        buttonSelector = 'button.btn.btn-md.btn-primary[data-tip="Text Flow"]'; // Verify this data-tip exists
        break;
      case 'TOGGLE_FULLSCREEN':
        buttonSelector = 'button.btn.btn-md.btn-primary[data-tip="Full Screen"]'; // Verify this data-tip exists
        break;
      default:
        console.warn("Unknown command to execute in executeZipCaptionsAction:", command);
        return false; // Indicate action was not known/performed
    }

    const targetButton = document.querySelector(buttonSelector);

    if (targetButton) {
      targetButton.click();
      console.log(`Action "${command}" performed: Button clicked (selector: ${buttonSelector}).`);
      buttonFound = true;
    } else {
      console.warn(`Action "${command}": Target button not found with selector: ${buttonSelector}`);
    }
    return buttonFound; // Return true if button was found and clicked, false otherwise
}