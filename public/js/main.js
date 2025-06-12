// Task Tracker Pro - Main JavaScript File

document.addEventListener('DOMContentLoaded', function() {
    // Initialize all components
    initAlerts();
    initForms();
    initModals();
    initDropdowns();
    initTaskFilters();
    initCharts();
    initRealTimeUpdates();
});

// Alert Management
function initAlerts() {
    // Auto-hide alerts after 5 seconds
    const alerts = document.querySelectorAll('.alert');
    alerts.forEach(alert => {
        setTimeout(() => {
            if (alert.parentNode) {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 300);
            }
        }, 5000);
    });

    // Manual close functionality
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('alert-close')) {
            const alert = e.target.closest('.alert');
            if (alert) {
                alert.style.opacity = '0';
                setTimeout(() => alert.remove(), 300);
            }
        }
    });
}

// Form Validation and Enhancement
function initForms() {
    const forms = document.querySelectorAll('form');
    
    forms.forEach(form => {
        // Real-time validation
        const inputs = form.querySelectorAll('input, select, textarea');
        inputs.forEach(input => {
            input.addEventListener('blur', validateField);
            input.addEventListener('input', clearFieldError);
        });

        // Form submission
        form.addEventListener('submit', handleFormSubmit);
    });
}

function validateField(e) {
    const field = e.target;
    const value = field.value.trim();
    const fieldName = field.name;
    
    // Clear previous errors
    clearFieldError(e);
    
    // Validation rules
    let isValid = true;
    let errorMessage = '';
    
    switch(fieldName) {
        case 'email':
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (value && !emailRegex.test(value)) {
                isValid = false;
                errorMessage = 'Please enter a valid email address';
            }
            break;
            
        case 'password':
            if (value && value.length < 6) {
                isValid = false;
                errorMessage = 'Password must be at least 6 characters long';
            }
            break;
            
        case 'name':
        case 'title':
            if (value && value.length < 2) {
                isValid = false;
                errorMessage = 'This field must be at least 2 characters long';
            }
            break;
            
        case 'description':
            if (value && value.length < 10) {
                isValid = false;
                errorMessage = 'Description must be at least 10 characters long';
            }
            break;
    }
    
    if (!isValid) {
        showFieldError(field, errorMessage);
    }
}

function showFieldError(field, message) {
    // Remove existing error
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
        existingError.remove();
    }
    
    // Add error message
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error text-danger mt-1';
    errorDiv.style.fontSize = '0.875rem';
    errorDiv.textContent = message;
    
    field.parentNode.appendChild(errorDiv);
    field.style.borderColor = '#ef4444';
}

function clearFieldError(e) {
    const field = e.target;
    const errorDiv = field.parentNode.querySelector('.field-error');
    
    if (errorDiv) {
        errorDiv.remove();
    }
    
    field.style.borderColor = '#e5e7eb';
}

async function handleFormSubmit(e) {
    const form = e.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    
    // Validate all fields
    const inputs = form.querySelectorAll('input, select, textarea');
    let isValid = true;
    
    inputs.forEach(input => {
        const event = new Event('blur');
        input.dispatchEvent(event);
        
        if (input.parentNode.querySelector('.field-error')) {
            isValid = false;
        }
    });
    
    if (!isValid) {
        e.preventDefault();
        return;
    }
    
    // Show loading state
    if (submitBtn) {
        const originalText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Processing...';
        
        // Reset after 5 seconds if no response
        setTimeout(() => {
            if (submitBtn.disabled) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalText;
            }
        }, 5000);
    }
}

// Modal Management
function initModals() {
    // Open modal
    document.addEventListener('click', function(e) {
        if (e.target.hasAttribute('data-modal')) {
            const modalId = e.target.getAttribute('data-modal');
            openModal(modalId);
        }
        
        // Close modal
        if (e.target.classList.contains('modal-close') || 
            e.target.classList.contains('modal-overlay')) {
            closeModal();
        }
    });
    
    // Close modal with Escape key
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') {
            closeModal();
        }
    });
}

function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'flex';
        modal.style.opacity = '0';
        
        setTimeout(() => {
            modal.style.opacity = '1';
        }, 10);
        
        // Focus first input
        const firstInput = modal.querySelector('input, select, textarea');
        if (firstInput) {
            firstInput.focus();
        }
    }
}

function closeModal() {
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.style.opacity = '0';
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
    });
}

// Dropdown Management
function initDropdowns() {
    document.addEventListener('click', function(e) {
        // Close all dropdowns when clicking outside
        if (!e.target.closest('.dropdown')) {
            closeAllDropdowns();
        }
        
        // Toggle dropdown
        if (e.target.hasAttribute('data-dropdown')) {
            const dropdownId = e.target.getAttribute('data-dropdown');
            toggleDropdown(dropdownId);
        }
    });
}

function toggleDropdown(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    const isOpen = dropdown.classList.contains('show');
    
    closeAllDropdowns();
    
    if (!isOpen) {
        dropdown.classList.add('show');
    }
}

function closeAllDropdowns() {
    const dropdowns = document.querySelectorAll('.dropdown-menu.show');
    dropdowns.forEach(dropdown => {
        dropdown.classList.remove('show');
    });
}

// Task Filtering and Sorting
function initTaskFilters() {
    const filterSelects = document.querySelectorAll('.task-filter');
    const sortSelects = document.querySelectorAll('.task-sort');
    
    filterSelects.forEach(select => {
        select.addEventListener('change', filterTasks);
    });
    
    sortSelects.forEach(select => {
        select.addEventListener('change', sortTasks);
    });
}

function filterTasks() {
    const statusFilter = document.querySelector('.filter-status')?.value;
    const priorityFilter = document.querySelector('.filter-priority')?.value;
    const assigneeFilter = document.querySelector('.filter-assignee')?.value;
    
    const tasks = document.querySelectorAll('.task-item');
    
    tasks.forEach(task => {
        let show = true;
        
        if (statusFilter && statusFilter !== 'all') {
            const taskStatus = task.getAttribute('data-status');
            if (taskStatus !== statusFilter) show = false;
        }
        
        if (priorityFilter && priorityFilter !== 'all') {
            const taskPriority = task.getAttribute('data-priority');
            if (taskPriority !== priorityFilter) show = false;
        }
        
        if (assigneeFilter && assigneeFilter !== 'all') {
            const taskAssignee = task.getAttribute('data-assignee');
            if (taskAssignee !== assigneeFilter) show = false;
        }
        
        task.style.display = show ? 'block' : 'none';
    });
    
    updateTaskCount();
}

function sortTasks() {
    const sortBy = document.querySelector('.sort-tasks')?.value;
    const taskContainer = document.querySelector('.tasks-container');
    
    if (!taskContainer || !sortBy) return;
    
    const tasks = Array.from(taskContainer.querySelectorAll('.task-item'));
    
    tasks.sort((a, b) => {
        switch(sortBy) {
            case 'due-date':
                const dateA = new Date(a.getAttribute('data-due-date') || '9999-12-31');
                const dateB = new Date(b.getAttribute('data-due-date') || '9999-12-31');
                return dateA - dateB;
                
            case 'priority':
                const priorityOrder = { 'urgent': 4, 'high': 3, 'medium': 2, 'low': 1 };
                const priorityA = priorityOrder[a.getAttribute('data-priority')] || 0;
                const priorityB = priorityOrder[b.getAttribute('data-priority')] || 0;
                return priorityB - priorityA;
                
            case 'title':
                const titleA = a.querySelector('.task-title')?.textContent || '';
                const titleB = b.querySelector('.task-title')?.textContent || '';
                return titleA.localeCompare(titleB);
                
            default:
                return 0;
        }
    });
    
    // Re-append sorted tasks
    tasks.forEach(task => taskContainer.appendChild(task));
}

function updateTaskCount() {
    const visibleTasks = document.querySelectorAll('.task-item[style*="block"], .task-item:not([style*="none"])');
    const countElement = document.querySelector('.task-count');
    
    if (countElement) {
        countElement.textContent = visibleTasks.length;
    }
}

// Charts and Analytics
function initCharts() {
    // Initialize charts if Chart.js is available
    if (typeof Chart !== 'undefined') {
        initTaskStatusChart();
        initPriorityChart();
        initTimelineChart();
    }
}

function initTaskStatusChart() {
    const ctx = document.getElementById('taskStatusChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['To Do', 'In Progress', 'Review', 'Completed'],
            datasets: [{
                data: [12, 19, 3, 5],
                backgroundColor: [
                    '#f3f4f6',
                    '#dbeafe',
                    '#fef3c7',
                    '#d1fae5'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    position: 'bottom'
                }
            }
        }
    });
}

function initPriorityChart() {
    const ctx = document.getElementById('priorityChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Low', 'Medium', 'High', 'Urgent'],
            datasets: [{
                label: 'Tasks by Priority',
                data: [4, 8, 12, 3],
                backgroundColor: [
                    '#f3f4f6',
                    '#dbeafe',
                    '#fef3c7',
                    '#fee2e2'
                ]
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function initTimelineChart() {
    const ctx = document.getElementById('timelineChart');
    if (!ctx) return;
    
    new Chart(ctx, {
        type: 'line',
        data: {
            labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
            datasets: [{
                label: 'Completed Tasks',
                data: [12, 19, 3, 5, 2, 3],
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// Real-time Updates
function initRealTimeUpdates() {
    // Simulate real-time updates (replace with WebSocket in production)
    setInterval(() => {
        updateTaskCounters();
    }, 30000); // Update every 30 seconds
}

function updateTaskCounters() {
    // Update dashboard counters
    const counters = document.querySelectorAll('[data-counter]');
    counters.forEach(counter => {
        const type = counter.getAttribute('data-counter');
        // In a real app, this would fetch from the server
        // For now, we'll just simulate updates
        const currentValue = parseInt(counter.textContent) || 0;
        const newValue = currentValue + Math.floor(Math.random() * 3) - 1;
        if (newValue >= 0) {
            counter.textContent = newValue;
        }
    });
}

// Utility Functions
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `alert alert-${type} alert-dismissible fade show`;
    notification.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    document.body.appendChild(notification);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, 5000);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
}

function formatDateTime(dateString) {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Export functions for use in other scripts
window.TaskTracker = {
    showNotification,
    formatDate,
    formatDateTime,
    openModal,
    closeModal,
    filterTasks,
    sortTasks
}; 