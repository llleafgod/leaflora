const API_BASE_URL = 'https://api.leaflora.dpdns.org/api';

// 存储数据的变量
let memories = [];
let isTimelineAscending = false;
let currentUploadType = 'photo';
let currentFiles = [];
let authToken = null;

// 页面加载时初始化
window.addEventListener('load', function() {
    checkAuth();
    initializeDateInput();
    setupFileInputs();
    setupDragAndDrop();
});

// 检查认证状态
async function checkAuth() {
    authToken = sessionStorage.getItem('auth_token');
    
    if (!authToken) {
        showLoginModal();
        return;
    }
    
    // 验证token是否有效
    try {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success && result.valid) {
            hideLoginModal();
            loadMemories();
        } else {
            sessionStorage.removeItem('auth_token');
            showLoginModal();
        }
    } catch (error) {
        console.error('Auth verification failed:', error);
        sessionStorage.removeItem('auth_token');
        showLoginModal();
    }
}

// 显示登录模态框
function showLoginModal() {
    document.getElementById('loginModal').style.display = 'flex';
    document.getElementById('mainContent').style.display = 'none';
    document.getElementById('passwordInput').focus();
}

// 隐藏登录模态框
function hideLoginModal() {
    document.getElementById('loginModal').style.display = 'none';
    document.getElementById('mainContent').style.display = 'block';
}

// 登录
async function login() {
    const password = document.getElementById('passwordInput').value;
    const errorElement = document.getElementById('loginError');
    
    if (!password) {
        errorElement.textContent = '请输入密码';
        return;
    }
    
    try {
        console.log('Attempting login to:', `${API_BASE_URL}/auth/login`);
        
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ password })
        });
        
        console.log('Login response status:', response.status);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        console.log('Login response data:', result);
        
        if (result.success) {
            authToken = result.token;
            sessionStorage.setItem('auth_token', authToken);
            errorElement.textContent = '';
            hideLoginModal();
            loadMemories();
            showNotification('登录成功！');
        } else {
            errorElement.textContent = result.message || '登录失败';
        }
    } catch (error) {
        console.error('Login error details:', error);
        errorElement.textContent = `网络错误：${error.message}`;
    }
}

// 退出登录
function logout() {
    if (confirm('确定要退出登录吗？')) {
        sessionStorage.removeItem('auth_token');
        authToken = null;
        memories = [];
        document.getElementById('timeline').innerHTML = '';
        showLoginModal();
        showNotification('已退出登录');
    }
}

// 处理密码输入框回车事件
function handlePasswordKeyPress(event) {
    if (event.key === 'Enter') {
        login();
    }
}

// 初始化日期输入框
function initializeDateInput() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    document.getElementById('memoryDate').value = `${year}-${month}-${day}`;
}

// 加载回忆数据
async function loadMemories() {
    if (!authToken) return;
    
    const loading = document.getElementById('timelineLoading');
    loading.style.display = 'block';
    
    try {
        const sortParam = isTimelineAscending ? 'asc' : 'desc';
        const response = await fetch(`${API_BASE_URL}/memories?sort=${sortParam}`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            memories = result.data || [];
            updateTimeline();
        } else {
            showNotification('加载回忆失败：' + result.message, 'error');
        }
    } catch (error) {
        console.error('Load memories failed:', error);
        showNotification('网络错误，加载失败', 'error');
    } finally {
        loading.style.display = 'none';
    }
}

// 显示不同的部分
function showSection(sectionName) {
    const sections = document.querySelectorAll('.section');
    sections.forEach(section => section.classList.remove('active'));
    
    const navBtns = document.querySelectorAll('.nav-btn');
    navBtns.forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(sectionName).classList.add('active');
    
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
    loadMemories(); // 重新加载数据
}

// 删除回忆
async function deleteMemory(id) {
    if (!confirm('确定要删除这条回忆吗？')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/memories/${id}`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('回忆已删除');
            loadMemories(); // 重新加载数据
        } else {
            showNotification('删除失败：' + result.message, 'error');
        }
    } catch (error) {
        console.error('Delete memory failed:', error);
        showNotification('网络错误，删除失败', 'error');
    }
}

// 更新时间轴显示
function updateTimeline() {
    const timeline = document.getElementById('timeline');
    timeline.innerHTML = '';
    
    if (memories.length === 0) {
        timeline.innerHTML = '<div class="empty-message">还没有回忆，快去上传一些吧！✨</div>';
        return;
    }
    
    memories.forEach(memory => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        
        let mediaContent = '';
        if (memory.type === 'photo' && memory.media_urls && memory.media_urls.length > 0) {
            mediaContent = memory.media_urls.map(url => 
                `<img src="${url}" alt="${memory.title || '照片'}" loading="lazy">`
            ).join('');
        } else if (memory.type === 'video' && memory.media_urls && memory.media_urls.length > 0) {
            mediaContent = memory.media_urls.map(url => `
                <video controls preload="metadata">
                    <source src="${url}" type="video/mp4">
                    您的浏览器不支持视频播放
                </video>
            `).join('');
        }
        
        timelineItem.innerHTML = `
            <div class="timeline-content">
                <div class="timeline-actions">
                    <button class="edit-btn" onclick="editMemory(${memory.id})" title="编辑这条回忆"></button>
                    <button class="delete-btn" onclick="deleteMemory(${memory.id})" title="删除这条回忆"></button>
                </div>
                <div class="timeline-date">${formatDate(memory.event_date)}</div>
                ${mediaContent ? `<div class="timeline-media">${mediaContent}</div>` : ''}
                <div class="timeline-text">
                    ${memory.title ? `<h3>${memory.title}</h3>` : ''}
                    <p>${memory.content}</p>
                </div>
                <div class="timeline-posted">${formatDateTime(memory.created_at)}</div>
            </div>
        `;
        
        timeline.appendChild(timelineItem);
    });
}

// 切换上传类型
function switchUploadType(type) {
    document.querySelectorAll('.upload-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="switchUploadType('${type}')"]`).classList.add('active');
    
    document.getElementById('photoUpload').classList.toggle('hidden', type !== 'photo');
    document.getElementById('videoUpload').classList.toggle('hidden', type !== 'video');
    
    currentUploadType = type;
    currentFiles = []; // 清空当前文件
    clearPreviews();
}

// 设置文件输入事件
function setupFileInputs() {
    // 针对照片输入
    const photoInput = document.getElementById('photoInput');
    photoInput.addEventListener('change', function(e) {
        handleFileSelection(e.target.files, 'photo');
        
        // 针对移动设备优化：重置input允许再次选择相同文件
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            this.value = ''; // 在处理完文件后清空input值，允许再次选择相同文件
        }
    });
    
    // 针对视频输入
    const videoInput = document.getElementById('videoInput');
    videoInput.addEventListener('change', function(e) {
        handleFileSelection(e.target.files, 'video');
        
        // 针对移动设备优化：重置input允许再次选择相同文件
        if (/Mobi|Android/i.test(navigator.userAgent)) {
            this.value = ''; // 在处理完文件后清空input值，允许再次选择相同文件
        }
    });
}

// 设置拖拽上传
function setupDragAndDrop() {
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
            handleFileSelection(files, type);
        });
    });
}

// 处理文件选择
function handleFileSelection(files, type) {
    if (!files || files.length === 0) return;
    
    // 验证文件类型
    const allowedTypes = {
        photo: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        video: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime']
    };
    
    for (let file of files) {
        if (!allowedTypes[type].includes(file.type)) {
            showNotification(`文件类型不支持：${file.name}`, 'error');
            return;
        }
        
        const maxSize = type === 'video' ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification(`文件过大：${file.name}，最大支持${type === 'video' ? '100MB' : '50MB'}`, 'error');
            return;
        }
    }
    
    currentFiles = Array.from(files);
    showPreview(files, type);
    showNotification(`已选择 ${files.length} 个文件`);
}

// 显示预览
function showPreview(files, type) {
    const previewContainer = document.getElementById(`${type}Preview`);
    previewContainer.innerHTML = '';
    
    Array.from(files).forEach(file => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        if (type === 'photo') {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewItem.innerHTML = `
                    <img src="${e.target.result}" alt="预览">
                    <span class="file-name">${file.name}</span>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            previewItem.innerHTML = `
                <div class="video-icon">🎬</div>
                <span class="file-name">${file.name}</span>
            `;
        }
        
        previewContainer.appendChild(previewItem);
    });
}

// 清空预览
function clearPreviews() {
    document.getElementById('photoPreview').innerHTML = '';
    document.getElementById('videoPreview').innerHTML = '';
}

// 上传文件到服务器
async function uploadFiles(files, type) {
    if (!files || files.length === 0) return [];
    
    const formData = new FormData();
    
    if (files.length === 1) {
        // 单文件上传
        formData.append('file', files[0]);
        formData.append('type', type);
        
        const response = await fetch(`${API_BASE_URL}/upload`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (result.success) {
            return [result.url];
        } else {
            throw new Error(result.message);
        }
    } else {
        // 多文件上传
        files.forEach(file => formData.append('files', file));
        formData.append('type', type);
        
        const response = await fetch(`${API_BASE_URL}/upload/multiple`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            },
            body: formData
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        if (result.success) {
            return result.urls;
        } else {
            throw new Error(result.message);
        }
    }
}

// 保存回忆
async function saveMemory() {
    const title = document.getElementById('memoryTitle').value;
    const content = document.getElementById('memoryContent').value;
    const eventDate = document.getElementById('memoryDate').value;
    const saveBtn = document.getElementById('saveBtn');
    
    if (!content || !eventDate) {
        showNotification('请填写必需的字段：描述和日期', 'error');
        return;
    }
    
    // 禁用按钮防止重复提交
    saveBtn.disabled = true;
    saveBtn.textContent = '保存中...';
    
    try {
        let mediaUrls = [];
        
        // 如果有文件，先上传文件
        if (currentFiles.length > 0 && currentUploadType !== 'text') {
            showNotification('正在上传文件...');
            mediaUrls = await uploadFiles(currentFiles, currentUploadType);
        }
        
        // 解析日期时间字符串，确保正确传递给服务器
        const eventDateObj = new Date(eventDate);
        const formattedEventDate = eventDateObj.toISOString();
        
        // 保存回忆数据
        const memoryData = {
            title: title || null,
            content,
            event_date: formattedEventDate,
            type: currentUploadType,
            media_urls: mediaUrls
        };
        
        
        const response = await fetch(`${API_BASE_URL}/memories`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(memoryData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('保存成功！');
            
            // 清空表单
            document.getElementById('memoryTitle').value = '';
            document.getElementById('memoryContent').value = '';
            initializeDateInput();
            currentFiles = [];
            clearPreviews();
            
            // 重新加载数据
            loadMemories();
            
            // 切换到时间轴页面
            showSection('recording');
        } else {
            showNotification('保存失败：' + result.message, 'error');
        }
    } catch (error) {
        console.error('Save memory failed:', error);
        showNotification('保存失败：' + error.message, 'error');
    } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = '保存并发布';
    }
}

// 编辑回忆
function editMemory(memoryId) {
    // 从存储的回忆中找到当前要编辑的回忆
    const memory = memories.find(m => m.id === memoryId);
    if (!memory) {
        showNotification('找不到回忆数据', 'error');
        return;
    }
    
    // 填充表单
    document.getElementById('editMemoryTitle').value = memory.title || '';
    document.getElementById('editMemoryContent').value = memory.content || '';
    
    // 处理日期格式以适应日期输入控件
    const eventDate = new Date(memory.event_date);
    const formattedDate = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
    document.getElementById('editMemoryDate').value = formattedDate;
    
    // 存储回忆ID以便更新
    document.getElementById('editMemoryId').value = memoryId;
    
    // 显示模态框
    document.getElementById('editMemoryModal').style.display = 'flex';
}

// 关闭编辑模态框
function closeEditModal() {
    document.getElementById('editMemoryModal').style.display = 'none';
}

// 更新回忆
async function updateMemory() {
    const memoryId = document.getElementById('editMemoryId').value;
    const title = document.getElementById('editMemoryTitle').value;
    const content = document.getElementById('editMemoryContent').value;
    const eventDate = document.getElementById('editMemoryDate').value;
    const updateBtn = document.getElementById('updateBtn');
    
    if (!content || !eventDate) {
        showNotification('请填写必需的字段：描述和日期', 'error');
        return;
    }
    
    // 禁用按钮防止重复提交
    updateBtn.disabled = true;
    updateBtn.textContent = '保存中...';
    
    try {
        // 创建日期对象并转换为ISO格式
        const eventDateObj = new Date(eventDate);
        const formattedEventDate = eventDateObj.toISOString();
        
        // 保存回忆数据
        const memoryData = {
            title: title || null,
            content,
            event_date: formattedEventDate
        };
        
        const response = await fetch(`${API_BASE_URL}/memories/${memoryId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(memoryData)
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification('更新成功！');
            closeEditModal();
            
            // 重新加载数据
            loadMemories();
        } else {
            showNotification('更新失败：' + result.message, 'error');
        }
    } catch (error) {
        console.error('Update memory failed:', error);
        showNotification('更新失败：' + error.message, 'error');
    } finally {
        updateBtn.disabled = false;
        updateBtn.textContent = '保存修改';
    }
}

// 格式化日期显示（仅显示日期）
function formatDate(dateString) {
    if (!dateString) return '';
    
    // 解析输入的日期字符串
    const date = new Date(dateString);
    
    // 创建一个新的日期
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();
    
    const localDate = new Date(year, month, day);
    
    return localDate.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

// 格式化日期时间显示（包含时间）
function formatDateTime(dateString) {
    if (!dateString) return '';
    
    // 解析输入的日期字符串
    const date = new Date(dateString);
    
    return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // 使用24小时制
    });
}

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

// 初始化
switchUploadType('photo');