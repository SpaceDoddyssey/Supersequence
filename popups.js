

// popups.js
document.addEventListener('DOMContentLoaded', () => {
  const h2pBtn = document.getElementById('howToPlayButton');
  if (!h2pBtn) return;

  // Create overlay
  const overlay = document.createElement('div');
  overlay.id = 'h2p-overlay';
  overlay.className = 'h2p-overlay hidden';

  // Create dialog
  const dialog = document.createElement('div');
  dialog.id = 'h2p-dialog';
  dialog.className = 'h2p-dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'h2p-title');

  dialog.innerHTML = `
    <div class="h2p-header">
      <h2 id="h2p-title">How to play</h2>
      <button id="h2p-ok" class="h2p-ok">Got it</button>
    </div>
    <div class="h2p-body">
      <p>Fill words by typing letters or clicking/tapping on them.</p>
      <p>If multiple words have the same next letter, it will advance them all.</p>
      <p>Fill these words in as few letters as possible.</p>
    </div>
  `;

  overlay.appendChild(dialog);
  document.body.appendChild(overlay);

  const closeButtons = [document.getElementById('h2p-close'), document.getElementById('h2p-ok')];

  function openPopup() {
    overlay.classList.remove('hidden');
    // simple focus management
    dialog.querySelector('[tabindex], button, a, input')?.focus();
    document.body.style.overflow = 'hidden'; // prevent background scroll
    document.addEventListener('keydown', onKeyDown);
  }

  function closePopup() {
    overlay.classList.add('hidden');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKeyDown);
    h2pBtn.focus();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') closePopup();
  }

  // open on button click
  h2pBtn.addEventListener('click', openPopup);

  // close when clicking the overlay (but not the dialog)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closePopup();
  });

  // close buttons
  closeButtons.forEach(btn => btn && btn.addEventListener('click', closePopup));
});



// function togglePopup(popupId) {
//     let targetPopup = document.querySelector(popupId);
//     let wasVisible = targetPopup.style.display == "block";
//     document.querySelector("#instruction-popup").style.display = "none";
//     if(!wasVisible){
//         targetPopup.style.display = "block";
//     }
// }

// document.querySelector("#howToPlayButton").onclick = () => togglePopup("#instruction-popup");
