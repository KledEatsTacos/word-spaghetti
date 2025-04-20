import Composer from './composer.js';

const canvas = document.getElementById('composer-canvas');
const composer = new Composer(canvas);
const clearBtn = document.getElementById('clear-btn');
const toggleBtn = document.getElementById('toggle-instructions');
const instructionsPanel = document.querySelector('.instructions');

// Make sure everything looks right when the window is resized
window.addEventListener('resize', () => composer.resize());

// Let users toggle the instructions panel
toggleBtn.addEventListener('click', () => {
    instructionsPanel.classList.toggle('collapsed');
    toggleBtn.textContent = instructionsPanel.classList.contains('collapsed') ? '+' : '−';
});

// Handle keyboard input for creating letters
window.addEventListener('keydown', (e) => {
    if (e.key.length === 1 && /^[a-zA-Z]$/.test(e.key)) {
        composer.addParticle(e.key);
    } else if (e.key === ' ') {
        composer.addParticle('_');
        e.preventDefault();
    } else if (e.key === 'Escape') {
        composer.clear();
    }
});

// Mouse interaction to push letters around
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
        
        for (const particle of composer.particles) {
            const dx = particle.x - mouseX;
            const dy = particle.y - mouseY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist < radius) {
                const pushForce = (radius - dist) / radius * force;
                particle.vx += (dx / dist) * pushForce;
                particle.vy += (dy / dist) * pushForce;
            }
        }
        
        lastMouseX = mouseX;
        lastMouseY = mouseY;
    }
});

canvas.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('mouseleave', () => isDragging = false);

// Clear the canvas when the reset button is clicked
clearBtn.addEventListener('click', () => {
    composer.clear();
    clearBtn.blur();
});

// Animation loop that keeps everything moving
function animate() {
    composer.update();
    composer.draw();
    requestAnimationFrame(animate);
}

animate();
