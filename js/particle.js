class Particle {
    constructor(letter, x, y, sequenceId) {
        this.letter = letter;
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 1; // Reduced initial velocity
        this.vy = (Math.random() - 0.5) * 1;
        this.size = 24 + Math.random() * 8; // Less random size variation
        this.baseSize = this.size;
        this.color = `hsl(${Math.random() * 360}, 80%, 60%)`;
        this.sequenceId = sequenceId; // Track which typing sequence this belongs to
        this.letterIndex = 0; // Position in the current word
        this.word = null; // The word this letter is part of
        this.connectedParticles = []; // Other particles this one is connected to
        this.isPartOfWord = false;
        this.pulsePhase = 0; // For animation
        this.lifespan = 0; // Track how long the particle has existed
        
        // Target position for word formation
        this.targetX = null;
        this.targetY = null;
        this.hasTargetPosition = false;
    }

    update(particles, width, height, deltaTime) {
        this.lifespan += deltaTime;
        this.pulsePhase += deltaTime * 2;
        
        // Move letters into position when they form a word
        if (this.isPartOfWord && this.hasTargetPosition) {
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            const dist = Math.sqrt(dx*dx + dy*dy);
            
            if (dist > 1) {
                const speed = Math.min(dist * 0.1, 3);
                this.vx = (dx / dist) * speed;
                this.vy = (dy / dist) * speed;
            } else {
                this.vx *= 0.8;
                this.vy *= 0.8;
            }
        }
        
        // Bounce off the screen edges
        if (this.x < this.size/2) {
            this.x = this.size/2;
            this.vx *= -0.5;
        } else if (this.x > width - this.size/2) {
            this.x = width - this.size/2;
            this.vx *= -0.5;
        }
        
        if (this.y < this.size/2) {
            this.y = this.size/2;
            this.vy *= -0.5;
        } else if (this.y > height - this.size/2) {
            this.y = height - this.size/2;
            this.vy *= -0.5;
        }
        
        // Letters interact with each other
        if (!this.hasTargetPosition) {
            for (const other of particles) {
                if (other === this) continue;
                const dx = this.x - other.x;
                const dy = this.y - other.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist > 150 || dist === 0) continue;
                
                // Letters in the same word attract each other
                if (this.sequenceId === other.sequenceId) {
                    const indexDiff = Math.abs(this.letterIndex - other.letterIndex);
                    
                    if (indexDiff === 1) {
                        const force = 0.05;
                        this.vx -= (dx / dist) * force;
                        this.vy -= (dy / dist) * force;
                        
                        // Connect nearby sequential letters
                        if (dist < 100 && !this.connectedParticles.includes(other)) {
                            this.connectedParticles.push(other);
                            if (!other.connectedParticles.includes(this)) {
                                other.connectedParticles.push(this);
                            }
                        }
                    }
                }
                
                // Don't let letters overlap
                if (dist < 40) {
                    const force = (40 - dist) * 0.01;
                    this.vx += (dx / dist) * force;
                    this.vy += (dy / dist) * force;
                }
            }
        }
        
        // Move the letter
        this.x += this.vx;
        this.y += this.vy;
        this.vx *= 0.95;
        this.vy *= 0.95;
        
        // Make words pulse slightly
        if (this.isPartOfWord) {
            const pulse = Math.sin(this.pulsePhase) * 0.1 + 1;
            this.size = this.baseSize * pulse;
        }
    }

    draw(ctx) {
        // Draw lines connecting letters in a word
        if (this.connectedParticles.length > 0) {
            ctx.strokeStyle = this.isPartOfWord ? 
                `hsla(${(this.sequenceId * 40) % 360}, 90%, 60%, 0.6)` : 
                `hsla(${(this.sequenceId * 40) % 360}, 70%, 60%, 0.4)`;
            ctx.lineWidth = this.isPartOfWord ? 3 : 1;
            ctx.beginPath();
            
            for (const other of this.connectedParticles) {
                if (this.letterIndex < other.letterIndex) {
                    ctx.moveTo(this.x, this.y);
                    ctx.lineTo(other.x, other.y);
                }
            }
            ctx.stroke();
        }
        
        // Add a glow effect to letters in words
        if (this.isPartOfWord) {
            ctx.shadowColor = `hsla(${(this.sequenceId * 40) % 360}, 90%, 50%, 0.5)`;
            ctx.shadowBlur = 15;
        } else {
            ctx.shadowColor = 'transparent';
        }
        
        // Draw the actual letter
        ctx.font = `bold ${Math.floor(this.size)}px 'Helvetica Neue', Arial, sans-serif`;
        ctx.fillStyle = this.isPartOfWord ? 
            `hsl(${(this.sequenceId * 40) % 360}, 90%, 70%)` : 
            this.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.letter, this.x, this.y);
        
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        
        // Add white outline to letters in words
        if (this.isPartOfWord) {
            ctx.strokeStyle = 'rgba(255,255,255,0.7)';
            ctx.lineWidth = 1;
            ctx.strokeText(this.letter, this.x, this.y);
        }
    }
}

export default Particle;
