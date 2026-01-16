document.addEventListener('DOMContentLoaded', () => {
    const chatbotHTML = `
        <button class="chatbot-toggle" id="chatbotToggle" aria-label="Open Chat">💬</button>
        <div id="chatbotModal" class="chatbot-modal" role="dialog">
            <div class="chatbot-header">
                <div>
                    <strong class="chatbot-title">AI Library Assistant</strong>
                    <span class="chatbot-status">
                        <span class="status-dot"></span>
                        System Online
                    </span>
                </div>
                <button id="closeChatbot" class="close-chatbot" aria-label="Close Chat">&times;</button>
            </div>
            <div class="chatbot-messages" id="chatbotMessages">
                <div class="message-container bot-message">
                    <div class="message-bubble">Hello! I am your research assistant. How can I help you navigate our library collections today?</div>
                </div>
            </div>
            <div class="chatbot-input-area">
                <input type="text" id="chatbotInput" placeholder="Ask a question..." autocomplete="off">
                <button id="chatbotSend" class="chatbot-send">➤</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', chatbotHTML);

    const modal = document.getElementById('chatbotModal');
    const toggle = document.getElementById('chatbotToggle');
    const closeBtn = document.getElementById('closeChatbot');
    const input = document.getElementById('chatbotInput');
    const sendBtn = document.getElementById('chatbotSend');
    const box = document.getElementById('chatbotMessages');

    toggle.onclick = () => {
        modal.classList.add('active');
        input.focus();
    };

    closeBtn.onclick = () => modal.classList.remove('active');

    function addMsg(text, sender) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-container ${sender}-message`;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.innerText = text;

        wrapper.appendChild(bubble);
        box.appendChild(wrapper);
        box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }

    function showTypingIndicator() {
        const indicator = document.createElement('div');
        indicator.id = 'ai-typing';
        indicator.className = 'message-container bot-message';
        indicator.innerHTML = `
            <div class="message-bubble typing">
                <span></span><span></span><span></span>
            </div>`;
        box.appendChild(indicator);
        box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }

    function sendMessage() {
        const text = input.value.trim();
        if (!text) return;

        input.value = '';
        addMsg(text, 'user');
        showTypingIndicator();

        setTimeout(() => {
            const indicator = document.getElementById('ai-typing');
            if (indicator) indicator.remove();

            addMsg("I have received your inquiry. My knowledge base is currently in demo mode, but I can assist with UI/UX layout questions!", 'bot');
        }, 1500);
    }

    sendBtn.onclick = sendMessage;
    input.onkeypress = (e) => { if (e.key === 'Enter') sendMessage(); };
});
