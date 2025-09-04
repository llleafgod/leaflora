const API_BASE_URL = 'https://api.leaflora.dpdns.org/api';

// 存储数据的变量
let memories = [];
let filteredMemories = []; // 存储过滤后的回忆
let isTimelineAscending = false;
let currentUploadType = 'photo';
let currentFiles = [];
let authToken = null;

// 搜索相关的变量
let currentSearchKeyword = '';
let currentSearchDate = '';

// 编辑相关的变量
let editMemoryData = null;
let editCurrentFiles = [];
let editDeletedMediaUrls = [];

// 图片查看相关的变量
let memoriesImageData = {}; // 存储每个回忆的图片数据
let currentImageModal = null;
let currentImageUrls = [];
let currentImageIndex = 0;
let autoPlayInterval = null;
let isAutoPlaying = false;
const AUTO_PLAY_DELAY = 3000; // 3秒自动切换

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
            // 如果有搜索条件，重新执行搜索
            if (currentSearchKeyword || currentSearchDate) {
                performSearch();
            } else {
                filteredMemories = [];
                updateTimeline();
            }
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

// 搜索功能
function performSearch() {
    const searchInput = document.getElementById('searchInput');
    const dateSearchInput = document.getElementById('dateSearchInput');
    const searchStatus = document.getElementById('searchStatus');
    
    currentSearchKeyword = searchInput.value.toLowerCase().trim();
    currentSearchDate = dateSearchInput.value;
    
    console.log('Searching with keyword:', currentSearchKeyword, 'date:', currentSearchDate);
    
    // 重置过滤结果
    filteredMemories = memories.filter(memory => {
        let matchesKeyword = true;
        let matchesDate = true;
        
        // 关键词搜索：搜索标题和内容
        if (currentSearchKeyword) {
            const title = (memory.title || '').toLowerCase();
            const content = (memory.content || '').toLowerCase();
            matchesKeyword = title.includes(currentSearchKeyword) || content.includes(currentSearchKeyword);
        }
        
        // 日期搜索：匹配事件日期
        if (currentSearchDate) {
            const memoryDate = new Date(memory.event_date).toISOString().split('T')[0];
            matchesDate = memoryDate === currentSearchDate;
        }
        
        return matchesKeyword && matchesDate;
    });
    
    // 对搜索结果应用排序
    if (filteredMemories.length > 0) {
        filteredMemories.sort((a, b) => {
            const dateA = new Date(a.event_date);
            const dateB = new Date(b.event_date);
            return isTimelineAscending ? dateA - dateB : dateB - dateA;
        });
    }
    
    // 显示搜索状态
    updateSearchStatus();
    
    console.log('Filtered memories:', filteredMemories.length, 'out of', memories.length);
    updateTimeline();
}

function updateSearchStatus() {
    const searchStatus = document.getElementById('searchStatus');
    
    if (currentSearchKeyword || currentSearchDate) {
        let statusText = '';
        
        if (currentSearchKeyword && currentSearchDate) {
            statusText = `搜索关键词"${currentSearchKeyword}"和日期"${currentSearchDate}"：找到 ${filteredMemories.length} 条结果`;
        } else if (currentSearchKeyword) {
            statusText = `搜索关键词"${currentSearchKeyword}"：找到 ${filteredMemories.length} 条结果`;
        } else if (currentSearchDate) {
            statusText = `搜索日期"${currentSearchDate}"：找到 ${filteredMemories.length} 条结果`;
        }
        
        searchStatus.textContent = statusText;
        searchStatus.style.display = 'block';
    } else {
        searchStatus.style.display = 'none';
    }
}

function clearSearch() {
    const searchInput = document.getElementById('searchInput');
    const dateSearchInput = document.getElementById('dateSearchInput');
    const searchStatus = document.getElementById('searchStatus');
    
    searchInput.value = '';
    dateSearchInput.value = '';
    currentSearchKeyword = '';
    currentSearchDate = '';
    filteredMemories = [];
    searchStatus.style.display = 'none';
    
    updateTimeline();
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
    
    // 如果有搜索结果，对搜索结果重新排序
    if (currentSearchKeyword || currentSearchDate) {
        performSearch();
    } else {
        loadMemories(); // 重新加载数据
    }
}

// 删除内容
async function deleteMemory(id) {
    if (!confirm('确定要删除这条内容吗？')) return;
    
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
            showNotification('内容已删除');
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
    
    // 使用过滤后的数据
    const displayMemories = filteredMemories.length > 0 || currentSearchKeyword || currentSearchDate ? filteredMemories : memories;
    
    if (memories.length === 0) {
        timeline.innerHTML = '<div class="empty-message">还没有回忆，快去上传一些吧！✨</div>';
        return;
    }
    
    if (displayMemories.length === 0 && (currentSearchKeyword || currentSearchDate)) {
        timeline.innerHTML = '<div class="empty-message">没有找到匹配的内容</div>';
        return;
    }
    
    displayMemories.forEach(memory => {
        const timelineItem = document.createElement('div');
        timelineItem.className = 'timeline-item';
        
        let mediaContent = '';
        if (memory.type === 'photo' && memory.media_urls && memory.media_urls.length > 0) {
            // 存储图片数据以供模态框使用
            memoriesImageData[memory.id] = memory.media_urls;
            
            if (memory.media_urls.length === 1) {
                // 单张图片直接显示
                mediaContent = `<div class="single-image">
                    <img src="${memory.media_urls[0]}" alt="${memory.title || '照片'}" loading="lazy" onclick="openImageModal(${memory.id}, 0)">
                </div>`;
            } else {
                // 多张图片使用轮播
                mediaContent = createImageCarousel(memory.media_urls, memory.id, memory.title || '照片');
            }
        } else if (memory.type === 'video' && memory.media_urls && memory.media_urls.length > 0) {
            // 存储视频数据以供模态框使用
            memoriesImageData[memory.id] = memory.media_urls;
            
            if (memory.media_urls.length === 1) {
                // 单个视频直接显示
                mediaContent = `<div class="single-video">
                    <video controls preload="metadata" onclick="openVideoModal(${memory.id}, 0)">
                        <source src="${memory.media_urls[0]}" type="video/mp4">
                        您的浏览器不支持视频播放
                    </video>
                </div>`;
            } else {
                // 多个视频使用轮播
                mediaContent = createVideoCarousel(memory.media_urls, memory.id, memory.title || '视频');
            }
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
            <img src="${url}" alt="${alt}" loading="lazy" onclick="openImageModal(${memoryId}, ${index})">
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

// 创建视频轮播组件
function createVideoCarousel(videoUrls, memoryId, alt) {
    const carouselId = `carousel-${memoryId}`;
    const videosHtml = videoUrls.map((url, index) => `
        <div class="carousel-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
            <video controls preload="metadata" onclick="openVideoModal(${memoryId}, ${index})">
                <source src="${url}" type="video/mp4">
                您的浏览器不支持视频播放
            </video>
        </div>
    `).join('');
    
    const dotsHtml = videoUrls.length > 1 ? videoUrls.map((_, index) => `
        <span class="carousel-dot ${index === 0 ? 'active' : ''}" onclick="goToSlide('${carouselId}', ${index})" data-index="${index}"></span>
    `).join('') : '';
    
    return `
        <div class="image-carousel" id="${carouselId}">
            <div class="carousel-container">
                <div class="carousel-slides">
                    ${videosHtml}
                </div>
                ${videoUrls.length > 1 ? `
                    <button class="carousel-btn carousel-prev" onclick="prevSlide('${carouselId}')" aria-label="上一个">‹</button>
                    <button class="carousel-btn carousel-next" onclick="nextSlide('${carouselId}')" aria-label="下一个">›</button>
                ` : ''}
            </div>
            ${videoUrls.length > 1 ? `
                <div class="carousel-counter">${1} / ${videoUrls.length}</div>
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
function openImageModal(memoryId, index) {
    console.log('Opening image modal for memory:', memoryId, 'at index:', index);
    
    // 从全局存储中获取图片URLs
    const imageUrls = memoriesImageData[memoryId];
    if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
        console.error('No image data found for memory:', memoryId);
        showNotification('图片数据不存在', 'error');
        return;
    }
    
    // 验证索引有效性
    if (index < 0 || index >= imageUrls.length) {
        console.error('Invalid image index:', index, 'for memory:', memoryId);
        index = 0; // 默认显示第一张
    }
    
    currentImageIndex = index;
    currentImageUrls = imageUrls;
    
    const currentImageUrl = imageUrls[index];
    console.log('Displaying image:', currentImageUrl, 'from array:', imageUrls);
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'image-modal';
    modal.id = 'imageModal';
    
    const modalHtml = `
        <div class="modal-backdrop" onclick="closeImageModal()"></div>
        <div class="modal-image-container">
            <img src="${currentImageUrl}" alt="查看大图" id="modalImage">
            ${imageUrls.length > 1 ? `
                <button class="modal-nav modal-prev" onclick="prevModalImage()" aria-label="上一张">‹</button>
                <button class="modal-nav modal-next" onclick="nextModalImage()" aria-label="下一张">›</button>
                <div class="modal-counter">${index + 1} / ${imageUrls.length}</div>
                <div class="modal-progress-container">
                    ${imageUrls.map((_, i) => `
                        <div class="modal-progress-bar ${i === index ? 'active' : ''}"></div>
                    `).join('')}
                </div>
            ` : ''}
            <button class="modal-close" onclick="closeImageModal()" aria-label="关闭">×</button>
        </div>
    `;
    
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    currentImageModal = modal;
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleModalKeydown);
    
    // 添加触摸滑动支持
    if (imageUrls.length > 1) {
        setupImageModalTouchEvents(modal);
    }
    
    // 防止背景滚动
    document.body.style.overflow = 'hidden';
    
    // 添加显示动画
    setTimeout(() => {
        modal.classList.add('show');
        // 如果有多张图片，启动自动播放
        if (imageUrls.length > 1) {
            startAutoPlay();
        }
    }, 10);
    
    console.log('Image modal opened successfully');
}

function closeImageModal() {
    // 停止自动播放
    stopAutoPlay();
    
    // 清理触摸事件
    cleanupImageModalTouchEvents();
    
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

// 视频模态框相关函数
function openVideoModal(memoryId, index) {
    console.log('Opening video modal for memory:', memoryId, 'at index:', index);
    
    // 从全局存储中获取视频URLs
    const videoUrls = memoriesImageData[memoryId];
    if (!videoUrls || !Array.isArray(videoUrls) || videoUrls.length === 0) {
        console.error('No video data found for memory:', memoryId);
        showNotification('视频数据不存在', 'error');
        return;
    }
    
    // 验证索引有效性
    if (index < 0 || index >= videoUrls.length) {
        console.error('Invalid video index:', index, 'for memory:', memoryId);
        index = 0; // 默认显示第一个
    }
    
    currentImageIndex = index;
    currentImageUrls = videoUrls;
    
    const currentVideoUrl = videoUrls[index];
    console.log('Displaying video:', currentVideoUrl, 'from array:', videoUrls);
    
    // 创建模态框
    const modal = document.createElement('div');
    modal.className = 'image-modal video-modal';
    modal.id = 'videoModal';
    
    const modalHtml = `
        <div class="modal-backdrop" onclick="closeVideoModal()"></div>
        <div class="modal-image-container">
            <video controls autoplay preload="metadata" id="modalVideo" onended="onVideoEnded()">
                <source src="${currentVideoUrl}" type="video/mp4">
                您的浏览器不支持视频播放
            </video>
            ${videoUrls.length > 1 ? `
                <button class="modal-nav modal-prev" onclick="prevModalVideo()" aria-label="上一个">‹</button>
                <button class="modal-nav modal-next" onclick="nextModalVideo()" aria-label="下一个">›</button>
                <div class="modal-counter">${index + 1} / ${videoUrls.length}</div>
                <div class="modal-progress-container">
                    ${videoUrls.map((_, i) => `
                        <div class="modal-progress-bar ${i === index ? 'active' : (i < index ? 'completed' : '')}"></div>
                    `).join('')}
                </div>
            ` : ''}
            <button class="modal-close" onclick="closeVideoModal()" aria-label="关闭">×</button>
        </div>
    `;
    
    modal.innerHTML = modalHtml;
    document.body.appendChild(modal);
    currentImageModal = modal;
    
    // 添加键盘事件监听
    document.addEventListener('keydown', handleVideoModalKeydown);
    
    // 防止背景滚动
    document.body.style.overflow = 'hidden';
    
    // 添加显示动画
    setTimeout(() => {
        modal.classList.add('show');
    }, 10);
    
    console.log('Video modal opened successfully');
}

function closeVideoModal() {
    if (currentImageModal) {
        currentImageModal.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(currentImageModal);
            currentImageModal = null;
        }, 300);
        
        // 移除键盘事件监听
        document.removeEventListener('keydown', handleVideoModalKeydown);
        
        // 恢复背景滚动
        document.body.style.overflow = '';
    }
}

function nextModalVideo() {
    currentImageIndex = (currentImageIndex + 1) % currentImageUrls.length;
    updateModalVideo();
}

function prevModalVideo() {
    currentImageIndex = (currentImageIndex - 1 + currentImageUrls.length) % currentImageUrls.length;
    updateModalVideo();
}

function updateModalVideo() {
    const modalVideo = document.getElementById('modalVideo');
    const modalCounter = document.querySelector('.modal-counter');
    
    if (modalVideo) {
        modalVideo.src = '';
        modalVideo.innerHTML = `<source src="${currentImageUrls[currentImageIndex]}" type="video/mp4">您的浏览器不支持视频播放`;
        modalVideo.load();
        modalVideo.play();
    }
    
    if (modalCounter) {
        modalCounter.textContent = `${currentImageIndex + 1} / ${currentImageUrls.length}`;
    }
    
    // 更新进度条
    const progressBars = document.querySelectorAll('.modal-progress-bar');
    progressBars.forEach((bar, index) => {
        // 重置所有状态类
        bar.classList.remove('active', 'completed');
        
        if (index < currentImageIndex) {
            // 已完成的视频
            bar.classList.add('completed');
        } else if (index === currentImageIndex) {
            // 当前视频
            bar.classList.add('active');
        }
        // index > currentImageIndex 的保持默认状态（未开始）
    });
}

function onVideoEnded() {
    // 视频播放完毕，如果有下一个视频则自动播放
    if (currentImageUrls.length > 1 && currentImageIndex < currentImageUrls.length - 1) {
        setTimeout(() => {
            nextModalVideo();
        }, 500); // 0.5秒延迟后自动播放下一个
    }
}

function handleVideoModalKeydown(event) {
    switch (event.key) {
        case 'Escape':
            closeVideoModal();
            break;
        case 'ArrowLeft':
            if (currentImageUrls.length > 1) {
                prevModalVideo();
            }
            break;
        case 'ArrowRight':
            if (currentImageUrls.length > 1) {
                nextModalVideo();
            }
            break;
    }
}

function nextModalImage() {
    currentImageIndex = (currentImageIndex + 1) % currentImageUrls.length;
    updateModalImage();
    
    // 如果是手动操作，重新启动自动播放
    if (isAutoPlaying) {
        startAutoPlay();
    }
}

function prevModalImage() {
    currentImageIndex = (currentImageIndex - 1 + currentImageUrls.length) % currentImageUrls.length;
    updateModalImage();
    
    // 如果是手动操作，重新启动自动播放
    if (isAutoPlaying) {
        startAutoPlay();
    }
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
    
    // 更新Instagram风格的进度条
    const progressBars = document.querySelectorAll('.modal-progress-bar');
    progressBars.forEach((bar, index) => {
        // 重置所有状态类
        bar.classList.remove('active', 'completed');
        
        if (index < currentImageIndex) {
            // 已完成的图片
            bar.classList.add('completed');
        } else if (index === currentImageIndex) {
            // 当前图片 - 开始进度动画
            requestAnimationFrame(() => {
                bar.classList.add('active');
            });
        }
        // index > currentImageIndex 的保持默认状态（未开始）
    });
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

// 自动播放控制函数
function startAutoPlay() {
    if (currentImageUrls.length <= 1) return;
    
    stopAutoPlay();
    isAutoPlaying = true;
    autoPlayInterval = setInterval(() => {
        nextModalImage();
    }, AUTO_PLAY_DELAY);
    
    console.log('Auto play started');
}

function stopAutoPlay() {
    if (autoPlayInterval) {
        clearInterval(autoPlayInterval);
        autoPlayInterval = null;
    }
    isAutoPlaying = false;
    console.log('Auto play stopped');
}

// 设置文件输入事件
function setupFileInputs() {
    // 统一的媒体文件输入
    const mediaInput = document.getElementById('mediaInput');
    mediaInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            handleFileSelection(e.target.files);
        }
        
        // 延迟重置input值，确保文件处理完成后再清空
        setTimeout(() => {
            this.value = '';
        }, 100);
    });
}

// 设置拖拽上传
function setupDragAndDrop() {
    const uploadArea = document.querySelector('#mediaUpload');
    
    uploadArea.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.borderColor = 'rgba(255, 255, 255, 0.6)';
        this.style.background = 'rgba(255, 255, 255, 0.15)';
    });
    
    uploadArea.addEventListener('dragleave', function(e) {
        e.preventDefault();
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.style.background = 'rgba(255, 255, 255, 0.05)';
    });
    
    uploadArea.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
        this.style.background = 'rgba(255, 255, 255, 0.05)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            showNotification(`检测到 ${files.length} 个文件，正在处理...`);
            handleFileSelection(files);
        }
    });
}

// 处理文件选择
function handleFileSelection(files) {
    if (!files || files.length === 0) return;
    
    // 定义允许的文件类型
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime'];
    
    const validFiles = [];
    const rejectedFiles = [];
    
    for (let file of files) {
        let fileType = null;
        let maxSize = 0;
        
        if (imageTypes.includes(file.type)) {
            fileType = 'photo';
            maxSize = 50 * 1024 * 1024; // 50MB for images
        } else if (videoTypes.includes(file.type)) {
            fileType = 'video';
            maxSize = 100 * 1024 * 1024; // 100MB for videos
        } else {
            rejectedFiles.push({ name: file.name, reason: '不支持的文件类型' });
            continue;
        }
        
        if (file.size > maxSize) {
            rejectedFiles.push({ 
                name: file.name, 
                reason: `文件过大，最大支持${fileType === 'video' ? '100MB' : '50MB'}` 
            });
            continue;
        }
        
        validFiles.push({ file, type: fileType });
    }
    
    // 显示被拒绝的文件信息
    if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(rejected => {
            showNotification(`${rejected.name}：${rejected.reason}`, 'error');
        });
    }
    
    if (validFiles.length === 0) return;
    
    // 检查重复文件并添加新文件
    const existingFileNames = currentFiles.map(f => f.name);
    const newFiles = validFiles.filter(vf => !existingFileNames.includes(vf.file.name));
    
    if (newFiles.length === 0) {
        showNotification('所选文件已存在', 'warning');
        return;
    }
    
    // 添加新文件到当前文件列表
    currentFiles = [...currentFiles, ...newFiles.map(vf => vf.file)];
    
    // 确定主要的文件类型用于上传
    const imageCount = validFiles.filter(vf => vf.type === 'photo').length;
    const videoCount = validFiles.filter(vf => vf.type === 'video').length;
    currentUploadType = imageCount >= videoCount ? 'photo' : 'video';
    
    showNotification(`已选择 ${currentFiles.length} 个文件（图片：${currentFiles.filter(f => imageTypes.includes(f.type)).length}，视频：${currentFiles.filter(f => videoTypes.includes(f.type)).length}）`);
    
    showPreview(currentFiles);
}

// 显示预览
function showPreview(files) {
    const previewContainer = document.getElementById('mediaPreview');
    previewContainer.innerHTML = '';
    
    // 显示清空按钮
    const clearBtn = document.getElementById('mediaClearBtn');
    if (clearBtn) {
        clearBtn.style.display = files.length > 0 ? 'inline-block' : 'none';
    }
    
    if (files.length === 0) return;
    
    // 分类文件
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime'];
    
    const images = files.filter(f => imageTypes.includes(f.type));
    const videos = files.filter(f => videoTypes.includes(f.type));
    
    // 添加文件计数器
    const counterDiv = document.createElement('div');
    counterDiv.className = 'files-counter';
    counterDiv.textContent = `已选择 ${files.length} 个文件（图片：${images.length}，视频：${videos.length}）`;
    previewContainer.appendChild(counterDiv);
    
    const previewGrid = document.createElement('div');
    previewGrid.className = 'preview-grid';
    
    Array.from(files).forEach((file, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'preview-item';
        
        if (imageTypes.includes(file.type)) {
            // 图片预览
            const reader = new FileReader();
            reader.onload = function(e) {
                previewItem.innerHTML = `
                    <div class="preview-image-container">
                        <img src="${e.target.result}" alt="预览">
                        <button class="remove-file-btn" onclick="removeFile(${index})" title="移除此文件">×</button>
                    </div>
                    <span class="file-name">${file.name}</span>
                `;
            };
            reader.readAsDataURL(file);
        } else if (videoTypes.includes(file.type)) {
            // 视频预览
            previewItem.innerHTML = `
                <div class="preview-video-container">
                    <div class="video-icon">🎬</div>
                    <button class="remove-file-btn" onclick="removeFile(${index})" title="移除此文件">×</button>
                </div>
                <span class="file-name">${file.name}</span>
            `;
        }
        
        previewGrid.appendChild(previewItem);
    });
    
    previewContainer.appendChild(previewGrid);
}

// 清空当前文件选择
function clearCurrentFiles() {
    currentFiles = [];
    showPreview(currentFiles);
    showNotification('已清空文件选择');
}

// 移除单个文件
function removeFile(index) {
    if (index >= 0 && index < currentFiles.length) {
        const removedFile = currentFiles.splice(index, 1)[0];
        showPreview(currentFiles);
        showNotification(`已移除文件: ${removedFile.name}`);
    }
}

// 清空预览
function clearPreviews() {
    document.getElementById('mediaPreview').innerHTML = '';
    
    // 隐藏清空按钮
    const mediaClearBtn = document.getElementById('mediaClearBtn');
    if (mediaClearBtn) mediaClearBtn.style.display = 'none';
}

// 上传文件到服务器
async function uploadFiles(files) {
    if (!files || files.length === 0) return [];
    
    // 分类文件
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime'];
    
    const images = files.filter(f => imageTypes.includes(f.type));
    const videos = files.filter(f => videoTypes.includes(f.type));
    
    let allUrls = [];
    
    // 上传图片
    if (images.length > 0) {
        const imageUrls = await uploadFilesByType(images, 'photo');
        allUrls = [...allUrls, ...imageUrls];
    }
    
    // 上传视频
    if (videos.length > 0) {
        const videoUrls = await uploadFilesByType(videos, 'video');
        allUrls = [...allUrls, ...videoUrls];
    }
    
    return allUrls;
}

// 按类型上传文件
async function uploadFilesByType(files, type) {
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
        if (currentFiles.length > 0) {
            showNotification('正在上传文件...');
            mediaUrls = await uploadFiles(currentFiles);
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
    
    // 为编辑模态框临时存储图片数据
    const tempEditKey = `edit_${memory.id}`;
    memoriesImageData[tempEditKey] = memory.media_urls;
    
    let mediaHtml = '<div class="current-media-grid">';
    
    memory.media_urls.forEach((url, index) => {
        if (memory.type === 'photo') {
            mediaHtml += `
                <div class="current-media-item" data-url="${url}">
                    <img src="${url}" alt="当前图片" onclick="openImageModal('${tempEditKey}', ${index})">
                    <button class="remove-current-media" onclick="removeCurrentMedia('${url}')" title="删除此文件">×</button>
                </div>
            `;
        } else if (memory.type === 'video') {
            mediaHtml += `
                <div class="current-media-item" data-url="${url}">
                    <video controls preload="metadata" onclick="openVideoModal('${tempEditKey}', ${index})">
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

// 设置编辑文件输入事件
function setupEditFileInputs() {
    // 统一的媒体文件输入
    const editMediaInput = document.getElementById('editMediaInput');
    editMediaInput.addEventListener('change', function(e) {
        if (e.target.files && e.target.files.length > 0) {
            handleEditFileSelection(e.target.files);
        }
        
        setTimeout(() => {
            this.value = '';
        }, 100);
    });
}

// 处理编辑文件选择
function handleEditFileSelection(files) {
    if (!files || files.length === 0) return;
    
    // 定义允许的文件类型
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime'];
    
    const validFiles = [];
    const rejectedFiles = [];
    
    for (let file of files) {
        let fileType = null;
        let maxSize = 0;
        
        if (imageTypes.includes(file.type)) {
            fileType = 'photo';
            maxSize = 50 * 1024 * 1024; // 50MB for images
        } else if (videoTypes.includes(file.type)) {
            fileType = 'video';
            maxSize = 100 * 1024 * 1024; // 100MB for videos
        } else {
            rejectedFiles.push({ name: file.name, reason: '不支持的文件类型' });
            continue;
        }
        
        if (file.size > maxSize) {
            rejectedFiles.push({ 
                name: file.name, 
                reason: `文件过大，最大支持${fileType === 'video' ? '100MB' : '50MB'}` 
            });
            continue;
        }
        
        validFiles.push({ file, type: fileType });
    }
    
    // 显示被拒绝的文件信息
    if (rejectedFiles.length > 0) {
        rejectedFiles.forEach(rejected => {
            showNotification(`${rejected.name}：${rejected.reason}`, 'error');
        });
    }
    
    if (validFiles.length === 0) return;
    
    // 检查重复文件并添加新文件
    const existingFileNames = editCurrentFiles.map(f => f.name);
    const newFiles = validFiles.filter(vf => !existingFileNames.includes(vf.file.name));
    
    if (newFiles.length === 0) {
        showNotification('所选文件已存在', 'warning');
        return;
    }
    
    // 添加新文件到当前文件列表
    editCurrentFiles = [...editCurrentFiles, ...newFiles.map(vf => vf.file)];
    
    showEditPreview(editCurrentFiles);
    showNotification(`已选择 ${newFiles.length} 个新文件`);
}

// 显示编辑预览
function showEditPreview(files) {
    const previewContainer = document.getElementById('editMediaPreview');
    previewContainer.innerHTML = '';
    
    if (files.length === 0) return;
    
    // 分类文件
    const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime'];
    
    const images = files.filter(f => imageTypes.includes(f.type));
    const videos = files.filter(f => videoTypes.includes(f.type));
    
    // 添加文件计数器
    const counterDiv = document.createElement('div');
    counterDiv.className = 'edit-files-counter';
    counterDiv.textContent = `待添加 ${files.length} 个文件（图片：${images.length}，视频：${videos.length}）`;
    previewContainer.appendChild(counterDiv);
    
    const previewGrid = document.createElement('div');
    previewGrid.className = 'edit-preview-grid';
    
    files.forEach((file, index) => {
        const previewItem = document.createElement('div');
        previewItem.className = 'edit-preview-item';
        
        if (imageTypes.includes(file.type)) {
            // 图片预览
            const reader = new FileReader();
            reader.onload = function(e) {
                previewItem.innerHTML = `
                    <div class="edit-preview-image-container">
                        <img src="${e.target.result}" alt="预览">
                        <button class="remove-edit-file-btn" onclick="removeEditFile(${index})" title="移除此文件">×</button>
                    </div>
                    <span class="edit-file-name">${file.name}</span>
                `;
            };
            reader.readAsDataURL(file);
        } else if (videoTypes.includes(file.type)) {
            // 视频预览
            previewItem.innerHTML = `
                <div class="edit-preview-video-container">
                    <div class="video-icon">🎬</div>
                    <button class="remove-edit-file-btn" onclick="removeEditFile(${index})" title="移除此文件">×</button>
                </div>
                <span class="edit-file-name">${file.name}</span>
            `;
        }
        
        previewGrid.appendChild(previewItem);
    });
    
    previewContainer.appendChild(previewGrid);
}

// 移除编辑文件
function removeEditFile(index) {
    if (index >= 0 && index < editCurrentFiles.length) {
        const removedFile = editCurrentFiles.splice(index, 1)[0];
        showEditPreview(editCurrentFiles);
        showNotification(`已移除文件: ${removedFile.name}`);
    }
}

// 清空编辑预览
function clearEditPreviews() {
    document.getElementById('editMediaPreview').innerHTML = '';
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
            newMediaUrls = await uploadFiles(editCurrentFiles);
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
            // 智能判断文件类型，优先选择视频类型
            const imageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
            const videoTypes = ['video/mp4', 'video/webm', 'video/ogg', 'video/avi', 'video/mov', 'video/quicktime'];
            
            const hasVideo = editCurrentFiles.some(file => videoTypes.includes(file.type)) || 
                           (editMemoryData.media_urls && editMemoryData.media_urls.some(url => url.includes('/video/')));
            
            finalType = hasVideo ? 'video' : 'photo';
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

// 触摸滑动相关变量
let touchStartX = 0;
let touchStartY = 0;
let touchEndX = 0;
let touchEndY = 0;
let isImageModalTouchEnabled = false;
let touchStartTime = 0;
let isTouching = false;

// 设置图片模态框触摸事件
function setupImageModalTouchEvents(modal) {
    const imageContainer = modal.querySelector('.modal-image-container');
    if (!imageContainer) return;
    
    isImageModalTouchEnabled = true;
    
    // 触摸开始
    imageContainer.addEventListener('touchstart', handleImageModalTouchStart, { passive: false });
    
    // 触摸移动
    imageContainer.addEventListener('touchmove', handleImageModalTouchMove, { passive: false });
    
    // 触摸结束
    imageContainer.addEventListener('touchend', handleImageModalTouchEnd, { passive: false });
    
    // 触摸取消（当触摸被中断时）
    imageContainer.addEventListener('touchcancel', handleImageModalTouchCancel, { passive: false });
    
    console.log('Image modal touch events set up');
}

// 处理触摸开始
function handleImageModalTouchStart(e) {
    if (!isImageModalTouchEnabled || e.touches.length > 1) return;
    
    const touch = e.touches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchStartTime = Date.now();
    isTouching = true;
    
    // 停止自动播放
    stopAutoPlay();
    
    console.log('Touch start:', touchStartX, touchStartY);
}

// 处理触摸移动
function handleImageModalTouchMove(e) {
    if (!isImageModalTouchEnabled || !isTouching) return;
    
    const touch = e.touches[0];
    const deltaX = touch.clientX - touchStartX;
    const deltaY = touch.clientY - touchStartY;
    
    // 如果主要是水平移动，阻止默认行为
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
        e.preventDefault();
    }
}

// 处理触摸结束
function handleImageModalTouchEnd(e) {
    if (!isImageModalTouchEnabled || !isTouching) return;
    
    const touch = e.changedTouches[0];
    touchEndX = touch.clientX;
    touchEndY = touch.clientY;
    const touchEndTime = Date.now();
    
    isTouching = false;
    
    // 检查是否是有效的滑动手势
    const touchDuration = touchEndTime - touchStartTime;
    if (touchDuration < 1000) { // 滑动时间小于1秒
        handleImageModalSwipe();
    }
    
    console.log('Touch end:', touchEndX, touchEndY, 'Duration:', touchDuration);
}

// 处理触摸取消
function handleImageModalTouchCancel(e) {
    if (!isImageModalTouchEnabled) return;
    
    isTouching = false;
    console.log('Touch cancelled');
}

// 处理滑动手势
function handleImageModalSwipe() {
    const deltaX = touchEndX - touchStartX;
    const deltaY = touchEndY - touchStartY;
    
    // 计算滑动距离和方向
    const minSwipeDistance = 80; // 增加最小滑动距离
    const maxVerticalDistance = 120; // 增加最大垂直距离容忍度
    
    console.log('Swipe detection:', 'deltaX:', deltaX, 'deltaY:', deltaY);
    
    // 确保是水平滑动且滑动距离足够
    if (Math.abs(deltaX) > minSwipeDistance && Math.abs(deltaY) < maxVerticalDistance) {
        // 确保水平距离明显大于垂直距离
        if (Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
            if (deltaX > 0) {
                // 向右滑动 - 上一张
                console.log('Swipe right detected - previous image');
                prevModalImage();
                showSwipeDirection('right');
            } else {
                // 向左滑动 - 下一张
                console.log('Swipe left detected - next image');
                nextModalImage();
                showSwipeDirection('left');
            }
        }
    }
    
    // 重置触摸坐标
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
}

// 显示滑动方向反馈
function showSwipeDirection(direction) {
    const modal = currentImageModal;
    if (!modal) return;
    
    const indicator = document.createElement('div');
    indicator.className = 'swipe-indicator';
    indicator.textContent = direction === 'left' ? '→' : '←';
    indicator.style.cssText = `
        position: absolute;
        top: 50%;
        ${direction === 'left' ? 'right: 20px' : 'left: 20px'};
        transform: translateY(-50%);
        color: white;
        font-size: 24px;
        font-weight: bold;
        background: rgba(255, 255, 255, 0.2);
        width: 40px;
        height: 40px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(10px);
        animation: swipeIndicator 0.6s ease forwards;
        z-index: 1001;
    `;
    
    modal.appendChild(indicator);
    
    // 1秒后移除指示器
    setTimeout(() => {
        if (indicator.parentNode) {
            indicator.parentNode.removeChild(indicator);
        }
    }, 600);
}

// 清理触摸事件
function cleanupImageModalTouchEvents() {
    isImageModalTouchEnabled = false;
    isTouching = false;
    touchStartX = 0;
    touchStartY = 0;
    touchEndX = 0;
    touchEndY = 0;
    touchStartTime = 0;
}

// 初始化
currentUploadType = 'photo';