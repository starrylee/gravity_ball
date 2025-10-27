// 主入口文件
window.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('gameCanvas');
    let game = null;
    
    // 初始化画布大小
    function initCanvasSize() {
        // 设置画布大小，保持合适的宽高比
        const containerWidth = window.innerWidth * 0.8;
        const containerHeight = window.innerHeight * 0.8;
        
        // 计算最佳尺寸（保持4:3的宽高比）
        let width, height;
        if (containerWidth / containerHeight > 4/3) {
            height = containerHeight;
            width = height * 4/3;
        } else {
            width = containerWidth;
            height = width * 3/4;
        }
        
        // 限制最大尺寸
        width = Math.min(width, 800);
        height = Math.min(height, 600);
        
        canvas.width = width;
        canvas.height = height;
        
        // 更新游戏画布大小（如果游戏已初始化）
        if (game) {
            game.resizeCanvas(width, height);
        }
    }
    
    // 初始化游戏
    function initGame() {
        game = new GravityBallGame(
            canvas,
            (score) => {
                // 分数更新回调
                console.log('Score updated:', score);
            },
            (finalScore, isWin) => {
                // 游戏结束回调
                console.log('Game over! Score:', finalScore, 'Win:', isWin);
            }
        );
        
        // 显示关卡选择界面
        document.getElementById('levelSelector').style.display = 'block';
    }
    
    // 窗口大小变化处理
    function handleResize() {
        initCanvasSize();
    }
    
    // 键盘事件处理
    function handleKeyPress(e) {
        switch (e.key) {
            case 'p':
            case 'P':
                // 暂停/继续
                if (game && document.getElementById('pauseBtn')) {
                    document.getElementById('pauseBtn').click();
                }
                break;
            case 'r':
            case 'R':
                // 重置
                if (game && document.getElementById('resetBtn')) {
                    document.getElementById('resetBtn').click();
                }
                break;
            case 'Escape':
                // 显示关卡选择
                if (game && !document.getElementById('gameOver').style.display) {
                    document.getElementById('levelSelector').style.display = 'block';
                    if (game.isRunning) {
                        game.isRunning = false;
                    }
                }
                break;
        }
    }
    
    // 触摸事件支持（移动设备）
    function initTouchSupport() {
        // 为触摸设备添加简单的触摸控制
        let lastTouchTime = 0;
        
        canvas.addEventListener('touchstart', (e) => {
            e.preventDefault(); // 防止滚动
            const touch = e.touches[0];
            
            // 模拟鼠标按下
            const mouseEvent = new MouseEvent('mousedown', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });
        
        canvas.addEventListener('touchmove', (e) => {
            e.preventDefault(); // 防止滚动
            const touch = e.touches[0];
            
            // 模拟鼠标移动
            const mouseEvent = new MouseEvent('mousemove', {
                clientX: touch.clientX,
                clientY: touch.clientY
            });
            canvas.dispatchEvent(mouseEvent);
        });
        
        canvas.addEventListener('touchend', (e) => {
            e.preventDefault();
            
            // 模拟鼠标释放
            const mouseEvent = new MouseEvent('mouseup', {});
            canvas.dispatchEvent(mouseEvent);
            
            // 双击检测（用于旋转障碍物）
            const currentTime = Date.now();
            if (currentTime - lastTouchTime < 300) {
                // 双击事件 - 旋转选中的障碍物
                rotateSelectedObstacle();
            }
            lastTouchTime = currentTime;
        });
    }
    
    // 旋转选中的障碍物
    function rotateSelectedObstacle() {
        if (!game || !game.isRunning || game.isPaused) return;
        
        const rect = canvas.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        
        // 查找点击位置的障碍物
        for (let i = game.entities.length - 1; i >= 0; i--) {
            const entity = game.entities[i];
            if (entity.type === 'obstacle') {
                // 简单的距离检查
                const dx = entity.x - (rect.width / 2);
                const dy = entity.y - (rect.height / 2);
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) { // 假设双击发生在中心附近
                    // 旋转45度
                    entity.rotation = (entity.rotation || 0) + Math.PI / 4;
                    break;
                }
            }
        }
    }
    
    // 添加旋转障碍物的功能（桌面端）
    function initRotationSupport() {
        canvas.addEventListener('dblclick', (e) => {
            e.preventDefault();
            
            if (!game || !game.isRunning || game.isPaused) return;
            
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // 查找点击位置的障碍物
            for (let i = game.entities.length - 1; i >= 0; i--) {
                const entity = game.entities[i];
                if (entity.type === 'obstacle' && game.isPointInObstacle(mouseX, mouseY, entity)) {
                    // 旋转45度
                    entity.rotation = (entity.rotation || 0) + Math.PI / 4;
                    break;
                }
            }
        });
    }
    
    // 初始化游戏说明
    function initGameInstructions() {
        // 创建游戏说明按钮
        const helpBtn = document.createElement('button');
        helpBtn.className = 'control-btn';
        helpBtn.textContent = '帮助';
        helpBtn.style.position = 'absolute';
        helpBtn.style.bottom = '10px';
        helpBtn.style.right = '10px';
        
        // 创建说明弹窗
        const helpModal = document.createElement('div');
        helpModal.style.position = 'fixed';
        helpModal.style.top = '50%';
        helpModal.style.left = '50%';
        helpModal.style.transform = 'translate(-50%, -50%)';
        helpModal.style.background = 'rgba(44, 62, 80, 0.95)';
        helpModal.style.color = 'white';
        helpModal.style.padding = '30px';
        helpModal.style.borderRadius = '10px';
        helpModal.style.zIndex = '1000';
        helpModal.style.display = 'none';
        helpModal.style.maxWidth = '500px';
        helpModal.style.maxHeight = '80vh';
        helpModal.style.overflowY = 'auto';
        
        helpModal.innerHTML = `
            <h3 style="margin-bottom: 20px;">游戏说明</h3>
            <div style="line-height: 1.6;">
                <p><strong>游戏目标：</strong>通过放置障碍物，引导彩色小球落入对应颜色的收集区。</p>
                <p><strong>操作方法：</strong></p>
                <ul style="margin-left: 20px;">
                    <li>点击底部选择障碍物类型</li>
                    <li>在画布上点击放置障碍物</li>
                    <li>拖拽障碍物调整位置</li>
                    <li>双击障碍物旋转角度</li>
                    <li>P键：暂停/继续游戏</li>
                    <li>R键：重置当前关卡</li>
                    <li>ESC键：返回关卡选择</li>
                </ul>
                <p><strong>障碍物类型：</strong></p>
                <ul style="margin-left: 20px;">
                    <li>平台：普通的阻挡物</li>
                    <li>斜坡：改变小球滚动方向</li>
                    <li>弹簧垫：弹跳小球到更高位置</li>
                </ul>
                <p><strong>计分规则：</strong></p>
                <ul style="margin-left: 20px;">
                    <li>正确颜色匹配：+10分</li>
                    <li>错误颜色匹配：-5分</li>
                </ul>
            </div>
            <button id="closeHelp" style="margin-top: 20px; padding: 10px 20px; background: #3498db; color: white; border: none; border-radius: 5px; cursor: pointer;">关闭</button>
        `;
        
        document.body.appendChild(helpBtn);
        document.body.appendChild(helpModal);
        
        helpBtn.addEventListener('click', () => {
            helpModal.style.display = 'block';
        });
        
        document.getElementById('closeHelp').addEventListener('click', () => {
            helpModal.style.display = 'none';
        });
        
        // 点击外部关闭
        helpModal.addEventListener('click', (e) => {
            if (e.target === helpModal) {
                helpModal.style.display = 'none';
            }
        });
    }
    
    // 性能优化：减少重绘
    function optimizePerformance() {
        // 使用requestAnimationFrame进行动画
        // 避免不必要的DOM操作
        // 限制粒子数量
    }
    
    // 初始化所有功能
    function initialize() {
        initCanvasSize();
        initGame();
        initRotationSupport();
        initTouchSupport();
        initGameInstructions();
        optimizePerformance();
        
        // 添加事件监听
        window.addEventListener('resize', handleResize);
        window.addEventListener('keydown', handleKeyPress);
        
        // 防止右键菜单
        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }
    
    // 启动应用
    initialize();
    
    // 导出一些全局方法（可选）
    window.gravityBallGame = {
        restart: () => {
            if (game) {
                game.startNewGame();
            }
        },
        pause: () => {
            if (game) {
                game.togglePause();
            }
        }
    };
});