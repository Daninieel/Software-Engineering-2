document.addEventListener('DOMContentLoaded', () => {
    let chatSessions = JSON.parse(localStorage.getItem('library_chat_sessions')) || [];
    let currentSessionId = null;
    let chatHistory = [];
    let isMinimized = false;

    const chatbotHTML = `
        <button class="chatbot-toggle" id="chatbotToggle" aria-label="Open Chat">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path>
            </svg>
        </button>
        <div id="chatbotModal" class="chatbot-modal" role="dialog">
            <div class="chatbot-header">
                <div class="header-left">
                    <button id="menuBtn" class="menu-btn">☰</button>
                    <div>
                        <div class="chatbot-title">Library Assistant</div>
                        <div class="chatbot-subtitle"><span class="status-dot"></span> Online</div>
                    </div>
                </div>
                <div class="header-right">
                    <button id="minimizeChatbot" class="header-btn minimize-chatbot" aria-label="Minimize Chat">_</button>
                    <button id="closeChatbot" class="header-btn close-chatbot" aria-label="Close Chat">×</button>
                </div>
            </div>
            <div class="chatbot-sidebar" id="chatbotSidebar">
                <div class="sidebar-header">
                    <button id="newChatBtn" class="new-chat-btn">+ New Chat</button>
                </div>
                <ul class="history-list" id="historyList"></ul>
            </div>
            <div class="sidebar-overlay" id="sidebarOverlay"></div>
            <div class="chatbot-messages" id="chatbotMessages"></div>
            <div class="chatbot-input-area">
                <input type="text" id="chatbotInput" placeholder="Ask about books, borrows, fines..." autocomplete="off">
                <button id="chatbotSend" class="chatbot-send">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    const modal = document.getElementById('chatbotModal');
    const toggle = document.getElementById('chatbotToggle');
    const closeBtn = document.getElementById('closeChatbot');
    const minimizeBtn = document.getElementById('minimizeChatbot');
    const input = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSend');
    const box = document.getElementById('chatbotMessages');
    const sidebar = document.getElementById('chatbotSidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const menuBtn = document.getElementById('menuBtn');
    const newChatBtn = document.getElementById('newChatBtn');
    const historyList = document.getElementById('historyList');

    toggle.onclick = () => {
        if (isMinimized) {
            modal.classList.remove('minimized');
            isMinimized = false;
        }
        modal.classList.add('active');
        if (!currentSessionId) startNewChat();
        input.focus();
    };

    closeBtn.onclick = () => {
        modal.classList.remove('active');
        modal.classList.remove('minimized');
        isMinimized = false;
    };

    minimizeBtn.onclick = () => {
        modal.classList.add('minimized');
        isMinimized = true;
        modal.classList.remove('active');
    };

    function toggleSidebar() {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('active');
        if (sidebar.classList.contains('open')) renderHistoryList();
    }

    menuBtn.onclick = toggleSidebar;
    overlay.onclick = toggleSidebar;

    function addMsg(text, sender) {
        const div = document.createElement('div');
        div.className = `message-container ${sender}-message`;
        div.innerHTML = `<div class="message-bubble">${text}</div>`;
        box.appendChild(div);
        box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }

    function showTyping() {
        const div = document.createElement('div');
        div.id = 'ai-typing';
        div.className = 'message-container bot-message';
        div.innerHTML = `<div class="message-bubble typing"><span></span><span></span><span></span></div>`;
        box.appendChild(div);
        box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }

    function startNewChat() {
        currentSessionId = Date.now().toString();
        chatHistory = [];
        box.innerHTML = '';
        const welcome = "Hi I'm SIAgent. I can help you find books or check for any unpaid fines. How can I assist you today?";
        addMsg(welcome, 'bot');
        saveSession(welcome, 'bot');
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    newChatBtn.onclick = startNewChat;

    function saveSession(text, role) {
        let session = chatSessions.find(s => s.id === currentSessionId);
        if (!session) {
            session = { id: currentSessionId, title: "New Chat", messages: [] };
            chatSessions.unshift(session);
        }
        session.messages.push({ role, text });
        if (role === 'user' && session.title === "New Chat") {
            session.title = text.substring(0, 25) + (text.length > 25 ? "..." : "");
        }
        localStorage.setItem('library_chat_sessions', JSON.stringify(chatSessions));
    }

    function loadSession(id) {
        const session = chatSessions.find(s => s.id === id);
        if (!session) return;
        currentSessionId = id;
        box.innerHTML = '';
        chatHistory = [];
        session.messages.forEach(msg => {
            addMsg(msg.text, msg.role);
            chatHistory.push({
                role: msg.role === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            });
        });
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
    }

    function renderHistoryList() {
        historyList.innerHTML = '';
        chatSessions.forEach(session => {
            const li = document.createElement('li');
            li.className = `history-item ${session.id === currentSessionId ? 'active' : ''}`;
            li.innerHTML = `<span>💬</span> ${session.title}`;
            li.onclick = () => loadSession(session.id);
            historyList.appendChild(li);
        });
    }

    async function sendMessage() {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';
        input.disabled = true;
        sendBtn.disabled = true;
        addMsg(text, 'user');
        saveSession(text, 'user');
        showTyping();
        const payload = {
            Message: text,
            History: chatHistory
        };
        console.log("[DEBUG] Sending payload:", payload);
        try {
            const res = await fetch('/api/Chatbot/chat?debug=false', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            console.log("[DEBUG] Response status:", res.status, res.statusText);
            const rawText = await res.text();
            console.log("[DEBUG] Raw server response:", rawText.substring(0, 500) + (rawText.length > 500 ? "..." : ""));
            if (!res.ok) {
                let errMsg = `Server error (${res.status})`;
                try {
                    const errData = JSON.parse(rawText);
                    errMsg += `: ${errData.error || errData.message || rawText}`;
                } catch {
                    errMsg += `: ${rawText}`;
                }
                throw new Error(errMsg);
            }
            let data;
            try {
                data = JSON.parse(rawText);
            } catch {
                throw new Error("Invalid JSON from server");
            }
            document.getElementById('ai-typing')?.remove();
            let reply = "Sorry, something went wrong.";
            if (data?.debug === true && data.context) {
                reply = "DEBUG MODE (raw context):\n\n" + data.context;
            } else if (data?.candidates?.[0]?.content?.parts?.[0]?.text) {
                reply = data.candidates[0].content.parts[0].text.trim();
            } else if (data?.error) {
                reply = `⚠️ ${data.error}${data.message ? ' - ' + data.message : ''}`;
            }
            addMsg(reply, 'bot');
            saveSession(reply, 'bot');
            chatHistory.push({ role: "user", parts: [{ text }] });
            chatHistory.push({ role: "model", parts: [{ text: reply }] });
        } catch (err) {
            document.getElementById('ai-typing')?.remove();
            console.error("[ERROR] Chat failed:", err);
            addMsg(`⚠️ ${err.message}`, 'bot');
        } finally {
            input.disabled = false;
            sendBtn.disabled = false;
            input.focus();
        }
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            sendMessage();
        }
    };
});