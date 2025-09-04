const API_BASE_URL = 'https://api.leaflora.dpdns.org/api';

// 存储数据的变量
let memories = [];
let isTimelineAscending = false;
let currentUploadType = 'photo';
let currentFiles = [];
let authToken = null;

// 编辑相关的变量
let editMemoryData = null;
let editCurrentFiles = [];
let editCurrentUploadType = 'photo';
let editDeletedMediaUrls = [];

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
            if (memory.media_urls.length === 1) {
                // 单张图片直接显示
                mediaContent = `<div class="single-image">
                    <img src="${memory.media_urls[0]}" alt="${memory.title || '照片'}" loading="lazy" onclick="openImageModal('${memory.media_urls[0]}', 0, ${JSON.stringify(memory.media_urls).replace(/"/g, '&quot;')})">
                </div>`;
            } else {
                // 多张图片使用轮播
                mediaContent = createImageCarousel(memory.media_urls, memory.id, memory.title || '照片');
            }
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
                    <p>${formatContent(memory.content)}</p>
                </div>
                <div class="timeline-posted">${formatDateTime(memory.created_at)}</div>
            </div>
        `;
        
        timeline.appendChild(timelineItem);
    });
}

// 创建图片轮播组件
function createImageCarousel(imageUrls, memoryId, alt) {
    const carouselId = `carousel-${memoryId}`;
    const imagesHtml = imageUrls.map((url, index) => `
        <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
            <img src="${url}" alt="${alt}" loading="lazy" onclick="openImageModal('${url}', ${index}, ${JSON.stringify(imageUrls).replace(/"/g, '&quot;')})">
        </div>
    `).join('');
    
    const dotsHtml = imageUrls.length > 1 ? imageUrls.map((_, index) => `
        <span class="carousel-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide('${carouselId}', ${index})" data-index="${index}"></span>
    `).join('') : '';
    
    return `
        <div class="image-carousel" id="${carouselId}">
            <div class="carousel-container">
                <div class="carousel-slides">
                    ${imagesHtml}
                </div>
                ${imageUrls.length > 1 ? `
                    <button class="carousel-btn carousel-prev" onclick="prevSlide('${carouselId}')" aria-label="上一张">‹</button>
                    <button class="carousel-btn carousel-next" onclick="nextSlide('${carouselId}')" aria-label="下一张">›</button>
                ` : ''}
            </div>
            ${imageUrls.length > 1 ? `
                <div class="carousel-counter">${1} / ${imageUrls.length}</div>
                <div class="carousel-dots">
                    ${dotsHtml}
                </div>
            ` : ''}
        </div>
    `;
}

// 轮播控制函数
function nextSlide(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots = carousel.querySelectorAll('.carousel-dot');
    const counter = carousel.querySelector('.carousel-counter');
    
    let currentIndex = 0;
    slides.forEach((slide, index) => {
        if (slide.classList.contains('active')) {
            currentIndex = index;
        }
    });
    
    const nextIndex = (currentIndex + 1) % slides.length;
    updateCarousel(slides, dots, counter, nextIndex);
}

function prevSlide(carouselId) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots = carousel.querySelectorAll('.carousel-dot');
    const counter = carousel.querySelector('.carousel-counter');
    
    let currentIndex = 0;
    slides.forEach((slide, index) => {
        if (slide.classList.contains('active')) {
            currentIndex = index;
        }
    });
    
    const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
    updateCarousel(slides, dots, counter, prevIndex);
}

function goToSlide(carouselId, index) {
    const carousel = document.getElementById(carouselId);
    if (!carousel) return;
    
    const slides = carousel.querySelectorAll('.carousel-slide');
    const dots = carousel.querySelectorAll('.carousel-dot');
    const counter = carousel.querySelector('.carousel-counter');
    
    updateCarousel(slides, dots, counter, index);
}

function updateCarousel(slides, dots, counter, index) {
    // 更新幻灯片
    slides.forEach(slide => slide.classList.remove('active'));
    slides[index].classList.add('active');
    
    // 更新指示器
    if (dots.length > 0) {
        dots.forEach(dot => dot.classList.remove('active'));
        dots[index].classList.add('active');
    }
    
    // 更新计数器
    if (counter) {
        counter.textContent = `${index + 1} / ${slides.length}`;
    }
}

// 图片模态框相关函数
let currentImageModal = null;
let currentImageIndex = 0;
let currentImageUrls = [];

function openImageModal(imageUrl, index, imageUrls) {
    currentImageIndex = index;
    currentImageUrls = JSON.parse(imageUrls.replace(/&quot;/g, '"'));
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.id = 'imageModal';
    
    const modalHtml = `
        <div class="modal-backdrop" onclick="closeImageModal()"></div>
        <div class="modal-image-container">
            <img src="${imageUrl}" alt="查看大图" id="modalImage">
            ${currentImageUrls.length > 1 ? `
                <button class="modal-nav modal-prev" onclick="prevModalImage()" aria-label="上一张">‹</button>
                <button class="modal-nav modal-next" onclick="nextModalImage()" aria-label="下一张">›</button>
                <div class="modal-counter">${index + 1} / ${currentImageUrls.length}</div>
            ` : ''}
            <button class="modal-close" onclick="closeImageModal()" aria-label="关闭">×</button>
        </div>
    `;
    
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    currentImageModal = modal;
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleModalKeydown);
    
    // 防止背景滚动
    document.body.style.overflow = 'hidden';
    
    // 添加显示动画
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
}

function closeImageModal() {
    if (currentImageModal) {
        currentImageModal.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(currentImageModal);
            currentImageModal = null;
        }, 300);
        
        // 移除键盘事件监听
        document.removeEventListener('keydown', handleModalKeydown);
        
        // 恢复背景滚动
        document.body.style.overflow = '';
    }
}

function nextModalImage() {
    currentImageIndex = (currentImageIndex + 1) % currentImageUrls.length;
    updateModalImage();
}

function prevModalImage() {
    currentImageIndex = (currentImageIndex - 1 + currentImageUrls.length) % currentImageUrls.length;
    updateModalImage();
}

function updateModalImage() {
    const modalImage = document.getElementById('modalImage');
    const modalCounter = document.querySelector('.modal-counter');
    
    if (modalImage) {
        modalImage.src = currentImageUrls[currentImageIndex];
    }
    
    if (modalCounter) {
        modalCounter.textContent = `${currentImageIndex + 1} / ${currentImageUrls.length}`;
    }
}

function handleModalKeydown(event) {
    switch (event.key) {
        case 'Escape':
            closeImageModal();
            break;
        case 'ArrowLeft':
            if (currentImageUrls.length > 1) {
                prevModalImage();
            }
            break;
        case 'ArrowRight':
            if (currentImageUrls.length > 1) {
                nextModalImage();
            }
            break;
    }
}

// 切换上传类型
function switchUploadType(type) {
    document.querySelectorAll('.upload-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`[onclick="switchUploadType('${type}')"]`).classList.add('active');
    
    // 显示/隐藏相应的上传区域
    document.getElementById('photoUpload').classList.toggle('hidden', type !== 'photo');
    document.getElementById('videoUpload').classList.toggle('hidden', type !== 'video');
    document.getElementById('textUpload').classList.toggle('hidden', type !== 'text');
    
    currentUploadType = type;
    
    // 如果切换到非文件类型，清空文件选择
    if (type === 'text') {
        currentFiles = [];
        clearPreviews();
    }
}

// 设置文件输入事件
function setupFileInputs() {
    // 针对照片输入
    const photoInput = document.getElementById('photoInput');
    photoInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files, 'photo');
        }
        
        // 延迟重置input值，确保文件处理完成后再清空
        setTimeout(() => {
            this.value = '';
        }, 100);
    });
    
    // 针对视频输入
    const videoInput = document.getElementById('videoInput');
    videoInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files, 'video');
        }
        
        // 延迟重置input值，确保文件处理完成后再清空
        setTimeout(() => {
            this.value = '';
        }, 100);
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
            
            // 支持多文件拖拽上传
            if (files.length > 0) {
                showNotification(`检测到 ${files.length} 个文件，正在处理...`);
                handleFileSelection(files, type);
            }
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
    
    const validFiles = [];
    for (let file of files) {
        if (!allowedTypes[type].includes(file.type)) {
            showNotification(`文件类型不支持：${file.name}`, 'error');
            continue;
        }
        
        const maxSize = type === 'video' ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification(`文件过大：${file.name}，最大支持${type === 'video' ? '100MB' : '50MB'}`, 'error');
            continue;
        }
        
        validFiles.push(file);
    }
    
    if (validFiles.length === 0) return;
    
    // 对于移动端，支持多次选择累积文件
    if (currentUploadType === type) {
        // 检查重复文件
        const existingFileNames = currentFiles.map(f => f.name);
        const newFiles = validFiles.filter(f => !existingFileNames.includes(f.name));
        
        if (newFiles.length === 0) {
            showNotification('所选文件已存在', 'warning');
            return;
        }
        
        currentFiles = [...currentFiles, ...newFiles];
        showNotification(`已累积选择 ${currentFiles.length} 个文件（新增 ${newFiles.length} 个）`);
    } else {
        // 切换类型时重置文件列表
        currentFiles = Array.from(validFiles);
        showNotification(`已选择 ${validFiles.length} 个文件`);
    }
    
    showPreview(currentFiles, type);
}

// 显示预览
function showPreview(files, type) {
    const previewContainer = document.getElementById(`${type}Preview`);
    previewContainer.innerHTML = '';
    
    // 显示清空按钮
    const clearBtn = document.getElementById(`${type}ClearBtn`);
    if (clearBtn) {
        clearBtn.style.display = files.length > 0 ? 'inline-block' : 'none';
    }
    
    if (files.length === 0) return;
    
    // 添加文件计数器
    const counterDiv = document.createElement('div');
    counterDiv.className = 'files-counter';
    counterDiv.textContent = `已选择 ${files.length} 个文件`;
    previewContainer.appendChild(counterDiv);
    
    const previewGrid = document.createElement('div');
    previewGrid.className = 'preview-grid';
    
    Array.from(files).forEach((file, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        if (type === 'photo') {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewItem.innerHTML = `
                    <div class="preview-image-container">
                        <img src="${e.target.result}" alt="预览">
                        <button class="remove-file-btn" onclick="removeFile(${index}, '${type}')" title="移除此文件">×</button>
                    </div>
                    <span class="file-name">${file.name}</span>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            previewItem.innerHTML = `
                <div class="preview-video-container">
                    <div class="video-icon">🎬</div>
                    <button class="remove-file-btn" onclick="removeFile(${index}, '${type}')" title="移除此文件">×</button>
                </div>
                <span class="file-name">${file.name}</span>
            `;
        }
        
        previewGrid.appendChild(previewItem);
    });
    
    previewContainer.appendChild(previewGrid);
}

// 清空当前文件选择
function clearCurrentFiles(type) {
    currentFiles = [];
    showPreview(currentFiles, type);
    showNotification('已清空文件选择');
}

// 移除单个文件
function removeFile(index, type) {
    if (index >= 0 && index < currentFiles.length) {
        const removedFile = currentFiles.splice(index, 1)[0];
        showPreview(currentFiles, type);
        showNotification(`已移除文件: ${removedFile.name}`);
    }
}

// 清空预览
function clearPreviews() {
    document.getElementById('photoPreview').innerHTML = '';
    document.getElementById('videoPreview').innerHTML = '';
    
    // 隐藏清空按钮
    const photoClearBtn = document.getElementById('photoClearBtn');
    const videoClearBtn = document.getElementById('videoClearBtn');
    if (photoClearBtn) photoClearBtn.style.display = 'none';
    if (videoClearBtn) videoClearBtn.style.display = 'none';
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
    
    // 存储当前编辑的回忆数据
    editMemoryData = { ...memory };
    editCurrentFiles = [];
    editDeletedMediaUrls = [];
    
    // 填充表单
    document.getElementById('editMemoryTitle').value = memory.title || '';
    document.getElementById('editMemoryContent').value = memory.content || '';
    
    // 处理日期格式以适应日期输入控件
    const eventDate = new Date(memory.event_date);
    const formattedDate = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`;
    document.getElementById('editMemoryDate').value = formattedDate;
    
    // 存储回忆ID和类型
    document.getElementById('editMemoryId').value = memoryId;
    document.getElementById('editMemoryType').value = memory.type || 'text';
    
    // 显示当前媒体文件
    displayCurrentMedia(memory);
    
    // 设置初始上传类型
    if (memory.type === 'video') {
        switchEditUploadType('video');
    } else {
        switchEditUploadType('photo');
    }
    
    // 设置编辑文件输入事件
    setupEditFileInputs();
    
    // 显示模态框
    document.getElementById('editMemoryModal').style.display = 'flex';
}

// 关闭编辑模态框
function closeEditModal() {
    document.getElementById('editMemoryModal').style.display = 'none';
    
    // 清理编辑状态
    editMemoryData = null;
    editCurrentFiles = [];
    editDeletedMediaUrls = [];
    clearEditPreviews();
}

// 显示当前媒体文件
function displayCurrentMedia(memory) {
    const currentMediaDisplay = document.getElementById('currentMediaDisplay');
    
    if (!memory.media_urls || memory.media_urls.length === 0) {
        currentMediaDisplay.innerHTML = '<p class="no-media-text">暂无媒体文件</p>';
        return;
    }
    
    let mediaHtml = '<div class="current-media-grid">';
    
    memory.media_urls.forEach((url, index) => {
        if (memory.type === 'photo') {
            mediaHtml += `
                <div class="current-media-item" data-url="${url}">
                    <img src="${url}" alt="当前图片" onclick="openImageModal('${url}', ${index}, ${JSON.stringify(memory.media_urls).replace(/"/g, '&quot;')})">
                    <button class="remove-current-media" onclick="removeCurrentMedia('${url}')" title="删除此文件">×</button>
                </div>
            `;
        } else if (memory.type === 'video') {
            mediaHtml += `
                <div class="current-media-item" data-url="${url}">
                    <video controls preload="metadata">
                        <source src="${url}" type="video/mp4">
                    </video>
                    <button class="remove-current-media" onclick="removeCurrentMedia('${url}')" title="删除此文件">×</button>
                </div>
            `;
        }
    });
    
    mediaHtml += '</div>';
    currentMediaDisplay.innerHTML = mediaHtml;
}

// 删除当前媒体文件
function removeCurrentMedia(url) {
    if (!confirm('确定要删除这个文件吗？')) {
        return;
    }
    
    // 添加到删除列表
    editDeletedMediaUrls.push(url);
    
    // 从当前数据中移除
    if (editMemoryData.media_urls) {
        editMemoryData.media_urls = editMemoryData.media_urls.filter(mediaUrl => mediaUrl !== url);
    }
    
    // 重新显示当前媒体
    displayCurrentMedia(editMemoryData);
    showNotification('文件已标记为删除');
}

// 切换编辑上传类型
function switchEditUploadType(type) {
    document.querySelectorAll('.media-type-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    
    if (type === 'photo') {
        document.getElementById('editPhotoBtn').classList.add('active');
        document.getElementById('editPhotoUpload').classList.remove('hidden');
        document.getElementById('editVideoUpload').classList.add('hidden');
    } else {
        document.getElementById('editVideoBtn').classList.add('active');
        document.getElementById('editVideoUpload').classList.remove('hidden');
        document.getElementById('editPhotoUpload').classList.add('hidden');
    }
    
    editCurrentUploadType = type;
}

// 设置编辑文件输入事件
function setupEditFileInputs() {
    // 照片输入
    const editPhotoInput = document.getElementById('editPhotoInput');
    editPhotoInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            handleEditFileSelection(e.target.files, 'photo');
        }
        
        setTimeout(() => {
            this.value = '';
        }, 100);
    });
    
    // 视频输入
    const editVideoInput = document.getElementById('editVideoInput');
    editVideoInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            handleEditFileSelection(e.target.files, 'video');
        }
        
        setTimeout(() => {
            this.value = '';
        }, 100);
    });
}

// 处理编辑文件选择
function handleEditFileSelection(files, type) {
    if (!files || files.length === 0) return;
    
    // 验证文件类型
    const allowedTypes = {
        photo: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'],
        video: ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime']
    };
    
    const validFiles = [];
    for (let file of files) {
        if (!allowedTypes[type].includes(file.type)) {
            showNotification(`文件类型不支持：${file.name}`, 'error');
            continue;
        }
        
        const maxSize = type === 'video' ? 100 * 1024 * 1024 : 50 * 1024 * 1024;
        if (file.size > maxSize) {
            showNotification(`文件过大：${file.name}，最大支持${type === 'video' ? '100MB' : '50MB'}`, 'error');
            continue;
        }
        
        validFiles.push(file);
    }
    
    if (validFiles.length === 0) return;
    
    // 检查重复文件
    const existingFileNames = editCurrentFiles.map(f => f.name);
    const newFiles = validFiles.filter(f => !existingFileNames.includes(f.name));
    
    if (newFiles.length === 0) {
        showNotification('所选文件已存在', 'warning');
        return;
    }
    
    editCurrentFiles = [...editCurrentFiles, ...newFiles];
    showEditPreview(editCurrentFiles, type);
    showNotification(`已选择 ${newFiles.length} 个新文件`);
}

// 显示编辑预览
function showEditPreview(files, type) {
    const previewContainer = document.getElementById(`edit${type.charAt(0).toUpperCase() + type.slice(1)}Preview`);
    previewContainer.innerHTML = '';
    
    if (files.length === 0) return;
    
    const previewGrid = document.createElement('div');
    previewGrid.className = 'edit-preview-grid';
    
    files.forEach((file, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'edit-preview-item';
        
        if (type === 'photo') {
            const reader = new FileReader();
            reader.onload = function(e) {
                previewItem.innerHTML = `
                    <div class="edit-preview-image-container">
                        <img src="${e.target.result}" alt="预览">
                        <button class="remove-edit-file-btn" onclick="removeEditFile(${index}, '${type}')" title="移除此文件">×</button>
                    </div>
                    <span class="edit-file-name">${file.name}</span>
                `;
            };
            reader.readAsDataURL(file);
        } else {
            previewItem.innerHTML = `
                <div class="edit-preview-video-container">
                    <div class="video-icon">🎬</div>
                    <button class="remove-edit-file-btn" onclick="removeEditFile(${index}, '${type}')" title="移除此文件">×</button>
                </div>
                <span class="edit-file-name">${file.name}</span>
            `;
        }
        
        previewGrid.appendChild(previewItem);
    });
    
    previewContainer.appendChild(previewGrid);
}

// 移除编辑文件
function removeEditFile(index, type) {
    if (index >= 0 && index < editCurrentFiles.length) {
        const removedFile = editCurrentFiles.splice(index, 1)[0];
        showEditPreview(editCurrentFiles, type);
        showNotification(`已移除文件: ${removedFile.name}`);
    }
}

// 清空编辑预览
function clearEditPreviews() {
    document.getElementById('editPhotoPreview').innerHTML = '';
    document.getElementById('editVideoPreview').innerHTML = '';
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
        let newMediaUrls = [];
        let finalMediaUrls = [];
        
        // 如果有新文件要上传
        if (editCurrentFiles.length > 0) {
            showNotification('正在上传新文件...');
            newMediaUrls = await uploadFiles(editCurrentFiles, editCurrentUploadType);
        }
        
        // 合并现有媒体URL和新上传的URL
        if (editMemoryData.media_urls) {
            // 过滤掉被删除的URL
            const keepUrls = editMemoryData.media_urls.filter(url => !editDeletedMediaUrls.includes(url));
            finalMediaUrls = [...keepUrls, ...newMediaUrls];
        } else {
            finalMediaUrls = newMediaUrls;
        }
        
        // 删除被标记删除的文件
        if (editDeletedMediaUrls.length > 0) {
            showNotification('正在删除旧文件...');
            await deleteMediaFiles(editDeletedMediaUrls);
        }
        
        // 创建日期对象并转换为ISO格式
        const eventDateObj = new Date(eventDate);
        const formattedEventDate = eventDateObj.toISOString();
        
        // 确定最终的类型
        let finalType = editMemoryData.type || 'text';
        if (finalMediaUrls.length > 0) {
            finalType = editCurrentUploadType;
        } else if (finalMediaUrls.length === 0 && editDeletedMediaUrls.length > 0) {
            finalType = 'text'; // 如果删除了所有媒体文件，改为文本类型
        }
        
        // 保存回忆数据
        const memoryData = {
            title: title || null,
            content,
            event_date: formattedEventDate,
            type: finalType,
            media_urls: finalMediaUrls.length > 0 ? finalMediaUrls : null
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

// 删除媒体文件
async function deleteMediaFiles(mediaUrls) {
    for (const url of mediaUrls) {
        try {
            // 从URL中提取完整的文件路径
            // Supabase URL格式：https://your-project.supabase.co/storage/v1/object/public/bucket/path/to/file.ext
            // 我们需要提取 path/to/file.ext 部分
            let filename = '';
            
            if (url.includes('/storage/v1/object/public/memories/')) {
                // 从Supabase public URL中提取文件路径
                const parts = url.split('/storage/v1/object/public/memories/');
                if (parts.length > 1) {
                    filename = parts[1];
                }
            } else {
                // 备用方法：使用URL的最后两个部分（folder/filename.ext）
                const urlParts = url.split('/');
                if (urlParts.length >= 2) {
                    filename = urlParts.slice(-2).join('/');
                } else {
                    filename = urlParts[urlParts.length - 1];
                }
            }
            
            if (!filename) {
                console.error('Could not extract filename from URL:', url);
                continue;
            }
            
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${authToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ filename })
            });
            
            if (!response.ok) {
                console.error(`Failed to delete file: ${filename}`, response.status, response.statusText);
            } else {
                console.log(`Successfully deleted file: ${filename}`);
            }
        } catch (error) {
            console.error('Error deleting file:', error);
        }
    }
}

// 格式化内容，将换行符转换为<br>标签
function formatContent(content) {
    if (!content) return '';
    return content.replace(/\n/g, '<br>');
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