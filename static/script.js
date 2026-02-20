document.addEventListener('DOMContentLoaded', () => {
    const chatHistory = document.getElementById('chat-history');
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const micBtn = document.getElementById('mic-btn');

    // --- Markdown Configuration ---
    marked.setOptions({
        breaks: true,
        gfm: true,
        highlight: function (code, lang) {
            if (lang && hljs.getLanguage(lang)) {
                return hljs.highlight(code, { language: lang }).value;
            }
            return hljs.highlightAuto(code).value;
        }
    });

    // --- Auto-Resize Textarea ---
    const adjustHeight = () => {
        userInput.style.height = 'auto';
        userInput.style.height = Math.min(userInput.scrollHeight, 150) + 'px';
        sendBtn.disabled = userInput.value.trim().length === 0;
    };
    userInput.addEventListener('input', adjustHeight);

    // --- Message Helpers ---
    function createMessageElement(role) {
        const msgDiv = document.createElement('div');
        msgDiv.classList.add('message', role);
        const bubble = document.createElement('div');
        bubble.classList.add('bubble');
        msgDiv.appendChild(bubble);
        return { msgDiv, bubble };
    }

    function showTypingIndicator() {
        const { msgDiv, bubble } = createMessageElement('assistant');
        bubble.innerHTML = `
            <div class="typing-dots">
                <div class="dot"></div>
                <div class="dot"></div>
                <div class="dot"></div>
            </div>`;
        chatHistory.appendChild(msgDiv);
        scrollToBottom();
        return msgDiv;
    }

    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // --- Chat Logic ---
    async function sendMessage() {
        const text = userInput.value.trim();
        if (!text) return;

        // User Message
        const { msgDiv: userMsgDiv, bubble: userBubble } = createMessageElement('user');
        userBubble.textContent = text;
        chatHistory.appendChild(userMsgDiv);

        userInput.value = '';
        adjustHeight();
        userInput.disabled = true;
        sendBtn.disabled = true;
        scrollToBottom();

        // AI Message (Typing...)
        const loadingMsg = showTypingIndicator();

        try {
            let response;
            const maxRetries = 3;
            for (let i = 0; i < maxRetries; i++) {
                try {
                    response = await fetch('/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: text })
                    });

                    if (response.status === 429) {
                        if (i < maxRetries - 1) {
                            const waitTime = (i + 1) * 5000;
                            const bubble = loadingMsg.querySelector('.bubble');
                            bubble.innerHTML = `
                                <div class="typing-dots">
                                    <div class="dot"></div><div class="dot"></div><div class="dot"></div>
                                </div>
                                <div style="font-size: 0.8em; margin-top: 5px; opacity: 0.8;">Rate limit hit. Retrying in ${waitTime / 1000}s...</div>`;
                            await new Promise(r => setTimeout(r, waitTime));
                            continue;
                        }
                    }

                    if (!response.ok) {
                        const errData = await response.json();
                        throw new Error(errData.detail || response.statusText);
                    }

                    // If successful
                    break;

                } catch (err) {
                    if (i === maxRetries - 1) throw err;
                    // If network error, maybe wait a bit too?
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            const data = await response.json();

            // Allow animation to play a bit
            await new Promise(r => setTimeout(r, 400));
            chatHistory.removeChild(loadingMsg);

            // True AI Response
            const { msgDiv: aiMsgDiv, bubble: aiBubble } = createMessageElement('assistant');
            aiBubble.innerHTML = marked.parse(data.response);
            chatHistory.appendChild(aiMsgDiv);

            // Re-highlight code blocks
            document.querySelectorAll('pre code').forEach((block) => {
                hljs.highlightElement(block);
            });

        } catch (error) {
            chatHistory.removeChild(loadingMsg);
            const { msgDiv: errorMsg, bubble: errorBubble } = createMessageElement('assistant');
            errorBubble.innerHTML = `<span style="color: #ef4444;">Error: ${error.message}</span>`;
            chatHistory.appendChild(errorMsg);
        } finally {
            userInput.disabled = false;
            scrollToBottom();
            userInput.focus();
            adjustHeight();
        }
    }

    // --- Voice Logic (Web Speech API) ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onstart = () => {
            micBtn.classList.add('listening');
            userInput.placeholder = "Listening...";
        };

        recognition.onend = () => {
            micBtn.classList.remove('listening');
            userInput.placeholder = "Type or speak...";
            userInput.focus();
        };

        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            userInput.value = transcript;
            adjustHeight();
            // Automatically send if confident? For now let user confirm.
            // sendMessage(); 
        };

        recognition.onerror = (event) => {
            console.error("Speech recognition error", event.error);
            micBtn.classList.remove('listening');
            userInput.placeholder = "Error listening. Try again.";
        };

        micBtn.addEventListener('click', () => {
            if (micBtn.classList.contains('listening')) {
                recognition.stop();
            } else {
                recognition.start();
            }
        });
    } else {
        micBtn.style.display = 'none'; // Hide if not supported
        console.log("Web Speech API not supported.");
    }

    // --- Event Listeners ---
    sendBtn.addEventListener('click', sendMessage);

    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Initial Focus
    userInput.focus();
});
