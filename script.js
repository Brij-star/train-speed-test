class AdvancedSpeedometer {
    constructor() {
        this.speedCanvas = document.getElementById('speedometer');
        this.historyCanvas = document.getElementById('historyGraph');
        this.ctx = this.speedCanvas.getContext('2d');
        this.historyCtx = this.historyCanvas.getContext('2d');
        this.isRunning = false;
        this.currentSpeed = 0;
        this.maxSpeed = 0;
        this.speedHistory = [];
        this.startTime = null;
        this.isKph = true;
        this.animationId = null;
        this.acceleration = 0;
        this.lastSpeed = 0;
        this.lastUpdateTime = Date.now();
        this.circleProgress = {
            max: 0,
            avg: 0,
            distance: 0
        };
        this.motionData = {
            x: 0,
            y: 0,
            z: 0,
            timestamp: 0
        };
        this.speedBuffer = [];
        this.bufferSize = 5;

        this.setupEventListeners();
        this.drawSpeedometer();
        this.drawHistoryGraph();
        this.updateCircularStats();
        this.resizeCanvases();
        window.addEventListener('resize', () => this.resizeCanvases());
    }

    setupEventListeners() {
        document.getElementById('startButton').addEventListener('click', () => this.toggleSimulation());
        document.getElementById('resetButton').addEventListener('click', () => this.resetSimulation());
        document.getElementById('kmButton').addEventListener('click', () => this.setUnit(true));
        document.getElementById('milesButton').addEventListener('click', () => this.setUnit(false));
    }

    resizeCanvases() {
        const container = document.querySelector('.speedometer-container');
        const containerWidth = container.clientWidth;
        const size = Math.min(containerWidth, 500);

        this.speedCanvas.width = size;
        this.speedCanvas.height = size;
        this.historyCanvas.width = containerWidth - 40;
        this.historyCanvas.height = 100;

        this.drawSpeedometer();
        this.drawHistoryGraph();
    }

    toggleSimulation() {
        this.isRunning = !this.isRunning;
        const startButton = document.getElementById('startButton');
        document.querySelector('.speedometer-container').classList.toggle('running', this.isRunning);
        
        if (this.isRunning) {
            startButton.textContent = 'STOP TEST';
            startButton.style.background = 'var(--danger-color)';
            this.startTime = this.startTime || Date.now();
            this.startTracking();
        } else {
            startButton.textContent = 'START TEST';
            startButton.style.background = 'var(--success-color)';
            this.stopTracking();
        }
    }

    resetSimulation() {
        this.isRunning = false;
        this.currentSpeed = 0;
        this.maxSpeed = 0;
        this.speedHistory = [];
        this.startTime = null;
        this.lastSpeed = 0;
        this.acceleration = 0;
        this.circleProgress = { max: 0, avg: 0, distance: 0 };
        
        document.getElementById('startButton').textContent = 'START TEST';
        document.getElementById('startButton').style.background = 'var(--success-color)';
        document.querySelector('.speedometer-container').classList.remove('running');
        
        this.updateDisplay();
        this.drawSpeedometer();
        this.drawHistoryGraph();
        this.updateCircularStats();
    }

    setUnit(isKph) {
        this.isKph = isKph;
        document.getElementById('kmButton').classList.toggle('active', isKph);
        document.getElementById('milesButton').classList.toggle('active', !isKph);
        document.getElementById('speed-unit').textContent = isKph ? 'km/h' : 'mi/h';
        this.drawSpeedometer();
        this.updateDisplay();
    }

    startTracking() {
        if (window.DeviceMotionEvent) {
            window.addEventListener('devicemotion', this.handleMotion.bind(this));
        } else {
            this.startGPSTracking();
        }
        requestAnimationFrame(this.updateLoop.bind(this));
    }

    stopTracking() {
        window.removeEventListener('devicemotion', this.handleMotion.bind(this));
        if (this.watchId) {
            navigator.geolocation.clearWatch(this.watchId);
        }
        cancelAnimationFrame(this.animationId);
    }

    handleMotion(event) {
        const acceleration = event.acceleration;
        if (!acceleration) return;

        const now = Date.now();
        const dt = (now - this.motionData.timestamp) / 1000;
        
        if (this.motionData.timestamp !== 0) {
            const ax = acceleration.x || 0;
            const ay = acceleration.y || 0;
            const az = acceleration.z || 0;

            const totalAccel = Math.sqrt(ax * ax + ay * ay + az * az);
            let speed = totalAccel * dt;
            
            this.speedBuffer.push(speed);
            if (this.speedBuffer.length > this.bufferSize) {
                this.speedBuffer.shift();
            }

            this.currentSpeed = this.speedBuffer.reduce((a, b) => a + b, 0) / this.speedBuffer.length;
        }

        this.motionData = {
            x: acceleration.x || 0,
            y: acceleration.y || 0,
            z: acceleration.z || 0,
            timestamp: now
        };
    }

    startGPSTracking() {
        if (navigator.geolocation) {
            this.watchId = navigator.geolocation.watchPosition(
                (position) => {
                    if (position.coords.speed !== null) {
                        this.currentSpeed = position.coords.speed;
                    }
                },
                (error) => console.error('GPS Error:', error),
                {
                    enableHighAccuracy: true,
                    maximumAge: 0
                }
            );
        }
    }

    updateLoop() {
        if (this.isRunning) {
            this.updateDisplay();
            this.updateCircularStats();
            this.drawSpeedometer();
            this.drawHistoryGraph();
            this.animationId = requestAnimationFrame(this.updateLoop.bind(this));
        }
    }

    updateCircularStats() {
        const maxSpeedProgress = (this.maxSpeed / 220) * 100;
        const avgSpeed = this.speedHistory.reduce((a, b) => a + b, 0) / (this.speedHistory.length || 1);
        const avgSpeedProgress = (avgSpeed / 220) * 100;
        const distance = this.calculateDistance();
        const distanceProgress = (distance / 100) * 100; // Assuming 100km as max

        document.getElementById('maxSpeed').textContent = `${Math.round(this.isKph ? this.maxSpeed : this.maxSpeed * 0.621371)} ${this.isKph ? 'km/h' : 'mi/h'}`;
        document.getElementById('avgSpeed').textContent = `${Math.round(this.isKph ? avgSpeed : avgSpeed * 0.621371)} ${this.isKph ? 'km/h' : 'mi/h'}`;
        document.getElementById('distance').textContent = `${Math.round(this.isKph ? distance : distance * 0.621371)} ${this.isKph ? 'km' : 'mi'}`;
    }

    calculateDistance() {
        if (!this.startTime || this.speedHistory.length === 0) return 0;
        const avgSpeed = this.speedHistory.reduce((a, b) => a + b, 0) / this.speedHistory.length;
        const hours = (Date.now() - this.startTime) / 3600000;
        return avgSpeed * hours;
    }

    updateDisplay() {
        const speed = this.isKph ? this.currentSpeed : this.currentSpeed * 0.621371;
        const unit = this.isKph ? 'km/h' : 'mi/h';

        document.getElementById('speed-value').textContent = Math.round(speed);
        document.getElementById('speed-unit').textContent = unit;

        const duration = Math.floor((Date.now() - (this.startTime || Date.now())) / 1000);
        const h = Math.floor(duration / 3600);
        const m = Math.floor((duration % 3600) / 60);
        const s = duration % 60;
        document.getElementById('duration').textContent = 
            `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;

        document.getElementById('acceleration').textContent = 
            `${this.acceleration.toFixed(2)} m/s²`;

        this.speedHistory.push(this.currentSpeed);
        if (this.speedHistory.length > 50) this.speedHistory.shift();

        this.maxSpeed = Math.max(this.maxSpeed, this.currentSpeed);
    }

    drawSpeedometer() {
        const ctx = this.ctx;
        const width = this.speedCanvas.width;
        const height = this.speedCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = Math.min(width, height) / 2 - 20;

        ctx.clearRect(0, 0, width, height);

        // Draw black background
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = '#000000';
        ctx.fill();

        // Draw outer blue glow
        const gradient = ctx.createRadialGradient(
            centerX, centerY, radius - 5,
            centerX, centerY, radius
        );
        gradient.addColorStop(0, 'rgba(0, 255, 255, 0)');
        gradient.addColorStop(1, 'rgba(0, 255, 255, 0.2)');
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fillStyle = gradient;
        ctx.fill();

        // Draw speed markings
        const maxSpeed = this.isKph ? 220 : 140;
        const startAngle = Math.PI * 0.75;
        const endAngle = Math.PI * 2.25;
        const angleRange = endAngle - startAngle;

        for (let speed = 0; speed <= maxSpeed; speed += 20) {
            const angle = startAngle + (speed / maxSpeed) * angleRange;
            const isMainMark = speed % 40 === 0;
            
            const innerRadius = radius - (isMainMark ? 20 : 10);
            const x1 = centerX + innerRadius * Math.cos(angle);
            const y1 = centerY + innerRadius * Math.sin(angle);
            const x2 = centerX + radius * Math.cos(angle);
            const y2 = centerY + radius * Math.sin(angle);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = isMainMark ? 2 : 1;
            ctx.stroke();

            if (isMainMark) {
                const textRadius = radius - 35;
                const textX = centerX + textRadius * Math.cos(angle);
                const textY = centerY + textRadius * Math.sin(angle);
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 16px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(speed.toString(), textX, textY);
            }
        }

        // Draw needle
        const speed = this.isKph ? this.currentSpeed : this.currentSpeed * 0.621371;
        const speedAngle = startAngle + (speed / maxSpeed) * angleRange;
        
        // Draw needle shadow
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + radius * 0.8 * Math.cos(speedAngle),
            centerY + radius * 0.8 * Math.sin(speedAngle)
        );
        ctx.strokeStyle = 'rgba(0, 255, 255, 0.3)';
        ctx.lineWidth = 6;
        ctx.stroke();

        // Draw needle
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + radius * 0.8 * Math.cos(speedAngle),
            centerY + radius * 0.8 * Math.sin(speedAngle)
        );
        ctx.strokeStyle = 'var(--accent-color)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw center circle
        ctx.beginPath();
        ctx.arc(centerX, centerY, 15, 0, 2 * Math.PI);
        ctx.fillStyle = '#333';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'var(--accent-color)';
        ctx.fill();
    }

    drawHistoryGraph() {
        const ctx = this.historyCtx;
        const width = this.historyCanvas.width;
        const height = this.historyCanvas.height;

        ctx.clearRect(0, 0, width, height);

        // Draw background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i < width; i += 30) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i, height);
            ctx.stroke();
        }
        
        for (let i = 0; i < height; i += 20) {
            ctx.beginPath();
            ctx.moveTo(0, i);
            ctx.lineTo(width, i);
            ctx.stroke();
        }

        // Draw speed history
        if (this.speedHistory.length > 1) {
            const maxSpeed = this.isKph ? 220 : 140;
            
            // Draw area under the line
            ctx.beginPath();
            ctx.moveTo(0, height);
            ctx.lineTo(0, height - (this.speedHistory[0] / maxSpeed) * height);
            
            for (let i = 1; i < this.speedHistory.length; i++) {
                const x = (i / (this.speedHistory.length - 1)) * width;
                const y = height - (this.speedHistory[i] / maxSpeed) * height;
                ctx.lineTo(x, y);
            }
            
            ctx.lineTo(width, height);
            ctx.closePath();
            
            const gradient = ctx.createLinearGradient(0, 0, 0, height);
            gradient.addColorStop(0, 'rgba(0, 255, 255, 0.2)');
            gradient.addColorStop(1, 'rgba(0, 255, 255, 0)');
            ctx.fillStyle = gradient;
            ctx.fill();

            // Draw line
            ctx.beginPath();
            ctx.moveTo(0, height - (this.speedHistory[0] / maxSpeed) * height);
            
            for (let i = 1; i < this.speedHistory.length; i++) {
                const x = (i / (this.speedHistory.length - 1)) * width;
                const y = height - (this.speedHistory[i] / maxSpeed) * height;
                ctx.lineTo(x, y);
            }

            ctx.strokeStyle = 'var(--accent-color)';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }
}

// Initialize the speedometer when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new AdvancedSpeedometer();
});