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
        this.recognizedWords = [];
        this.previousTimestamp = performance.now();
        this.dictionary = new Set();
        this.dictionaryLoaded = false;
        this.loadFullDictionary();
    }

    loadFullDictionary() {
        fetch('https://raw.githubusercontent.com/dwyl/english-words/master/words_alpha.txt')
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.text();
            })
            .then(text => {
                const words = text.split('\n')
                    .map(word => word.trim().toLowerCase())
                    .filter(word => word.length > 0);
                this.dictionary = new Set(words);
                ['hello', 'world', 'test', 'word', 'cool', 'fun', 'play', 'game'].forEach(word => {
                    this.dictionary.add(word);
                });
                this.dictionaryLoaded = true;
                console.log(`Dictionary loaded with ${this.dictionary.size} words`);
            })
            .catch(error => {
                console.error('Error loading dictionary:', error);
                this.dictionary = new Set(['hello', 'world', 'test', 'word', 'cool', 'fun', 'play', 'game',
                    'cat', 'dog', 'hat', 'sun', 'moon', 'star', 'book', 'tree', 'fish', 'bird',
                    'time', 'love', 'good', 'blue', 'green', 'food', 'year', 'ball', 'fire', 'water',
                    'door', 'hand', 'city', 'rain', 'snow', 'wind', 'cell', 'gold', 'jump', 'ring']);
                this.dictionaryLoaded = true;
                console.log('Using fallback dictionary with common words');
            });
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    addParticle(letter) {
        const now = performance.now();
        letter = letter.toLowerCase();
        this.lastTypedTime = now;
        if (now - (this.previousTypedTime || 0) > 1500) {
            if (this.currentWord.length > 0) {
                this.scheduleWordCheck(this.currentSequence);
            }
            this.currentSequence++;
            this.currentWord = '';
            this.currentLetterIndex = 0;
        }
        this.previousTypedTime = now;
        this.currentWord += letter;
        this.updateInstructionsPanelBoundaries();
        let x, y;
        let attempts = 0;
        let validPosition = false;
        while (!validPosition && attempts < 10) {
            if (this.currentLetterIndex === 0) {
                x = Math.random() * this.canvas.width;
                y = Math.random() * this.canvas.height;
            } else {
                const prevParticles = this.particles.filter(p => 
                    p.sequenceId === this.currentSequence && 
                    p.letterIndex === this.currentLetterIndex - 1
                );
                if (prevParticles.length > 0) {
                    const prev = prevParticles[0];
                    x = prev.x + (Math.random() - 0.5) * 50;
                    y = prev.y + (Math.random() - 0.5) * 50;
                } else {
                    x = Math.random() * this.canvas.width;
                    y = Math.random() * this.canvas.height;
                }
            }
            validPosition = !this.isInsideInstructionsPanel(x, y, 15);
            attempts++;
        }
        if (!validPosition) {
            x = Math.random() * this.canvas.width;
            y = Math.random() * (this.canvas.height / 2);
        }
        const particle = new Particle(letter, x, y, this.currentSequence);
        particle.letterIndex = this.currentLetterIndex;
        particle.word = this.currentWord;
        this.particles.push(particle);
        if (this.wordCheckTimeout) {
            clearTimeout(this.wordCheckTimeout);
        }
        this.scheduleWordCheck(this.currentSequence);
        this.currentLetterIndex++;
    }
    
    scheduleWordCheck(sequenceId) {
        if (this.wordCheckTimeout) {
            clearTimeout(this.wordCheckTimeout);
        }
        this.wordCheckTimeout = setTimeout(() => {
            this.checkWordValidity(sequenceId);
        }, 1500);
    }
    
    checkWordValidity(sequenceId) {
        const sequences = {};
        for (const p of this.particles) {
            if (!sequences[p.sequenceId]) {
                sequences[p.sequenceId] = [];
            }
            sequences[p.sequenceId].push(p);
        }
        if (sequences[sequenceId]) {
            const seqParticles = sequences[sequenceId].slice();
            seqParticles.sort((a, b) => a.letterIndex - b.letterIndex);
            const word = seqParticles.map(p => p.letter).join('');
            const cleanWord = word.replace(/[^a-z]/g, '');
            if (cleanWord.length >= 3 && 
                this.dictionaryLoaded && 
                this.dictionary.has(cleanWord) && 
                !this.recognizedWords.includes(cleanWord)) {
                console.log(`Found word: ${cleanWord}`);
                this.recognizedWords.push(cleanWord);
                for (const p of seqParticles) {
                    p.isPartOfWord = true;
                }
                this.playWordSound();
                this.createWordEffect(seqParticles);
                if (parseInt(sequenceId) === this.currentSequence) {
                    this.currentSequence++;
                    this.currentWord = '';
                    this.currentLetterIndex = 0;
                }
            } 
            else if (cleanWord.length >= 3) {
                const letters = seqParticles.map(p => p.letter).filter(l => /^[a-z]$/.test(l));
                const validAnagrams = this.dictionaryLoaded ? this.findValidAnagrams(letters) : [];
                if (validAnagrams.length > 0) {
                    const anagram = validAnagrams[0];
                    console.log(`Found anagram: ${anagram} from letters: ${letters.join('')}`);
                    this.rearrangeParticlesToWord(seqParticles, anagram);
                    this.recognizedWords.push(anagram);
                    this.createRearrangementEffect(seqParticles);
                    for (const p of seqParticles) {
                        p.isPartOfWord = true;
                    }
                    this.playWordSound();
                    this.createWordEffect(seqParticles);
                    if (parseInt(sequenceId) === this.currentSequence) {
                        this.currentSequence++;
                        this.currentWord = '';
                        this.currentLetterIndex = 0;
                    }
                } else {
                    console.log(`Not a valid word: ${word}`);
                    this.createBlackHoleEffect(seqParticles);
                }
            } else {
                console.log(`Word too short: ${word}`);
                this.createBlackHoleEffect(seqParticles);
            }
        }
    }
    
    createBlackHoleEffect(particles) {
        if (particles.length === 0) return;
        const particleIds = particles.map(p => p.sequenceId + '-' + p.letterIndex);
        let centerX = 0, centerY = 0;
        for (const p of particles) {
            centerX += p.x;
            centerY += p.y;
        }
        centerX /= particles.length;
        centerY /= particles.length;
        const blackHole = {
            x: centerX,
            y: centerY,
            radius: 5,
            maxRadius: Math.max(40, particles.length * 3),
            alpha: 0,
            growing: true,
            frame: 0,
            maxFrames: 80,
            particlesToRemove: particleIds
        };
        for (const p of particles) {
            p.invalidWord = true;
            p.blackHoleTarget = {x: centerX, y: centerY};
        }
        const animateBlackHole = () => {
            blackHole.frame++;
            if (blackHole.growing) {
                blackHole.radius = 5 + (blackHole.maxRadius - 5) * (blackHole.frame / 30);
                blackHole.alpha = Math.min(1, blackHole.frame / 15);
                for (const p of this.particles) {
                    if (!p.invalidWord) continue;
                    if (!particleIds.includes(p.sequenceId + '-' + p.letterIndex)) continue;
                    const dx = blackHole.x - p.x;
                    const dy = blackHole.y - p.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist === 0) continue;
                    const force = 0.05 * blackHole.frame / 30;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                }
                if (blackHole.frame >= 30) {
                    blackHole.growing = false;
                }
            } 
            else {
                const progress = (blackHole.frame - 30) / 50;
                blackHole.radius = blackHole.maxRadius * (1 - Math.min(1, progress));
                for (const p of this.particles) {
                    if (!p.invalidWord) continue;
                    if (!particleIds.includes(p.sequenceId + '-' + p.letterIndex)) continue;
                    const dx = blackHole.x - p.x;
                    const dy = blackHole.y - p.y;
                    const dist = Math.sqrt(dx*dx + dy*dy);
                    if (dist === 0) {
                        p.toBeRemoved = true;
                        continue;
                    }
                    const force = 0.5 + progress * 2.0;
                    p.vx += (dx / dist) * force;
                    p.vy += (dy / dist) * force;
                    const distRatio = Math.min(1, dist / 100);
                    p.size = p.baseSize * distRatio;
                    if (dist < 5) {
                        p.toBeRemoved = true;
                    }
                }
            }
            const ctx = this.ctx;
            ctx.save();
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
            if (blackHole.frame < blackHole.maxFrames) {
                requestAnimationFrame(animateBlackHole);
            } else {
                const particleIdentifiers = new Set(blackHole.particlesToRemove);
                this.particles = this.particles.filter(p => {
                    const id = p.sequenceId + '-' + p.letterIndex;
                    return !particleIdentifiers.has(id);
                });
            }
        };
        animateBlackHole();
        this.playNegativeSound();
    }
    
    playNegativeSound() {
        if (!window.AudioContext && !window.webkitAudioContext) {
            return;
        }
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        try {
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
    
    createWordEffect(particles) {
        particles.sort((a, b) => a.letterIndex - b.letterIndex);
        const avgSize = particles.reduce((sum, p) => sum + p.size, 0) / particles.length;
        const spacing = avgSize * 0.8;
        let centerX = 0, centerY = 0;
        for (const p of particles) {
            centerX += p.x;
            centerY += p.y;
        }
        centerX /= particles.length;
        centerY /= particles.length;
        const randomAngle = Math.random() < 0.9 ? 
            (Math.random() * 0.2 - 0.1) : 
            (Math.random() * 2 * Math.PI);
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            const offset = i - (particles.length - 1) / 2;
            p.targetX = centerX + Math.cos(randomAngle) * offset * spacing;
            p.targetY = centerY + Math.sin(randomAngle) * offset * spacing;
            p.hasTargetPosition = true;
            const pushAngle = Math.atan2(p.y - centerY, p.x - centerX);
            p.vx += Math.cos(pushAngle) * 3;
            p.vy += Math.sin(pushAngle) * 3;
            if (i > 0) {
                const prev = particles[i-1];
                if (!p.connectedParticles.includes(prev)) p.connectedParticles.push(prev);
                if (!prev.connectedParticles.includes(p)) prev.connectedParticles.push(p);
            }
        }
        this.addWordCelebration(centerX, centerY, particles);
    }

    addWordCelebration(x, y, wordParticles) {
        const ctx = this.ctx;
        const word = wordParticles.map(p => p.letter).join('');
        const wordColor = `hsl(${(wordParticles[0].sequenceId * 40) % 360}, 90%, 60%)`;
        let ringFrame = 0;
        const ringAnimation = () => {
            ringFrame++;
            const progress = ringFrame / 30;
            if (progress <= 1) {
                ctx.save();
                const radius = 50 + progress * 50;
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
        const burstCount = wordParticles.length * 5;
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
            ctx.save();
            for (const p of burstParticles) {
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.05;
                p.life -= 0.02;
                if (p.life > 0) {
                    ctx.globalAlpha = p.life;
                    ctx.fillStyle = p.color;
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.restore();
            if (burstFrame < 60 && burstParticles.some(p => p.life > 0)) {
                requestAnimationFrame(burstAnimation);
            }
        };
        burstAnimation();
        this.flashBackground(wordColor);
        this.showFloatingWordText(word, x, y, wordColor);
    }

    flashBackground(color) {
        let flashFrame = 0;
        const flashAnimation = () => {
            flashFrame++;
            const progress = flashFrame / 10;
            if (progress <= 1) {
                let hue = 0;
                if (color.startsWith('hsl')) {
                    const match = color.match(/hsl\(([^,]+),/);
                    if (match) hue = parseFloat(match[1]);
                }
                const intensity = Math.sin(progress * Math.PI) * 0.15;
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
            const progress = textFrame / 60;
            if (progress <= 1) {
                const offset = Math.sin(progress * Math.PI) * 30;
                const alpha = 1 - progress;
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
        const deltaTime = (now - this.previousTimestamp) / 1000;
        this.previousTimestamp = now;
        this.updateInstructionsPanelBoundaries();
        for (const p of this.particles) {
            p.update(this.particles, this.canvas.width, this.canvas.height, deltaTime);
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
        const isColliding = 
            particle.x + radius > bounds.left && 
            particle.x - radius < bounds.right && 
            particle.y + radius > bounds.top && 
            particle.y - radius < bounds.bottom;
        if (isColliding) {
            const panelCenterX = bounds.left + bounds.width / 2;
            const panelCenterY = bounds.top + bounds.height / 2;
            const dx = particle.x - panelCenterX;
            const dy = particle.y - panelCenterY;
            const halfWidth = bounds.width / 2;
            const halfHeight = bounds.height / 2;
            const normalizedX = dx / halfWidth;
            const normalizedY = dy / halfHeight;
            if (Math.abs(normalizedX) < Math.abs(normalizedY)) {
                if (dy < 0) {
                    particle.y = bounds.top - radius;
                } else {
                    particle.y = bounds.bottom + radius;
                }
                particle.vy *= -0.7;
            } else {
                if (dx < 0) {
                    particle.x = bounds.left - radius;
                } else {
                    particle.x = bounds.right + radius;
                }
                particle.vx *= -0.7;
            }
            const pushAngle = Math.atan2(dy, dx);
            particle.vx += Math.cos(pushAngle) * 0.5;
            particle.vy += Math.sin(pushAngle) * 0.5;
        }
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        for (const p of this.particles) {
            p.draw(this.ctx);
        }
        this.drawWordsList();
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
        if (!window.AudioContext && !window.webkitAudioContext) {
            return;
        }
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        try {
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

    findValidAnagrams(letters) {
        letters = letters.filter(letter => /^[a-zA-Z]$/.test(letter));
        if (letters.length < 3 || !this.dictionaryLoaded) return [];
        const sortedLetters = [...letters].sort().join('');
        const targetLength = letters.length;
        const results = [];
        for (const word of this.dictionary) {
            if (word.length === targetLength && !this.recognizedWords.includes(word)) {
                if ([...word].sort().join('') === sortedLetters) {
                    results.push(word);
                    break;
                }
            }
        }
        return results;
    }
    
    rearrangeParticlesToWord(particles, word) {
        const letterToParticle = {};
        for (const p of particles) {
            if (!letterToParticle[p.letter]) {
                letterToParticle[p.letter] = [];
            }
            letterToParticle[p.letter].push(p);
        }
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            if (letterToParticle[letter] && letterToParticle[letter].length > 0) {
                const particle = letterToParticle[letter].pop();
                particle.letterIndex = i;
                particle.rearranged = true;
            }
        }
        particles.sort((a, b) => a.letterIndex - b.letterIndex);
    }
    
    createRearrangementEffect(particles) {
        for (let i = 0; i < particles.length; i++) {
            const p = particles[i];
            if (p.rearranged) {
                p.spinAnimation = {
                    frames: 0,
                    maxFrames: 20,
                    originalSize: p.size,
                    originalColor: p.color
                };
                p.vx += (Math.random() - 0.5) * 5;
                p.vy += (Math.random() - 0.5) * 5;
            }
        }
        let centerX = 0, centerY = 0;
        for (const p of particles) {
            centerX += p.x;
            centerY += p.y;
        }
        centerX /= particles.length;
        centerY /= particles.length;
        let frame = 0;
        const maxFrames = 30;
        const animateTransformation = () => {
            frame++;
            if (frame <= maxFrames) {
                const ctx = this.ctx;
                ctx.save();
                ctx.strokeStyle = `rgba(120, 180, 255, ${1 - frame / maxFrames})`;
                ctx.lineWidth = 2;
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
        this.playTransformSound();
    }
    
    playTransformSound() {
        if (!window.AudioContext && !window.webkitAudioContext) {
            return;
        }
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        try {
            const oscillator = this.audioContext.createOscillator();
            const gainNode = this.audioContext.createGain();
            oscillator.type = 'sine';
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
