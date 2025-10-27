// 物理引擎核心类
class PhysicsEngine {
    constructor() {
        this.gravity = 9.8; // 重力系数
        this.damping = 0.99; // 阻尼系数
        this.friction = 0.8; // 摩擦系数
        this.elasticity = 0.8; // 弹性系数
    }
    
    // 更新物理状态
    update(entities, deltaTime) {
        const dt = deltaTime / 1000; // 转换为秒
        
        // 更新所有实体的位置和速度
        entities.forEach(entity => {
            if (entity.type === 'ball') {
                this.applyGravity(entity, dt);
                this.applyDamping(entity);
                this.updatePosition(entity, dt);
            }
        });
        
        // 检测并处理碰撞
        this.detectCollisions(entities);
    }
    
    // 应用重力
    applyGravity(entity, dt) {
        entity.velocity.y += this.gravity * dt * 60; // 调整速度以匹配60fps
    }
    
    // 应用阻尼
    applyDamping(entity) {
        entity.velocity.x *= this.damping;
        entity.velocity.y *= this.damping;
    }
    
    // 更新位置
    updatePosition(entity, dt) {
        entity.x += entity.velocity.x * dt;
        entity.y += entity.velocity.y * dt;
        
        // 更新旋转
        if (entity.rotationSpeed) {
            entity.rotation += entity.rotationSpeed * dt;
        }
    }
    
    // 检测所有碰撞
    detectCollisions(entities) {
        const balls = entities.filter(e => e.type === 'ball');
        const obstacles = entities.filter(e => e.type === 'obstacle');
        const collectors = entities.filter(e => e.type === 'collector');
        
        // 球与球之间的碰撞
        for (let i = 0; i < balls.length; i++) {
            for (let j = i + 1; j < balls.length; j++) {
                this.detectBallCollision(balls[i], balls[j]);
            }
            
            // 球与障碍物的碰撞
            obstacles.forEach(obstacle => {
                this.detectBallObstacleCollision(balls[i], obstacle);
            });
            
            // 球与收集区的碰撞
            collectors.forEach(collector => {
                this.detectCollectorCollision(balls[i], collector);
            });
        }
    }
    
    // 检测球与球之间的碰撞
    detectBallCollision(ball1, ball2) {
        const dx = ball2.x - ball1.x;
        const dy = ball2.y - ball1.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = ball1.radius + ball2.radius;
        
        if (distance < minDistance) {
            // 碰撞发生
            const angle = Math.atan2(dy, dx);
            const overlap = minDistance - distance;
            
            // 分离两个球
            ball1.x -= Math.cos(angle) * overlap * 0.5;
            ball1.y -= Math.sin(angle) * overlap * 0.5;
            ball2.x += Math.cos(angle) * overlap * 0.5;
            ball2.y += Math.sin(angle) * overlap * 0.5;
            
            // 计算碰撞后的速度
            const v1x = ball1.velocity.x;
            const v1y = ball1.velocity.y;
            const v2x = ball2.velocity.x;
            const v2y = ball2.velocity.y;
            
            const dvx = v2x - v1x;
            const dvy = v2y - v1y;
            const dotProduct = dvx * dx + dvy * dy;
            
            if (dotProduct < 0) {
                const m1 = ball1.mass || 1;
                const m2 = ball2.mass || 1;
                const impulse = 2 * dotProduct / (distance * (m1 + m2)) * this.elasticity;
                
                ball1.velocity.x += impulse * m2 * dx / distance;
                ball1.velocity.y += impulse * m2 * dy / distance;
                ball2.velocity.x -= impulse * m1 * dx / distance;
                ball2.velocity.y -= impulse * m1 * dy / distance;
            }
            
            // 触发碰撞特效
            if (ball1.onCollision) ball1.onCollision(ball2);
            if (ball2.onCollision) ball2.onCollision(ball1);
        }
    }
    
    // 检测球与障碍物的碰撞
    detectBallObstacleCollision(ball, obstacle) {
        switch (obstacle.obstacleType) {
            case 'platform':
                this.detectPlatformCollision(ball, obstacle);
                break;
            case 'ramp':
                this.detectRampCollision(ball, obstacle);
                break;
            case 'spring':
                this.detectSpringCollision(ball, obstacle);
                break;
        }
    }
    
    // 检测平台碰撞
    detectPlatformCollision(ball, platform) {
        // 平台的矩形边界
        const platformLeft = platform.x - platform.width / 2;
        const platformRight = platform.x + platform.width / 2;
        const platformTop = platform.y - platform.height / 2;
        const platformBottom = platform.y + platform.height / 2;
        
        // 球的边界
        const ballLeft = ball.x - ball.radius;
        const ballRight = ball.x + ball.radius;
        const ballTop = ball.y - ball.radius;
        const ballBottom = ball.y + ball.radius;
        
        // 检测碰撞
        if (ballRight > platformLeft && ballLeft < platformRight &&
            ballBottom > platformTop && ballTop < platformBottom) {
            
            // 计算最近点
            const closestX = Math.max(platformLeft, Math.min(ball.x, platformRight));
            const closestY = Math.max(platformTop, Math.min(ball.y, platformBottom));
            
            const dx = ball.x - closestX;
            const dy = ball.y - closestY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < ball.radius) {
                // 碰撞发生
                const angle = Math.atan2(dy, dx);
                const overlap = ball.radius - distance;
                
                // 分离球
                ball.x += Math.cos(angle) * overlap;
                ball.y += Math.sin(angle) * overlap;
                
                // 计算反弹
                const normalX = dx / distance;
                const normalY = dy / distance;
                
                const dot = ball.velocity.x * normalX + ball.velocity.y * normalY;
                
                if (dot < 0) {
                    ball.velocity.x -= 2 * dot * normalX * this.elasticity;
                    ball.velocity.y -= 2 * dot * normalY * this.elasticity;
                    
                    // 应用摩擦力（只有在水平表面时）
                    if (Math.abs(normalY) > 0.9) {
                        ball.velocity.x *= this.friction;
                    }
                }
            }
        }
    }
    
    // 检测斜坡碰撞
    detectRampCollision(ball, ramp) {
        // 简化版斜坡碰撞检测
        // 假设斜坡是从左上到右下的斜面
        const rampLeft = ramp.x - ramp.width / 2;
        const rampRight = ramp.x + ramp.width / 2;
        const rampTop = ramp.y - ramp.height / 2;
        const rampBottom = ramp.y + ramp.height / 2;
        
        // 检查球是否在斜坡区域内
        if (ball.x > rampLeft && ball.x < rampRight &&
            ball.y > rampTop && ball.y < rampBottom) {
            
            // 斜坡的角度
            const rampAngle = ramp.rotation || Math.PI / 4; // 默认45度
            const slope = Math.tan(rampAngle);
            
            // 计算球到斜坡表面的距离
            const rampY = rampTop + (ball.x - rampLeft) * slope;
            const distance = Math.abs(ball.y - rampY);
            
            if (distance < ball.radius) {
                // 碰撞发生
                const normalX = -slope;
                const normalY = 1;
                const len = Math.sqrt(normalX * normalX + normalY * normalY);
                
                // 标准化法线
                const normX = normalX / len;
                const normY = normalY / len;
                
                // 分离球
                ball.y = rampY + ball.radius * Math.sign(ball.y - rampY);
                
                // 计算反弹
                const dot = ball.velocity.x * normX + ball.velocity.y * normY;
                
                if (dot < 0) {
                    ball.velocity.x -= 2 * dot * normX * this.elasticity;
                    ball.velocity.y -= 2 * dot * normY * this.elasticity;
                    
                    // 应用摩擦力
                    const tangentX = -normY;
                    const tangentY = normX;
                    const tangentDot = ball.velocity.x * tangentX + ball.velocity.y * tangentY;
                    
                    ball.velocity.x -= tangentDot * tangentX * (1 - this.friction);
                    ball.velocity.y -= tangentDot * tangentY * (1 - this.friction);
                }
            }
        }
    }
    
    // 检测弹簧垫碰撞
    detectSpringCollision(ball, spring) {
        const dx = ball.x - spring.x;
        const dy = ball.y - spring.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = ball.radius + spring.width / 2;
        
        if (distance < minDistance) {
            // 碰撞发生
            const angle = Math.atan2(dy, dx);
            const overlap = minDistance - distance;
            
            // 分离球
            ball.x += Math.cos(angle) * overlap;
            ball.y += Math.sin(angle) * overlap;
            
            // 弹簧效果 - 更强的弹力
            const springForce = 1.5; // 弹簧系数
            ball.velocity.y = -Math.abs(ball.velocity.y) * springForce * this.elasticity;
            
            // 触发弹簧特效
            if (spring.onCollision) spring.onCollision(ball);
        }
    }
    
    // 检测收集区碰撞
    detectCollectorCollision(ball, collector) {
        const dx = ball.x - collector.x;
        const dy = ball.y - collector.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const minDistance = collector.radius;
        
        if (distance < minDistance) {
            // 颜色匹配检测
            const isColorMatch = ball.color === collector.color;
            
            // 触发收集事件
            if (collector.onCollect) {
                collector.onCollect(ball, isColorMatch);
            }
            
            // 移除球
            ball.remove = true;
        }
    }
    
    // 检测边界碰撞
    checkBoundaryCollision(entity, canvasWidth, canvasHeight) {
        // 左右边界
        if (entity.x - entity.radius < 0) {
            entity.x = entity.radius;
            entity.velocity.x = Math.abs(entity.velocity.x) * this.elasticity;
        } else if (entity.x + entity.radius > canvasWidth) {
            entity.x = canvasWidth - entity.radius;
            entity.velocity.x = -Math.abs(entity.velocity.x) * this.elasticity;
        }
        
        // 上边界（顶部有限制，但允许球从顶部落下）
        if (entity.y - entity.radius < 0) {
            entity.y = entity.radius;
            entity.velocity.y = Math.abs(entity.velocity.y) * this.elasticity;
        }
        
        // 下边界（底部有收集区，所以不做反弹）
    }
    
    // 设置重力系数
    setGravity(gravity) {
        this.gravity = gravity;
    }
    
    // 设置阻尼系数
    setDamping(damping) {
        this.damping = damping;
    }
    
    // 设置摩擦系数
    setFriction(friction) {
        this.friction = friction;
    }
    
    // 设置弹性系数
    setElasticity(elasticity) {
        this.elasticity = elasticity;
    }
}