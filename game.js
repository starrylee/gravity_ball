// 游戏核心类
class GravityBallGame {
    constructor(canvas, onScoreUpdate, onGameOver) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.physicsEngine = new PhysicsEngine();
        this.onScoreUpdate = onScoreUpdate;
        this.onGameOver = onGameOver;
        
        // 游戏状态
        this.isRunning = false;
        this.isPaused = false;
        this.score = 0;
        this.level = 1;
        this.timeLeft = 60;
        this.lastTime = 0;
        
        // 游戏实体
        this.entities = [];
        this.particles = [];
        this.selectedObstacle = null;
        this.draggingObstacle = null;
        this.dragOffset = { x: 0, y: 0 };
        
        // 关卡配置
        this.levels = [
            // 关卡1
            {
                ballSpawnRate: 1.5, // 秒
                ballCount: 10,
                gravity: 9.8,
                timeLimit: 60
            },
            // 关卡2
            {
                ballSpawnRate: 1.0,
                ballCount: 15,
                gravity: 12.0,
                timeLimit: 50
            },
            // 关卡3
            {
                ballSpawnRate: 0.8,
                ballCount: 20,
                gravity: 15.0,
                timeLimit: 45
            }
        ];
        
        // 颜色配置
        this.colors = {
            red: '#e74c3c',
            green: '#2ecc71',
            blue: '#3498db'
        };
        
        // 计时和生成控制
        this.lastBallSpawn = 0;
        this.spawnedBalls = 0;
        this.timerInterval = null;
        
        // 初始化事件监听
        this.initEventListeners();
    }
    
    // 初始化事件监听
    initEventListeners() {
        // 鼠标点击/拖拽事件
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.onMouseUp(e));
        
        // 障碍物选择
        document.querySelectorAll('.obstacle-item').forEach(item => {
            item.addEventListener('click', () => {
                document.querySelectorAll('.obstacle-item').forEach(i => i.classList.remove('selected'));
                item.classList.add('selected');
                this.selectedObstacle = item.dataset.type;
            });
        });
        
        // 控制按钮
        document.getElementById('pauseBtn').addEventListener('click', () => this.togglePause());
        document.getElementById('resetBtn').addEventListener('click', () => this.resetLevel());
        document.getElementById('restartBtn').addEventListener('click', () => this.startNewGame());
        
        // 关卡选择
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.level = parseInt(btn.dataset.level);
                document.getElementById('levelSelector').style.display = 'none';
                this.startLevel();
            });
        });
    }
    
    // 开始新游戏
    startNewGame() {
        this.score = 0;
        this.updateScoreDisplay();
        document.getElementById('gameOver').style.display = 'none';
        document.getElementById('levelSelector').style.display = 'block';
    }
    
    // 开始关卡
    startLevel() {
        const levelConfig = this.levels[this.level - 1];
        
        // 重置游戏状态
        this.resetGameState();
        this.timeLeft = levelConfig.timeLimit;
        this.physicsEngine.setGravity(levelConfig.gravity);
        
        // 更新显示
        document.getElementById('level').textContent = this.level;
        document.getElementById('timer').textContent = this.timeLeft;
        
        // 创建收集区
        this.createCollectors();
        
        // 开始游戏循环
        this.isRunning = true;
        this.isPaused = false;
        this.lastTime = performance.now();
        
        // 启动计时器
        this.startTimer();
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    // 重置游戏状态
    resetGameState() {
        this.entities = [];
        this.particles = [];
        this.selectedObstacle = null;
        this.draggingObstacle = null;
        this.lastBallSpawn = 0;
        this.spawnedBalls = 0;
        
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }
    }
    
    // 创建收集区
    createCollectors() {
        const collectorRadius = 50;
        const spacing = this.canvas.width / 4;
        
        const collectors = [
            { x: spacing, y: this.canvas.height - 50, color: 'red' },
            { x: this.canvas.width / 2, y: this.canvas.height - 50, color: 'green' },
            { x: this.canvas.width - spacing, y: this.canvas.height - 50, color: 'blue' }
        ];
        
        collectors.forEach(collector => {
            this.entities.push({
                type: 'collector',
                x: collector.x,
                y: collector.y,
                radius: collectorRadius,
                color: collector.color,
                onCollect: (ball, isMatch) => this.onBallCollected(ball, isMatch)
            });
        });
    }
    
    // 游戏主循环
    gameLoop(timestamp) {
        if (!this.isRunning || this.isPaused) return;
        
        const deltaTime = timestamp - this.lastTime;
        this.lastTime = timestamp;
        
        // 清空画布
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 生成小球
        this.spawnBalls(timestamp);
        
        // 更新物理状态
        this.physicsEngine.update(this.entities, deltaTime);
        
        // 检测边界碰撞
        this.entities.filter(e => e.type === 'ball').forEach(ball => {
            this.physicsEngine.checkBoundaryCollision(ball, this.canvas.width, this.canvas.height);
            // 移除掉出屏幕底部的球
            if (ball.y > this.canvas.height + 100) {
                ball.remove = true;
            }
        });
        
        // 更新并绘制粒子
        this.updateParticles(deltaTime);
        this.drawParticles();
        
        // 移除标记为删除的实体
        this.entities = this.entities.filter(e => !e.remove);
        
        // 绘制所有实体
        this.drawEntities();
        
        // 检查游戏结束条件
        this.checkGameOver();
        
        // 继续游戏循环
        requestAnimationFrame(this.gameLoop.bind(this));
    }
    
    // 生成小球
    spawnBalls(timestamp) {
        const levelConfig = this.levels[this.level - 1];
        
        if (this.spawnedBalls >= levelConfig.ballCount) return;
        
        const elapsedTime = (timestamp - this.lastBallSpawn) / 1000;
        
        if (elapsedTime >= levelConfig.ballSpawnRate) {
            const colors = ['red', 'green', 'blue'];
            const randomColor = colors[Math.floor(Math.random() * colors.length)];
            
            const ball = {
                type: 'ball',
                x: Math.random() * (this.canvas.width - 100) + 50,
                y: -50,
                radius: 20,
                color: randomColor,
                velocity: { x: (Math.random() - 0.5) * 50, y: 0 },
                rotation: 0,
                rotationSpeed: (Math.random() - 0.5) * 5,
                onCollision: (other) => this.createCollisionParticles(ball)
            };
            
            this.entities.push(ball);
            this.lastBallSpawn = timestamp;
            this.spawnedBalls++;
        }
    }
    
    // 绘制所有实体
    drawEntities() {
        // 绘制收集区
        this.entities.filter(e => e.type === 'collector').forEach(this.drawCollector.bind(this));
        
        // 绘制障碍物
        this.entities.filter(e => e.type === 'obstacle').forEach(this.drawObstacle.bind(this));
        
        // 绘制小球
        this.entities.filter(e => e.type === 'ball').forEach(this.drawBall.bind(this));
    }
    
    // 绘制小球
    drawBall(ball) {
        this.ctx.save();
        this.ctx.translate(ball.x, ball.y);
        this.ctx.rotate(ball.rotation);
        
        // 绘制球体
        this.ctx.beginPath();
        this.ctx.arc(0, 0, ball.radius, 0, Math.PI * 2);
        this.ctx.fillStyle = this.colors[ball.color];
        this.ctx.fill();
        
        // 添加高光效果
        this.ctx.beginPath();
        this.ctx.arc(-ball.radius * 0.3, -ball.radius * 0.3, ball.radius * 0.2, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        this.ctx.fill();
        
        this.ctx.restore();
    }
    
    // 绘制障碍物
    drawObstacle(obstacle) {
        this.ctx.save();
        this.ctx.translate(obstacle.x, obstacle.y);
        this.ctx.rotate(obstacle.rotation || 0);
        
        switch (obstacle.obstacleType) {
            case 'platform':
                this.ctx.fillStyle = '#95a5a6';
                this.ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
                break;
            case 'ramp':
                this.ctx.fillStyle = '#7f8c8d';
                this.ctx.beginPath();
                this.ctx.moveTo(-obstacle.width / 2, obstacle.height / 2);
                this.ctx.lineTo(obstacle.width / 2, obstacle.height / 2);
                this.ctx.lineTo(-obstacle.width / 2, -obstacle.height / 2);
                this.ctx.closePath();
                this.ctx.fill();
                break;
            case 'spring':
                this.ctx.fillStyle = '#f1c40f';
                this.ctx.fillRect(-obstacle.width / 2, -obstacle.height / 2, obstacle.width, obstacle.height);
                // 绘制弹簧线条
                this.ctx.strokeStyle = '#e67e22';
                this.ctx.lineWidth = 3;
                this.ctx.beginPath();
                for (let i = -obstacle.width / 2 + 10; i < obstacle.width / 2 - 5; i += 10) {
                    this.ctx.moveTo(i, 0);
                    this.ctx.lineTo(i + 5, -obstacle.height / 3);
                    this.ctx.lineTo(i + 10, 0);
                }
                this.ctx.stroke();
                break;
        }
        
        this.ctx.restore();
    }
    
    // 绘制收集区
    drawCollector(collector) {
        this.ctx.save();
        
        // 绘制收集区底部阴影
        this.ctx.beginPath();
        this.ctx.arc(collector.x, collector.y + 5, collector.radius, 0, Math.PI);
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
        this.ctx.fill();
        
        // 绘制收集区主体
        this.ctx.beginPath();
        this.ctx.arc(collector.x, collector.y, collector.radius, 0, Math.PI);
        this.ctx.lineTo(collector.x - collector.radius, collector.y);
        this.ctx.closePath();
        this.ctx.fillStyle = this.colors[collector.color];
        this.ctx.fill();
        
        // 添加发光效果
        this.ctx.beginPath();
        this.ctx.arc(collector.x, collector.y, collector.radius + 5, 0, Math.PI);
        this.ctx.strokeStyle = `${this.colors[collector.color]}80`;
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        
        this.ctx.restore();
    }
    
    // 鼠标按下事件
    onMouseDown(e) {
        if (!this.isRunning || this.isPaused) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 检查是否点击了已有障碍物
        for (let i = this.entities.length - 1; i >= 0; i--) {
            const entity = this.entities[i];
            if (entity.type === 'obstacle') {
                if (this.isPointInObstacle(mouseX, mouseY, entity)) {
                    this.draggingObstacle = entity;
                    this.dragOffset.x = mouseX - entity.x;
                    this.dragOffset.y = mouseY - entity.y;
                    return;
                }
            }
        }
        
        // 如果选择了障碍物类型，则创建新障碍物
        if (this.selectedObstacle) {
            this.createObstacle(mouseX, mouseY, this.selectedObstacle);
        }
    }
    
    // 鼠标移动事件
    onMouseMove(e) {
        if (!this.draggingObstacle || !this.isRunning || this.isPaused) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // 更新拖拽的障碍物位置
        this.draggingObstacle.x = mouseX - this.dragOffset.x;
        this.draggingObstacle.y = mouseY - this.dragOffset.y;
        
        // 限制在画布内
        const obs = this.draggingObstacle;
        obs.x = Math.max(obs.width / 2, Math.min(this.canvas.width - obs.width / 2, obs.x));
        obs.y = Math.max(obs.height / 2, Math.min(this.canvas.height - 100, obs.y));
    }
    
    // 鼠标释放事件
    onMouseUp(e) {
        this.draggingObstacle = null;
    }
    
    // 创建障碍物
    createObstacle(x, y, type) {
        const obstacleConfig = {
            platform: { width: 100, height: 20 },
            ramp: { width: 100, height: 50 },
            spring: { width: 60, height: 20 }
        };
        
        const config = obstacleConfig[type];
        const obstacle = {
            type: 'obstacle',
            obstacleType: type,
            x: x,
            y: y,
            width: config.width,
            height: config.height,
            rotation: 0
        };
        
        // 弹簧特殊处理
        if (type === 'spring') {
            obstacle.onCollision = (ball) => this.createSpringEffect(ball);
        }
        
        this.entities.push(obstacle);
    }
    
    // 检查点是否在障碍物内
    isPointInObstacle(x, y, obstacle) {
        const dx = x - obstacle.x;
        const dy = y - obstacle.y;
        
        // 考虑旋转
        const angle = obstacle.rotation || 0;
        const cos = Math.cos(-angle);
        const sin = Math.sin(-angle);
        
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;
        
        return Math.abs(localX) <= obstacle.width / 2 && Math.abs(localY) <= obstacle.height / 2;
    }
    
    // 当球被收集时
    onBallCollected(ball, isMatch) {
        if (isMatch) {
            this.score += 10;
            this.createScoreEffect(ball.x, ball.y, '+10', 'green');
        } else {
            this.score -= 5;
            this.createScoreEffect(ball.x, ball.y, '-5', 'red');
        }
        
        this.updateScoreDisplay();
        this.createCollectionParticles(ball.x, ball.y, ball.color, isMatch);
    }
    
    // 更新分数显示
    updateScoreDisplay() {
        document.getElementById('score').textContent = this.score;
        if (this.onScoreUpdate) {
            this.onScoreUpdate(this.score);
        }
    }
    
    // 开始计时器
    startTimer() {
        this.timerInterval = setInterval(() => {
            if (!this.isPaused && this.isRunning) {
                this.timeLeft--;
                document.getElementById('timer').textContent = this.timeLeft;
                
                if (this.timeLeft <= 0) {
                    this.endGame();
                }
            }
        }, 1000);
    }
    
    // 切换暂停状态
    togglePause() {
        if (!this.isRunning) return;
        
        this.isPaused = !this.isPaused;
        document.getElementById('pauseBtn').textContent = this.isPaused ? '继续' : '暂停';
        
        if (!this.isPaused) {
            this.lastTime = performance.now();
            requestAnimationFrame(this.gameLoop.bind(this));
        }
    }
    
    // 重置关卡
    resetLevel() {
        this.startLevel();
    }
    
    // 检查游戏结束条件
    checkGameOver() {
        const levelConfig = this.levels[this.level - 1];
        const activeBalls = this.entities.filter(e => e.type === 'ball').length;
        
        // 如果所有球都已生成且没有活跃的球，则关卡完成
        if (this.spawnedBalls >= levelConfig.ballCount && activeBalls === 0) {
            // 检查是否是最后一关
            if (this.level >= this.levels.length) {
                this.endGame(true);
            } else {
                // 进入下一关
                setTimeout(() => {
                    this.level++;
                    this.startLevel();
                }, 2000);
            }
        }
    }
    
    // 结束游戏
    endGame(isWin = false) {
        this.isRunning = false;
        clearInterval(this.timerInterval);
        
        const gameOverElement = document.getElementById('gameOver');
        const finalScoreElement = document.getElementById('finalScore');
        
        finalScoreElement.textContent = this.score;
        gameOverElement.querySelector('h2').textContent = isWin ? '恭喜通关！' : '游戏结束';
        gameOverElement.style.display = 'block';
        
        if (this.onGameOver) {
            this.onGameOver(this.score, isWin);
        }
    }
    
    // 特效相关方法
    createCollisionParticles(ball) {
        for (let i = 0; i < 8; i++) {
            const angle = (Math.PI * 2 * i) / 8;
            const speed = 2 + Math.random() * 3;
            
            this.particles.push({
                x: ball.x,
                y: ball.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: this.colors[ball.color],
                size: 3 + Math.random() * 3,
                life: 30 + Math.random() * 20
            });
        }
    }
    
    createCollectionParticles(x, y, color, isMatch) {
        const particleCount = isMatch ? 12 : 6;
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const speed = isMatch ? 3 + Math.random() * 4 : 1 + Math.random() * 2;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: isMatch ? this.colors[color] : '#e74c3c',
                size: 4 + Math.random() * 4,
                life: 40 + Math.random() * 30
            });
        }
    }
    
    createSpringEffect(ball) {
        // 创建弹簧特效
        for (let i = 0; i < 10; i++) {
            const angle = (Math.PI * 2 * i) / 10;
            const speed = 2 + Math.random() * 4;
            
            this.particles.push({
                x: ball.x,
                y: ball.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: '#f1c40f',
                size: 2 + Math.random() * 3,
                life: 30 + Math.random() * 20
            });
        }
    }
    
    createScoreEffect(x, y, text, color) {
        // 创建分数浮动效果（在UI层实现）
        const scoreElement = document.createElement('div');
        scoreElement.textContent = text;
        scoreElement.style.position = 'absolute';
        scoreElement.style.left = `${x}px`;
        scoreElement.style.top = `${y}px`;
        scoreElement.style.color = color;
        scoreElement.style.fontSize = '24px';
        scoreElement.style.fontWeight = 'bold';
        scoreElement.style.pointerEvents = 'none';
        scoreElement.style.zIndex = '100';
        scoreElement.style.opacity = '1';
        scoreElement.style.transition = 'all 1s ease-out';
        
        this.canvas.parentNode.appendChild(scoreElement);
        
        // 动画效果
        setTimeout(() => {
            scoreElement.style.transform = 'translateY(-30px)';
            scoreElement.style.opacity = '0';
            
            setTimeout(() => {
                scoreElement.remove();
            }, 1000);
        }, 10);
    }
    
    // 更新粒子
    updateParticles(deltaTime) {
        const dt = deltaTime / 16.67; // 标准化到60fps
        
        this.particles = this.particles.filter(particle => {
            particle.x += particle.vx * dt;
            particle.y += particle.vy * dt;
            particle.vy += 0.1 * dt; // 粒子下落
            particle.life -= 1 * dt;
            
            return particle.life > 0;
        });
    }
    
    // 绘制粒子
    drawParticles() {
        this.particles.forEach(particle => {
            this.ctx.save();
            this.ctx.globalAlpha = particle.life / 100;
            this.ctx.fillStyle = particle.color;
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.restore();
        });
    }
    
    // 调整画布大小
    resizeCanvas(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
    }
}