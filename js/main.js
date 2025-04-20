import Composer from './composer.js';

const canvas = document.getElementById('composer-canvas');
const composer = new Composer(canvas);
const clearBtn = document.getElementById('clear-btn');
const toggleBtn = document.getElementById('toggle-instructions');
const instructionsPanel = document.querySelector('.instructions');

// Handle window resize
window.addEventListener('resize', () => composer.resize());

// Toggle instructions panel
toggleBtn.addEventListener('click', () => {
    instructionsPanel.classList.toggle('collapsed');
    toggleBtn.textContent = instructionsPanel.classList.contains('collapsed') ? '+' : '−';
});

// Handle key presses to spawn letters
window.addEventListener('keydown', (e) => {
    // Ignore modifier keys and other special keys
    if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        composer.addParticle(e.key);
    } else if (e.key === ' ') {
        // Space adds a space marker
        composer.addParticle('_');
        e.preventDefault(); // Prevent page scrolling
    } else if (e.key === 'Escape') {
        // Escape clears the canvas
        composer.clear();
    }
});

// Mouse interaction
let isDragging = false;
let lastMouseX = 0;
let lastMouseY = 0;

canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
});

canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const force = 0.5;
        const radius = 100;
        const mouseX = e.clientX;
        const mouseY = e.clientY;
        
        // Apply force to nearby particles
        for (const particle of composer.particles) {
            const dx = particle.x - mouseX;
            const dy = particle.y - mouseY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < radius) {
                // Push particles away from mouse cursor
                const pushForce = (radius - dist) / radius * force;
                particle.vx += (dx / dist) * pushForce;
                particle.vy += (dy / dist) * pushForce;
            }
        }
        
        lastMouseX = mouseX;
        lastMouseY = mouseY;
    }
});

canvas.addEventListener('mouseup', () => {
    isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    isDragging = false;
});

// Clear particles
clearBtn.addEventListener('click', () => {
    composer.clear();
    clearBtn.blur(); // Return focus to the window
});

// Animation loop
function animate() {
    composer.update();
    composer.draw();
    requestAnimationFrame(animate);
}

// Start animation
animate();
