// 存储数据的变量
let memories = JSON.parse(localStorage.getItem('floraleaf_memories') || '[]');
let isTimelineAscending = false; // 默认最新的在前面

// 页面加载时初始化
window.addEventListener('load', function() {
    loadStoredData();
    updateTimeline();
    
    // 设置日期输入框的默认值为当前时间
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('memoryDate').value = `${year}-${month}-${day}T${hours}:${minutes}`;
});

// 显示不同的部分
function showSection(sectionName) {
    // 隐藏所有部分
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    // 移除所有导航按钮的active状态
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    // 显示选中的部分
    document.getElementById(sectionName).classList.add('active');
    
    // 高亮对应的导航按钮
    const activeBtn = document.querySelector(`[onclick="showSection('${sectionName}')"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

// 切换时间轴排序
function toggleTimelineSort() {
    isTimelineAscending = !isTimelineAscending;
    const sortBtn = document.querySelector('.sort-btn .sort-text');
    sortBtn.textContent = isTimelineAscending ? '最早优先' : '最新优先';
    updateTimeline();
}

// 删除回忆
function deleteMemory(id) {
    if (confirm('确定要删除这条回忆吗？')) {
        memories = memories.filter(memory => memory.id !== id);
        localStorage.setItem('floraleaf_memories', JSON.stringify(memories));
        updateTimeline();
        showNotification('回忆已删除');
    }
}

// 更新时间轴显示
function updateTimeline() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';
    
    // 对记忆进行排序（使用事件发生时间）
    const sortedMemories = [...memories].sort((a, b) => {
        const timeA = new Date(a.eventDate).getTime();
        const timeB = new Date(b.eventDate).getTime();
        return isTimelineAscending ? timeA - timeB : timeB - timeA;
    });
    
    sortedMemories.forEach(memory => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        
        let mediaContent = '';
        if (memory.type === 'photo' && memory.photos) {
            mediaContent = memory.photos.map(photo => 
                `<img src="${photo}" alt="${memory.title || '照片'}">`
            ).join('');
        } else if (memory.type === 'video' && memory.video) {
            mediaContent = `
                <video controls>
                    <source src="${memory.video}" type="video/mp4">
                    您的浏览器不支持视频播放
                </video>
            `;
        }
        
        timelineItem.innerHTML = `
            <div class="timeline-content">
                <button class="delete-btn" onclick="deleteMemory(${memory.id})" title="删除这条回忆"></button>
                <div class="timeline-date">${formatDate(memory.eventDate)}</div>
                ${mediaContent ? `<div class="timeline-media">${mediaContent}</div>` : ''}
                <div class="timeline-text">
                    ${memory.title ? `<h3>${memory.title}</h3>` : ''}
                    <p>${memory.content}</p>
                </div>
                <div class="timeline-posted">发布于: ${formatDate(memory.createdAt)}</div>
            </div>
        `;
        
        timeline.appendChild(timelineItem);
    });
}

// 切换上传类型
function switchUploadType(type) {
    // 更新按钮状态
    document.querySelectorAll('.upload-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="switchUploadType('${type}')"]`).classList.add('active');
    
    // 显示/隐藏相应的上传区域
    document.getElementById('photoUpload').classList.toggle('hidden', type !== 'photo');
    document.getElementById('videoUpload').classList.toggle('hidden', type !== 'video');
    
    // 记住当前选择的类型
    currentUploadType = type;
}

// 保存回忆
function saveMemory() {
    const title = document.getElementById('memoryTitle').value;
    const content = document.getElementById('memoryContent').value;
    const eventDate = document.getElementById('memoryDate').value;
    
    if (!content || !eventDate) {
        showNotification('Please fill in the required fields', 'error');
        return;
    }
    
    const memory = {
        id: Date.now(),
        type: currentUploadType,
        title: title,
        content: content,
        eventDate: eventDate, // 事件发生的时间
        createdAt: new Date().toISOString() // 创建时间
    };
    
    // 根据类型处理媒体文件
    if (currentUploadType === 'photo' && currentPhotos.length > 0) {
        memory.photos = [...currentPhotos];
        currentPhotos = []; // 清空临时存储
    } else if (currentUploadType === 'video' && currentVideo) {
        memory.video = currentVideo;
        currentVideo = null; // 清空临时存储
    }
    
    memories.push(memory);
    localStorage.setItem('floraleaf_memories', JSON.stringify(memories));
    
    // 更新显示
    updateTimeline();
    
    // 清空表单
    document.getElementById('memoryTitle').value = '';
    document.getElementById('memoryContent').value = '';
    // 重置日期为当前时间
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    document.getElementById('memoryDate').value = `${year}-${month}-${day}T${hours}:${minutes}`;
    
    showNotification('Memory saved successfully! 💕');
}

// 加载存储的数据
function loadStoredData() {
    // 加载回忆
    memories.forEach(memory => {
        // 对于每个记忆，如果它有媒体文件，则将它们添加到当前的临时存储中
        if (memory.type === 'photo' && memory.photos) {
            currentPhotos = [...memory.photos];
        } else if (memory.type === 'video' && memory.video) {
            currentVideo = memory.video;
        }
    });
    updateTimeline(); // 确保在加载数据后更新时间轴
}

// 处理照片上传
let currentPhotos = [];
document.getElementById('photoInput').addEventListener('change', function(e) {
    const files = e.target.files;
    handleFiles(files, 'photo');
});

// 处理视频上传
let currentVideo = null;
document.getElementById('videoInput').addEventListener('change', function(e) {
    const files = e.target.files;
    handleFiles(files, 'video');
});

// 处理文件上传
function handleFiles(files, type) {
    for (let file of files) {
        const reader = new FileReader();
        reader.onload = function(e) {
            if (type === 'photo') {
                currentPhotos.push(e.target.result);
                showNotification('Photo added successfully! 📸');
            } else if (type === 'video') {
                currentVideo = e.target.result;
                showNotification('Video added successfully! 🎬');
            }
        };
        reader.readAsDataURL(file);
    }
}

// 格式化日期显示
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// 添加拖拽上传功能
document.querySelectorAll('.upload-area').forEach(area => {
    area.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        this.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    
    area.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.style.background = 'rgba(255, 255, 255, 0.05)';
    });
    
    area.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.style.background = 'rgba(255, 255, 255, 0.05)';
        
        const files = e.dataTransfer.files;
        const type = this.id === 'photoUpload' ? 'photo' : 'video';
        handleFiles(files, type);
    });
});

// 显示通知消息
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.classList.add('show'), 100);
    
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// 初始化上传类型
let currentUploadType = 'photo';
switchUploadType('photo'); 
