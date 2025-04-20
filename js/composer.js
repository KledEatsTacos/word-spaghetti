import Particle from './particle.js';

export default class Composer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.particles = [];
        this.resize();
        this.currentSequence = 0;
        this.currentWord = '';
        this.currentLetterIndex = 0;
        this.lastTypedTime = 0;
        this.words = [];
        this.recognizedWords = [];
        this.previousTimestamp = performance.now();
        
        
        
        // Fetch full English dictionary
        this.loadFullDictionary();
    }

    loadFullDictionary() {
        fetch('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt')
            .then(response => response.text())
            .then(text => {
                // Clean each word by trimming whitespace and removing carriage returns
                const words = text.split('\n')
                    .map(word => word.trim().toLowerCase())
                    .filter(word => word.length > 0);
                this.dictionary = new Set(words);
                console.log(`Dictionary loaded with ${this.dictionary.size} words`);
                
                // Add some common words to ensure they're available
                ['hello', 'world', 'test', 'word', 'cool', 'fun', 'play', 'game'].forEach(word => {
                    this.dictionary.add(word);
                });
            })

    }


    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    addParticle(letter) {
        const now = performance.now();
        letter = letter.toLowerCase();
        
        // Set the last typed time for word checking timeout
        this.lastTypedTime = now;
        
        // If it's been more than 1.5 seconds since last key, start a new sequence
        if (now - (this.previousTypedTime || 0) > 1500) {
            // Check the previous word if it exists
            if (this.currentWord.length > 0) {
                this.scheduleWordCheck(this.currentSequence);
            }
            
            this.currentSequence++;
            this.currentWord = '';
            this.currentLetterIndex = 0;
        }
        
        this.previousTypedTime = now;
        this.currentWord += letter;
        
        // Make sure we have the latest panel boundaries
        this.updateInstructionsPanelBoundaries();
        
        // Calculate starting position - sequential letters appear closer together
        let x, y;
        let attempts = 0;
        let validPosition = false;
        
        while (!validPosition && attempts < 10) {
            if (this.currentLetterIndex === 0) {
                // First letter in a sequence - random position
                x = Math.random() * this.canvas.width;
                y = Math.random() * this.canvas.height;
            } else {
                // Find the previous letter in this sequence
                const prevParticles = this.particles.filter(p => 
                    p.sequenceId === this.currentSequence && 
                    p.letterIndex === this.currentLetterIndex - 1
                );
                
                if (prevParticles.length > 0) {
                    // Start near the last letter
                    const prev = prevParticles[0];
                    x = prev.x + (Math.random() - 0.5) * 50;
                    y = prev.y + (Math.random() - 0.5) * 50;
                } else {
                    // Fallback to random
                    x = Math.random() * this.canvas.width;
                    y = Math.random() * this.canvas.height;
                }
            }
            
            // Check if position is valid (not inside instructions panel)
            validPosition = !this.isInsideInstructionsPanel(x, y, 15); // 15px buffer
            attempts++;
        }
        
        // If we couldn't find a valid position after several attempts, 
        // just place it in the upper half of the screen
        if (!validPosition) {
            x = Math.random() * this.canvas.width;
            y = Math.random() * (this.canvas.height / 2);
        }
        
        // Create the particle with sequence info
        const particle = new Particle(letter, x, y, this.currentSequence);
        particle.letterIndex = this.currentLetterIndex;
        particle.word = this.currentWord;
        this.particles.push(particle);
        
        // Every time a letter is typed, cancel the previous timeout and set a new one
        if (this.wordCheckTimeout) {
            clearTimeout(this.wordCheckTimeout);
        }
        
        // Schedule word check after 1.5 seconds of no typing
        this.scheduleWordCheck(this.currentSequence);
        
        this.currentLetterIndex++;
    }
    
    scheduleWordCheck(sequenceId) {
        // Clear any existing timeout
        if (this.wordCheckTimeout) {
            clearTimeout(this.wordCheckTimeout);
        }
        
        // Set a new timeout to check the word after 1.5 seconds
        this.wordCheckTimeout = setTimeout(() => {
            // Check if this is the current sequence's word
            if (sequenceId === this.currentSequence) {
                this.checkWordValidity(sequenceId);
            } else {
                // Check the specific sequence only
                this.checkWordValidity(sequenceId);
            }
        }, 1500);
    }
    
    checkWordValidity(sequenceId) {
        // Group particles by sequence
        const sequences = {};
        for (const p of this.particles) {
            if (!sequences[p.sequenceId]) {
                sequences[p.sequenceId] = [];
            }
            sequences[p.sequenceId].push(p);
        }
        
        // Check if the specific sequence forms a valid word
        if (sequences[sequenceId]) {
            const seqParticles = sequences[sequenceId].slice();
            seqParticles.sort((a, b) => a.letterIndex - b.letterIndex);
            
            const word = seqParticles.map(p => p.letter).join('');
            console.log(`Checking word: '${word}'`);
            
            // Check if the word is in the dictionary and at least 3 letters long
            if (word.length >= 3 && this.dictionary.has(word) && 
                !this.recognizedWords.includes(word)) {
                
                console.log(`FOUND WORD: ${word}`);
                this.recognizedWords.push(word);
                
                // Highlight particles that form the word
                for (const p of seqParticles) {
                    p.isPartOfWord = true;
                }
                
                // Play sound effect
                this.playWordSound();
                
                // Create a dramatic visual celebration
                this.createWordEffect(seqParticles);
                
                // If this is the current sequence, start a new one
                if (parseInt(sequenceId) === this.currentSequence) {
                    this.currentSequence++;
                    this.currentWord = '';
                    this.currentLetterIndex = 0;
                }
            } 
            else if (word.length >= 3) {
                // Word not found in dictionary, check for anagrams
                const letters = seqParticles.map(p => p.letter);
                const validAnagrams = this.findValidAnagrams(letters);
                
                if (validAnagrams.length > 0) {
                    // Use the first valid anagram found
                    const anagram = validAnagrams[0];
                    console.log(`FOUND ANAGRAM: ${anagram} from letters: ${letters.join('')}`);
                    
                    // Rearrange the particles to show the anagram
                    this.rearrangeParticlesToWord(seqParticles, anagram);
                    this.recognizedWords.push(anagram);
                    
                    // Add a quick rearrangement animation effect
                    this.createRearrangementEffect(seqParticles);
                    
                    // Highlight particles that form the word
                    for (const p of seqParticles) {
                        p.isPartOfWord = true;
                    }
                    
                    // Play sound effect
                    this.playWordSound();
                    
                    // Create a dramatic visual celebration
                    this.createWordEffect(seqParticles);
                    
                    // If this is the current sequence, start a new one
                    if (parseInt(sequenceId) === this.currentSequence) {
                        this.currentSequence++;
                        this.currentWord = '';
                        this.currentLetterIndex = 0;
                    }
                } else {
                    // Not a valid word or anagram, create black hole effect
                    console.log(`INVALID WORD: ${word}`);
                    this.createBlackHoleEffect(seqParticles);
                }
            } else {
                // Too short to be a valid word
                console.log(`WORD TOO SHORT: ${word}`);
                this.createBlackHoleEffect(seqParticles);
            }
        }
    }
    
    createBlackHoleEffect(particles) {
        if (particles.length === 0) return;
        
        // Store the particle IDs to ensure we can track them all
        const particleIds = particles.map(p => p.sequenceId + '-' + p.letterIndex);
        
        // Calculate center of the word
        let centerX = 0, centerY = 0;
        for (const p of particles) {
            centerX += p.x;
            centerY += p.y;
        }
        centerX /= particles.length;
        centerY /= particles.length;
        
        // Create a black hole at the center
        const blackHole = {
            x: centerX,
            y: centerY,
            radius: 5,
            maxRadius: Math.max(40, particles.length * 3), // Scale radius based on word length
            alpha: 0,
            growing: true,
            frame: 0,
            maxFrames: 80,  // Longer animation for longer words
            particlesToRemove: particleIds
        };
        
        // Flag particles as part of invalid word
        for (const p of particles) {
            p.invalidWord = true;
            p.blackHoleTarget = {x: centerX, y: centerY};
        }
        
        // Animate black hole
        const animateBlackHole = () => {
            blackHole.frame++;
            
            // Growing phase
            if (blackHole.growing) {
                blackHole.radius = 5 + (blackHole.maxRadius - 5) * (blackHole.frame / 30);
                blackHole.alpha = Math.min(1, blackHole.frame / 15);
                
                // Pull particles in slightly
                for (const p of this.particles) {
                    if (!p.invalidWord) continue;
                    if (!particleIds.includes(p.sequenceId + '-' + p.letterIndex)) continue;
                    
                    // Calculate direction to black hole
                    const dx = blackHole.x - p.x;
                    const dy = blackHole.y - p.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist === 0) continue; // Skip if already at center
                    
                    // Apply force toward black hole
                    const force = 0.05 * blackHole.frame / 30;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }
                
                // After growing, start collapsing
                if (blackHole.frame >= 30) {
                    blackHole.growing = false;
                }
            } else {
                // Collapsing phase - rapidly pull in particles
                const progress = (blackHole.frame - 30) / 50; // Slower collapse for consistency
                blackHole.radius = blackHole.maxRadius * (1 - Math.min(1, progress));
                
                // Strong pull toward center
                for (const p of this.particles) {
                    if (!p.invalidWord) continue;
                    if (!particleIds.includes(p.sequenceId + '-' + p.letterIndex)) continue;
                    
                    // Calculate direction to black hole
                    const dx = blackHole.x - p.x;
                    const dy = blackHole.y - p.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    
                    if (dist === 0) {
                        // Already at center, just mark for removal
                        p.toBeRemoved = true;
                        continue;
                    }
                    
                    // Rapid acceleration toward center
                    const force = 0.5 + progress * 2.0; // Increasing force
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                    
                    // Shrink particles as they approach center
                    const distRatio = Math.min(1, dist / 100);
                    p.size = p.baseSize * distRatio;
                    
                    // Remove particles that reach the center
                    if (dist < 5) {
                        p.toBeRemoved = true;
                    }
                }
            }
            
            // Draw black hole
            const ctx = this.ctx;
            ctx.save();
            
            // Create gradient for black hole
            const gradient = ctx.createRadialGradient(
                blackHole.x, blackHole.y, 0,
                blackHole.x, blackHole.y, blackHole.radius
            );
            gradient.addColorStop(0, `rgba(0, 0, 0, ${blackHole.alpha})`);
            gradient.addColorStop(0.7, `rgba(40, 0, 60, ${blackHole.alpha * 0.8})`);
            gradient.addColorStop(1, `rgba(60, 0, 100, 0)`);
            
            ctx.beginPath();
            ctx.arc(blackHole.x, blackHole.y, blackHole.radius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            
            // Draw swirl effect
            const swirlCount = 5;
            for (let i = 0; i < swirlCount; i++) {
                const angle = (blackHole.frame * 0.05) + (i / swirlCount) * Math.PI * 2;
                const swirlRadius = blackHole.radius * 1.2;
                const x1 = blackHole.x + Math.cos(angle) * swirlRadius * 0.3;
                const y1 = blackHole.y + Math.sin(angle) * swirlRadius * 0.3;
                const x2 = blackHole.x + Math.cos(angle) * swirlRadius;
                const y2 = blackHole.y + Math.sin(angle) * swirlRadius;
                
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = `rgba(120, 0, 180, ${blackHole.alpha * 0.6})`;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
            
            ctx.restore();
            
            // Continue animation if not done
            if (blackHole.frame < blackHole.maxFrames) {
                requestAnimationFrame(animateBlackHole);
            } else {
                // Animation complete, force remove all particles in the sequence
                // This ensures no particles are left behind, even if they somehow avoided the black hole
                const particleIdentifiers = new Set(blackHole.particlesToRemove);
                this.particles = this.particles.filter(p => {
                    const id = p.sequenceId + '-' + p.letterIndex;
                    return !particleIdentifiers.has(id);
                });
            }
        };
        
        // Start animation
        animateBlackHole();
        
        // Play a negative sound effect
        this.playNegativeSound();
    }
    
    playNegativeSound() {
        // Create audio context if not exists
        if (!window.AudioContext && !window.webkitAudioContext) {
            return; // Browser doesn't support Web Audio API
        }
        
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        
        try {
            // Create oscillator for a "failure" sound
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sawtooth';
            oscillator.frequency.setValueAtTime(280, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(120, this.audioContext.currentTime + 0.5);
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }

    isInsideInstructionsPanel(x, y, buffer) {
        if (!this.instructionsBounds) return false;
        
        const bounds = this.instructionsBounds;
        return x > bounds.left - buffer && 
               x < bounds.right + buffer && 
               y > bounds.top - buffer && 
               y < bounds.bottom + buffer;
    }
    
    checkForWords() {
        // Ensure we have a dictionary
        if (!this.dictionary || this.dictionary.size === 0) {
            console.warn('Dictionary not loaded yet');
            return;
        }
        
        // Group particles by sequence
        const sequences = {};
        for (const p of this.particles) {
            if (!sequences[p.sequenceId]) {
                sequences[p.sequenceId] = [];
            }
            sequences[p.sequenceId].push(p);
        }
        
        // For each sequence, check if it forms a word
        for (const seqId in sequences) {
            const seqParticles = sequences[seqId].slice();
            seqParticles.sort((a, b) => a.letterIndex - b.letterIndex);
            
            const word = seqParticles.map(p => p.letter).join('');
            console.log(`Checking word: '${word}'`);
            
            // Check if the word is in the dictionary and at least 3 letters long
            if (word.length >= 3 && this.dictionary.has(word) && 
                !this.recognizedWords.includes(word)) {
                
                console.log(`FOUND WORD: ${word}`);
                this.recognizedWords.push(word);
                
                // Highlight particles that form the word
                for (const p of seqParticles) {
                    p.isPartOfWord = true;
                }
                
                // Play sound effect
                this.playWordSound();
                
                // Create a dramatic visual celebration
                this.createWordEffect(seqParticles);
                
                // Reset current word and start a new sequence so the user can type a new word
                if (parseInt(seqId) === this.currentSequence) {
                    this.currentSequence++;
                    this.currentWord = '';
                    this.currentLetterIndex = 0;
                }
            }
        }
    }
    
    createWordEffect(particles) {
        // Sort particles by their letter index for proper arrangement
        particles.sort((a, b) => a.letterIndex - b.letterIndex);
        const avgSize = particles.reduce((sum, p) => sum + p.size, 0) / particles.length;
        const spacing = avgSize * 0.8;
        
        // Calculate center of the word
        let centerX = 0, centerY = 0;
        for (const p of particles) {
            centerX += p.x;
            centerY += p.y;
        }
        centerX /= particles.length;
        centerY /= particles.length;
        
        // Almost always arrange horizontally for better readability
        const randomAngle = Math.random() < 0.9 ? 
            (Math.random() * 0.2 - 0.1) : // 90% time: nearly horizontal
            (Math.random() * 2 * Math.PI); // 10% time: random angle
        
        // Position letters in a proper word formation
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const offset = i - (particles.length - 1) / 2;
            p.targetX = centerX + Math.cos(randomAngle) * offset * spacing;
            p.targetY = centerY + Math.sin(randomAngle) * offset * spacing;
            p.hasTargetPosition = true;
            
            // Make the word "pop" by giving particles a slight outward push first
            const pushAngle = Math.atan2(p.y - centerY, p.x - centerX);
            p.vx += Math.cos(pushAngle) * 3;
            p.vy += Math.sin(pushAngle) * 3;
            
            // Connect sequential letters
            if (i > 0) {
                const prev = particles[i-1];
                if (!p.connectedParticles.includes(prev)) p.connectedParticles.push(prev);
                if (!prev.connectedParticles.includes(p)) prev.connectedParticles.push(p);
            }
        }
        
        // Create dramatic visual effects
        this.addWordCelebration(centerX, centerY, particles);
    }

    addWordCelebration(x, y, wordParticles) {
        const ctx = this.ctx;
        const word = wordParticles.map(p => p.letter).join('');
        const wordColor = `hsl(${(wordParticles[0].sequenceId * 40) % 360}, 90%, 60%)`;
        
        // 1. Create expanding ring effect
        let ringFrame = 0;
        const ringAnimation = () => {
            ringFrame++;
            const progress = ringFrame / 30; // 30 frames duration
            
            if (progress <= 1) {
                ctx.save();
                const radius = 50 + progress * 50; // Expand from 50 to 100px
                const alpha = 1 - progress;
                
                ctx.beginPath();
                ctx.arc(x, y, radius, 0, Math.PI * 2);
                ctx.strokeStyle = `${wordColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();
                
                requestAnimationFrame(ringAnimation);
            }
        };
        ringAnimation();
        
        // 2. Add particle burst/explosion effect
        const burstCount = wordParticles.length * 5; // 5 particles per letter
        const burstParticles = [];
        
        for (let i = 0; i < burstCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = 1 + Math.random() * 5;
            burstParticles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: 2 + Math.random() * 4,
                color: wordColor,
                life: 1.0
            });
        }
        
        let burstFrame = 0;
        const burstAnimation = () => {
            burstFrame++;
            
            // Update and draw particles
            ctx.save();
            for (const p of burstParticles) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05; // Gravity
                p.life -= 0.02; // Fade out
                
                if (p.life > 0) {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
            
            // Continue animation if particles are still visible
            if (burstFrame < 60 && burstParticles.some(p => p.life > 0)) {
                requestAnimationFrame(burstAnimation);
            }
        };
        burstAnimation();
        
        // 3. Flash the screen
        this.flashBackground(wordColor);
        
        // 4. Display floating word text
        this.showFloatingWordText(word, x, y, wordColor);
    }

    flashBackground(color) {
        const canvas = this.canvas;
        let flashFrame = 0;
        
        const flashAnimation = () => {
            flashFrame++;
            const progress = flashFrame / 10; // 10 frames duration
            
            if (progress <= 1) {
                // Parse the color to get hue if it's an HSL color
                let hue = 0;
                if (color.startsWith('hsl')) {
                    const match = color.match(/hsl\(([^,]+),/);
                    if (match) hue = parseFloat(match[1]);
                }
                
                // Create a gradient background flash
                const intensity = Math.sin(progress * Math.PI) * 0.15; // Max 15% intensity
                document.body.style.backgroundColor = `rgba(${hue/360*255}, ${hue/360*255}, 255, ${intensity})`;
                
                requestAnimationFrame(flashAnimation);
            } else {
                document.body.style.backgroundColor = '';
            }
        };
        flashAnimation();
    }
    
    showFloatingWordText(word, x, y, color) {
        const ctx = this.ctx;
        let textFrame = 0;
        
        const textAnimation = () => {
            textFrame++;
            const progress = textFrame / 60; // 60 frames (1 second)
            
            if (progress <= 1) {
                const offset = Math.sin(progress * Math.PI) * 30; // Float up to 30px
                const alpha = 1 - progress; // Fade out
                
                ctx.save();
                ctx.font = 'bold 28px "Montserrat", sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 10;
                ctx.fillText(word.toUpperCase(), x, y - offset);
                ctx.restore();
                
                requestAnimationFrame(textAnimation);
            }
        };
        textAnimation();
    }

    clear() {
        this.particles = [];
        this.currentSequence = 0;
        this.currentWord = '';
        this.currentLetterIndex = 0;
        this.recognizedWords = [];
    }

    update() {
        const now = performance.now();
        const deltaTime = (now - this.previousTimestamp) / 1000; // in seconds
        this.previousTimestamp = now;
        
        // Get the instructions panel dimensions for boundary checks
        this.updateInstructionsPanelBoundaries();
        
        for (const p of this.particles) {
            p.update(this.particles, this.canvas.width, this.canvas.height, deltaTime);
            
            // Check if the particle is inside or heading toward the instructions panel
            this.handleInstructionsPanelCollision(p);
        }
    }
    
    updateInstructionsPanelBoundaries() {
        if (!this.instructionsPanel) {
            this.instructionsPanel = document.querySelector('.instructions');
        }
        
        if (this.instructionsPanel) {
            const rect = this.instructionsPanel.getBoundingClientRect();
            this.instructionsBounds = {
                left: rect.left,
                right: rect.right,
                top: rect.top,
                bottom: rect.bottom,
                width: rect.width,
                height: rect.height
            };
        }
    }
    
    handleInstructionsPanelCollision(particle) {
        if (!this.instructionsBounds) return;
        
        const bounds = this.instructionsBounds;
        const radius = particle.size / 2;
        
        // Check if the particle is inside or about to enter the instructions panel
        const isColliding = 
            particle.x + radius > bounds.left && 
            particle.x - radius < bounds.right && 
            particle.y + radius > bounds.top && 
            particle.y - radius < bounds.bottom;
        
        if (isColliding) {
            // Determine which edge we're colliding with to bounce appropriately
            
            // Calculate the particle's center position relative to the panel center
            const panelCenterX = bounds.left + bounds.width / 2;
            const panelCenterY = bounds.top + bounds.height / 2;
            
            const dx = particle.x - panelCenterX;
            const dy = particle.y - panelCenterY;
            
            // Find the closest edge to bounce off of
            const halfWidth = bounds.width / 2;
            const halfHeight = bounds.height / 2;
            
            // Normalize distances by the half-dimensions to make it work for non-square panels
            const normalizedX = dx / halfWidth;
            const normalizedY = dy / halfHeight;
            
            // If we're closer to a horizontal edge
            if (Math.abs(normalizedX) < Math.abs(normalizedY)) {
                // Top/bottom collision
                if (dy < 0) {  // Above panel
                    particle.y = bounds.top - radius;
                } else {  // Below panel
                    particle.y = bounds.bottom + radius;
                }
                particle.vy *= -0.7;  // Bounce with some energy loss
            } else {
                // Left/right collision
                if (dx < 0) {  // Left of panel
                    particle.x = bounds.left - radius;
                } else {  // Right of panel
                    particle.x = bounds.right + radius;
                }
                particle.vx *= -0.7;  // Bounce with some energy loss
            }
            
            // Add a small impulse to prevent sticking
            const pushAngle = Math.atan2(dy, dx);
            particle.vx += Math.cos(pushAngle) * 0.5;
            particle.vy += Math.sin(pushAngle) * 0.5;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw connections first
        this.drawConnections();
        
        // Then draw particles on top
        for (const p of this.particles) {
            p.draw(this.ctx);
        }
        
        // Draw recognized words list
        this.drawWordsList();
    }
    
    drawConnections() {
        // Since we now draw connections in the particle draw method, 
        // we can leave this empty or use it for other effects
    }
    
    drawWordsList() {
        if (this.recognizedWords.length > 0) {
            this.ctx.fillStyle = 'rgba(255,255,255,0.7)';
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.textBaseline = 'top';
            this.ctx.fillText('Words found:', 20, 20);
            
            let y = 45;
            for (let i = Math.max(0, this.recognizedWords.length - 10); i < this.recognizedWords.length; i++) {
                this.ctx.fillText(this.recognizedWords[i], 20, y);
                y += 25;
            }
        }
    }
    
    playWordSound() {
        // Create audio context if not exists
        if (!window.AudioContext && !window.webkitAudioContext) {
            return; // Browser doesn't support Web Audio API
        }
        
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        
        try {
            // Create oscillator for a "success" sound
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            oscillator.frequency.setValueAtTime(380, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(680, this.audioContext.currentTime + 0.2);
            
            gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }

    // Helper methods for anagram detection
    findValidAnagrams(letters) {
        // Filter out any non-alphabet characters
        letters = letters.filter(letter => /^[a-zA-Z]$/.test(letter));
        
        if (letters.length < 3) return [];
        
        // For smaller sets of letters, we can try all permutations
        if (letters.length <= 7) {
            return this.findAnagramsByLookup(letters);
        }
        
        // For longer sets, use a more optimized approach
        return this.findTopAnagrams(letters);
    }
    
    // Find anagrams by checking if sorting matches dictionary words
    findAnagramsByLookup(letters) {
        const results = [];
        const lettersSorted = [...letters].sort().join('');
        
        // Look for all possible subsets of the letters that form words
        for (let len = letters.length; len >= 3 && results.length < 5; len--) {
            for (const word of this.dictionary) {
                if (word.length === len && 
                    !this.recognizedWords.includes(word) &&
                    [...word].sort().join('') === lettersSorted) {
                    results.push(word);
                    if (results.length >= 5) break;
                }
            }
        }
        
        return results;
    }
    
    // Find anagrams by letter frequency for longer letter sets
    findTopAnagrams(letters) {
        // Create a frequency map of our letters
        const letterFreq = {};
        for (const letter of letters) {
            letterFreq[letter] = (letterFreq[letter] || 0) + 1;
        }
        
        const results = [];
        
        // Process dictionary words
        const candidates = [];
        for (const word of this.dictionary) {
            if (word.length < 3 || word.length > letters.length || 
                this.recognizedWords.includes(word)) continue;
            
            // Check if we can form this word with our letters
            let canForm = true;
            const wordFreq = {};
            
            for (const char of word) {
                wordFreq[char] = (wordFreq[char] || 0) + 1;
                if (!letterFreq[char] || wordFreq[char] > letterFreq[char]) {
                    canForm = false;
                    break;
                }
            }
            
            if (canForm) {
                candidates.push(word);
            }
        }
        
        // Sort candidates by length (descending) and take top 5
        candidates.sort((a, b) => b.length - a.length);
        return candidates.slice(0, 5);
    }
    
    // Rearrange particles to form a specific word
    rearrangeParticlesToWord(particles, word) {
        // Map each particle to its letter
        const letterToParticle = {};
        for (const p of particles) {
            if (!letterToParticle[p.letter]) {
                letterToParticle[p.letter] = [];
            }
            letterToParticle[p.letter].push(p);
        }
        
        // Assign new letterIndex values based on the target word
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            if (letterToParticle[letter] && letterToParticle[letter].length > 0) {
                const particle = letterToParticle[letter].pop();
                particle.letterIndex = i;
                particle.rearranged = true; // Mark as rearranged for animation
            }
        }
        
        // Re-sort particles by their new letter indices
        particles.sort((a, b) => a.letterIndex - b.letterIndex);
    }
    
    createRearrangementEffect(particles) {
        // Make particles do a quick spin animation when rearranging
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.rearranged) {
                // Add a spinning motion
                p.spinAnimation = {
                    frames: 0,
                    maxFrames: 20,
                    originalSize: p.size,
                    originalColor: p.color
                };
                
                // Add a small random velocity for the animation effect
                p.vx += (Math.random() - 0.5) * 5;
                p.vy += (Math.random() - 0.5) * 5;
            }
        }
        
        // Create a visual effect showing letters rearranging
        const ctx = this.ctx;
        
        // Calculate center of the word
        let centerX = 0, centerY = 0;
        for (const p of particles) {
            centerX += p.x;
            centerY += p.y;
        }
        centerX /= particles.length;
        centerY /= particles.length;
        
        // Create a "transforming" effect
        let frame = 0;
        const maxFrames = 30;
        
        const animateTransformation = () => {
            frame++;
            
            if (frame <= maxFrames) {
                // Draw swirling connection lines
                ctx.save();
                ctx.strokeStyle = `rgba(120, 180, 255, ${1 - frame / maxFrames})`;
                ctx.lineWidth = 2;
                
                // Draw connecting lines that swirl
                ctx.beginPath();
                for (let i = 0; i < particles.length; i++) {
                    const p = particles[i];
                    const angle = (frame / maxFrames) * Math.PI * 4 + (i / particles.length) * Math.PI * 2;
                    const radius = 30 * Math.sin((frame / maxFrames) * Math.PI);
                    const x = centerX + Math.cos(angle) * radius;
                    const y = centerY + Math.sin(angle) * radius;
                    
                    if (i === 0) {
                        ctx.moveTo(x, y);
                    } else {
                        ctx.lineTo(x, y);
                    }
                }
                ctx.closePath();
                ctx.stroke();
                ctx.restore();
                
                requestAnimationFrame(animateTransformation);
            }
        };
        
        animateTransformation();
        
        // Play a transforming sound
        this.playTransformSound();
    }
    
    playTransformSound() {
        // Create audio context if not exists
        if (!window.AudioContext && !window.webkitAudioContext) {
            return; // Browser doesn't support Web Audio API
        }
        
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        
        try {
            // Create oscillator for a "transform" sound
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            
            oscillator.type = 'sine';
            // Sweeping sound
            oscillator.frequency.setValueAtTime(220, this.audioContext.currentTime);
            oscillator.frequency.exponentialRampToValueAtTime(880, this.audioContext.currentTime + 0.3);
            oscillator.frequency.exponentialRampToValueAtTime(440, this.audioContext.currentTime + 0.5);
            
            gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.5);
            
            oscillator.connect(gainNode);
            gainNode.connect(this.audioContext.destination);
            
            oscillator.start();
            oscillator.stop(this.audioContext.currentTime + 0.5);
        } catch (e) {
            console.error('Error playing sound:', e);
        }
    }
}
